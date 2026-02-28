export const runtime = "edge";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { fail, HttpError, ok } from "@/lib/http";

type NormalizedRow = {
  assetTag: string;
  type: string;
  brand: string;
  model: string;
  serialNumber: string;
  qrCodeValue: string;
  purchaseDate?: string;
  purchasePrice?: string;
  locationName: string;
  status: "AVAILABLE" | "MAINTENANCE" | "RETIRED";
  notes?: string;
};

function parseDelimitedLine(line: string, delimiter: string) {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === delimiter && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}

function toStatus(raw: string): NormalizedRow["status"] {
  const value = raw.trim().toLowerCase();
  if (["retired", "archived"].includes(value)) return "RETIRED";
  if (["maintenance", "repair", "broken"].includes(value)) return "MAINTENANCE";
  return "AVAILABLE";
}

function normalizeRows(content: string) {
  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) {
    throw new HttpError(400, "CSV must include a header and at least one data row");
  }

  const delimiter = lines[0].includes(";") ? ";" : ",";
  const headers = parseDelimitedLine(lines[0], delimiter);
  const rows: NormalizedRow[] = [];

  const get = (record: Record<string, string>, ...keys: string[]) => {
    for (const key of keys) {
      const value = record[key];
      if (value && value.trim()) return value.trim();
    }
    return "";
  };

  for (let i = 1; i < lines.length; i += 1) {
    const values = parseDelimitedLine(lines[i], delimiter);
    const record = Object.fromEntries(headers.map((h, idx) => [h, values[idx] ?? ""])) as Record<string, string>;

    const sourceId = get(record, "Id", "id");
    const name = get(record, "Name", "name", "asset_tag");
    const assetTag = get(record, "UW Asset Tag") || name || `import-${sourceId || i}`;
    const serialNumber = get(record, "Serial number", "serial_number") || `cheqroom-${sourceId || assetTag}`;
    const qrCodeValue =
      get(record, "Barcodes", "Codes", "qr_code_value") || `cheqroom-qr-${sourceId || assetTag}`;

    const notesPayload = {
      cheqroomId: sourceId || undefined,
      category: get(record, "Category"),
      kind: get(record, "Kind"),
      description: get(record, "Description"),
      owner: get(record, "Owner"),
      department: get(record, "Department"),
      fiscalYearPurchased: get(record, "Fiscal Year Purchased"),
      link: get(record, "Link"),
      checkOutLocationName: get(record, "Check-out Location Name"),
      custodyName: get(record, "Custody (via name)"),
      custodyEmail: get(record, "Custody (via email)")
    };

    rows.push({
      assetTag,
      type: get(record, "Category", "type") || "equipment",
      brand: get(record, "Brand", "brand") || "Unknown",
      model: get(record, "Model", "model") || "Unknown",
      serialNumber,
      qrCodeValue,
      purchaseDate: get(record, "Purchase Date", "purchase_date") || undefined,
      purchasePrice: get(record, "Purchase Price") || undefined,
      locationName: get(record, "Location", "location_name"),
      status: toStatus(get(record, "Status", "status")),
      notes: JSON.stringify(notesPayload)
    });
  }

  return rows;
}

export async function POST(req: Request) {
  try {
    await requireAuth();

    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      throw new HttpError(400, "Expected multipart file field named 'file'");
    }

    const text = await file.text();
    const rows = normalizeRows(text);

    const locationNames = [...new Set(rows.map((r) => r.locationName).filter(Boolean))];

    const existingLocations = await db.location.findMany({ where: { name: { in: locationNames } } });
    const locationMap = new Map(existingLocations.map((loc: { name: string; id: string }) => [loc.name, loc.id]));

    for (const locationName of locationNames) {
      if (!locationMap.has(locationName)) {
        const created = await db.location.create({ data: { name: locationName } });
        locationMap.set(locationName, created.id);
      }
    }

    const errors: Array<{ line: number; error: string }> = [];
    let importedCount = 0;

    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i];
      const lineNo = i + 2;

      if (!row.locationName) {
        errors.push({ line: lineNo, error: "Missing location" });
        continue;
      }

      const locationId = locationMap.get(row.locationName);
      if (!locationId) {
        errors.push({ line: lineNo, error: `Unknown location: ${row.locationName}` });
        continue;
      }

      try {
        const parsedPurchaseDate = row.purchaseDate ? new Date(row.purchaseDate) : null;
        const purchaseDate = parsedPurchaseDate && Number.isNaN(parsedPurchaseDate.getTime()) ? null : parsedPurchaseDate;
        const purchasePrice = row.purchasePrice ? Number(row.purchasePrice.replace(/[^\d.-]+/g, "")) : undefined;

        await db.asset.upsert({
          where: { serialNumber: row.serialNumber },
          create: {
            assetTag: row.assetTag,
            type: row.type,
            brand: row.brand,
            model: row.model,
            serialNumber: row.serialNumber,
            qrCodeValue: row.qrCodeValue,
            purchaseDate,
            purchasePrice: Number.isFinite(purchasePrice) ? purchasePrice : undefined,
            status: row.status,
            notes: row.notes,
            locationId
          },
          update: {
            assetTag: row.assetTag,
            type: row.type,
            brand: row.brand,
            model: row.model,
            qrCodeValue: row.qrCodeValue,
            purchaseDate,
            purchasePrice: Number.isFinite(purchasePrice) ? purchasePrice : undefined,
            status: row.status,
            notes: row.notes,
            locationId
          }
        });
        importedCount += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : "unknown error";
        errors.push({ line: lineNo, error: message.slice(0, 300) });
      }
    }

    return ok({ importedCount, errorCount: errors.length, errors });
  } catch (error) {
    return fail(error);
  }
}
