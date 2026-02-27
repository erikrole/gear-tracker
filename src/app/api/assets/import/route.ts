export const runtime = "edge";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { fail, HttpError, ok } from "@/lib/http";

type CsvAssetRow = {
  asset_tag: string;
  type: string;
  brand: string;
  model: string;
  serial_number: string;
  qr_code_value: string;
  purchase_date?: string;
  location_name: string;
};

function parseCsvLine(line: string) {
  const cells = line.split(",").map((cell) => cell.trim().replace(/^"|"$/g, ""));
  return cells;
}

function parseCsv(content: string) {
  const lines = content.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) {
    throw new HttpError(400, "CSV must include a header and at least one data row");
  }

  const headers = parseCsvLine(lines[0]);
  const rows: CsvAssetRow[] = [];

  for (let i = 1; i < lines.length; i += 1) {
    const values = parseCsvLine(lines[i]);
    const row = Object.fromEntries(headers.map((h, idx) => [h, values[idx] || ""])) as CsvAssetRow;
    rows.push(row);
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
    const rows = parseCsv(text);

    const locationNames = [...new Set(rows.map((r) => r.location_name).filter(Boolean))];
    const locations = await db.location.findMany({
      where: {
        name: { in: locationNames }
      }
    });
    const locationMap = new Map<string, string>(
      locations.map((loc: { name: string; id: string }) => [loc.name, loc.id])
    );

    const errors: Array<{ line: number; error: string }> = [];
    const inserted: string[] = [];

    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i];
      const lineNo = i + 2;

      if (!row.asset_tag || !row.serial_number || !row.qr_code_value || !row.location_name) {
        errors.push({ line: lineNo, error: "Missing required fields" });
        continue;
      }

      const locationId = locationMap.get(row.location_name);
      if (!locationId) {
        errors.push({ line: lineNo, error: `Unknown location: ${row.location_name}` });
        continue;
      }

      try {
        const asset = await db.asset.create({
          data: {
            assetTag: row.asset_tag,
            type: row.type || "camera",
            brand: row.brand || "unknown",
            model: row.model || "unknown",
            serialNumber: row.serial_number,
            qrCodeValue: row.qr_code_value,
            purchaseDate: row.purchase_date ? new Date(row.purchase_date) : null,
            locationId
          }
        });
        inserted.push(asset.id);
      } catch (error) {
        const message = error instanceof Error ? error.message : "unknown error";
        errors.push({ line: lineNo, error: message.slice(0, 300) });
      }
    }

    return ok({
      importedCount: inserted.length,
      errorCount: errors.length,
      errors
    });
  } catch (error) {
    return fail(error);
  }
}
