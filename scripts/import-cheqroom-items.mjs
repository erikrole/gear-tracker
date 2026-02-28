import fs from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function parseDelimitedLine(line, delimiter) {
  const cells = [];
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

function toStatus(raw) {
  const value = (raw || "").trim().toLowerCase();
  if (["retired", "archived"].includes(value)) return "RETIRED";
  if (["maintenance", "repair", "broken"].includes(value)) return "MAINTENANCE";
  return "AVAILABLE";
}

function getValue(record, ...keys) {
  for (const key of keys) {
    const value = record[key];
    if (value && value.trim()) return value.trim();
  }
  return "";
}

function normalize(content) {
  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const delimiter = lines[0].includes(";") ? ";" : ",";
  const headers = parseDelimitedLine(lines[0], delimiter);

  return lines.slice(1).map((line, index) => {
    const values = parseDelimitedLine(line, delimiter);
    const record = Object.fromEntries(headers.map((h, idx) => [h, values[idx] ?? ""]));
    const sourceId = getValue(record, "Id", "id");
    const name = getValue(record, "Name", "name", "asset_tag");
    const assetTag = getValue(record, "UW Asset Tag") || name || `import-${sourceId || index}`;
    const serialNumber = getValue(record, "Serial number", "serial_number") || `cheqroom-${sourceId || assetTag}`;
    const qrCodeValue = getValue(record, "Barcodes", "Codes", "qr_code_value") || `cheqroom-qr-${sourceId || assetTag}`;

    const notes = JSON.stringify({
      cheqroomId: sourceId || undefined,
      category: getValue(record, "Category"),
      kind: getValue(record, "Kind"),
      description: getValue(record, "Description"),
      owner: getValue(record, "Owner"),
      department: getValue(record, "Department"),
      fiscalYearPurchased: getValue(record, "Fiscal Year Purchased"),
      link: getValue(record, "Link"),
      checkOutLocationName: getValue(record, "Check-out Location Name"),
      custodyName: getValue(record, "Custody (via name)"),
      custodyEmail: getValue(record, "Custody (via email)")
    });

    return {
      assetTag,
      type: getValue(record, "Category", "type") || "equipment",
      brand: getValue(record, "Brand", "brand") || "Unknown",
      model: getValue(record, "Model", "model") || "Unknown",
      serialNumber,
      qrCodeValue,
      purchaseDate: getValue(record, "Purchase Date", "purchase_date") || undefined,
      purchasePrice: getValue(record, "Purchase Price") || undefined,
      locationName: getValue(record, "Location", "location_name"),
      status: toStatus(getValue(record, "Status", "status")),
      notes
    };
  });
}

async function main() {
  const fileArg = process.argv[2] || "Cheqroom Items - Feb 27.csv";
  const filePath = path.resolve(process.cwd(), fileArg);
  const content = await fs.readFile(filePath, "utf-8");
  const rows = normalize(content);

  const locationNames = [...new Set(rows.map((r) => r.locationName).filter(Boolean))];
  const existingLocations = await prisma.location.findMany({ where: { name: { in: locationNames } } });
  const locationMap = new Map(existingLocations.map((loc) => [loc.name, loc.id]));

  for (const locationName of locationNames) {
    if (!locationMap.has(locationName)) {
      const location = await prisma.location.create({ data: { name: locationName } });
      locationMap.set(locationName, location.id);
    }
  }

  let importedCount = 0;
  let errorCount = 0;

  for (const row of rows) {
    try {
      const parsedPurchaseDate = row.purchaseDate ? new Date(row.purchaseDate) : null;
      const purchaseDate = parsedPurchaseDate && Number.isNaN(parsedPurchaseDate.getTime()) ? null : parsedPurchaseDate;
      const purchasePrice = row.purchasePrice ? Number(row.purchasePrice.replace(/[^\d.-]+/g, "")) : undefined;

      await prisma.asset.upsert({
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
          locationId: locationMap.get(row.locationName),
          status: row.status,
          notes: row.notes
        },
        update: {
          assetTag: row.assetTag,
          type: row.type,
          brand: row.brand,
          model: row.model,
          qrCodeValue: row.qrCodeValue,
          purchaseDate,
          purchasePrice: Number.isFinite(purchasePrice) ? purchasePrice : undefined,
          locationId: locationMap.get(row.locationName),
          status: row.status,
          notes: row.notes
        }
      });
      importedCount += 1;
    } catch {
      errorCount += 1;
    }
  }

  console.log(`Imported: ${importedCount}, Errors: ${errorCount}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
