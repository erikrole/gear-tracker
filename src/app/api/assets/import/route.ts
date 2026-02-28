export const runtime = "edge";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { fail, HttpError, ok } from "@/lib/http";

// ── CSV parsing ──────────────────────────────────────────

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

// ── Row normalization ────────────────────────────────────

type NormalizedRow = {
  line: number;
  assetTag: string;
  assetTagDeduped: boolean;
  name: string;
  type: string;
  brand: string;
  model: string;
  serialNumber: string;
  qrCodeValue: string;
  primaryScanCode: string;
  purchaseDate: string;
  purchasePrice: string;
  warrantyDate: string;
  residualValue: string;
  locationName: string;
  departmentName: string;
  kitName: string;
  imageUrl: string;
  uwAssetTag: string;
  consumable: boolean;
  quantity: number;
  retired: boolean;
  link: string;
  description: string;
  owner: string;
  fiscalYear: string;
  warnings: string[];
  errors: string[];
};

function get(record: Record<string, string>, ...keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (value && value.trim()) return value.trim();
  }
  return "";
}

function normalizeRows(content: string): { headers: string[]; rows: NormalizedRow[] } {
  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) {
    throw new HttpError(400, "CSV must include a header and at least one data row");
  }

  const delimiter = lines[0].includes(";") ? ";" : ",";
  const headers = parseDelimitedLine(lines[0], delimiter);

  // First pass: collect all names to detect duplicates
  const rawRows: Array<{ record: Record<string, string>; lineNo: number }> = [];
  const tagCounts = new Map<string, number>();

  for (let i = 1; i < lines.length; i += 1) {
    const values = parseDelimitedLine(lines[i], delimiter);
    const record = Object.fromEntries(
      headers.map((h, idx) => [h, values[idx] ?? ""])
    ) as Record<string, string>;
    rawRows.push({ record, lineNo: i + 1 });

    const name = get(record, "Name", "name", "asset_tag");
    const tag = name || `import-${i}`;
    tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
  }

  // Second pass: normalize with deduplication
  const tagUsed = new Map<string, number>();
  const rows: NormalizedRow[] = [];

  for (const { record, lineNo } of rawRows) {
    const warnings: string[] = [];
    const errors: string[] = [];

    const name = get(record, "Name", "name", "asset_tag");
    const baseTag = name || `import-${lineNo - 1}`;

    let assetTag = baseTag;
    let deduped = false;
    if ((tagCounts.get(baseTag) ?? 0) > 1) {
      const count = tagUsed.get(baseTag) ?? 0;
      tagUsed.set(baseTag, count + 1);
      if (count > 0) {
        assetTag = `${baseTag}-${count}`;
        deduped = true;
        warnings.push(`Duplicate name "${baseTag}" → renamed to "${assetTag}"`);
      }
    }

    const kind = get(record, "Kind", "kind").toLowerCase();
    const quantity = parseInt(get(record, "Quantity", "quantity") || "1", 10) || 1;
    const consumable = kind === "bulk";

    const sourceId = get(record, "Id", "id");
    const serialNumber =
      get(record, "Serial number", "serial_number") ||
      `auto-${sourceId || assetTag}`;

    const barcodes = get(record, "Barcodes", "barcodes");
    const codes = get(record, "Codes", "codes");
    const primaryScanCode = barcodes || codes || "";
    const qrCodeValue = primaryScanCode || `bg://item/${assetTag}`;

    const locationName = get(record, "Location", "location_name");
    if (!locationName) errors.push("Missing location");

    const retiredRaw = get(record, "Retired", "retired").toLowerCase();
    const retired = retiredRaw === "true" || retiredRaw === "yes" || retiredRaw === "1";

    rows.push({
      line: lineNo,
      assetTag,
      assetTagDeduped: deduped,
      name,
      type: get(record, "Category", "type") || "equipment",
      brand: get(record, "Brand", "brand") || "Unknown",
      model: get(record, "Model", "model") || "Unknown",
      serialNumber,
      qrCodeValue,
      primaryScanCode,
      purchaseDate: get(record, "Purchase Date", "purchase_date"),
      purchasePrice: get(record, "Purchase Price", "purchase_price"),
      warrantyDate: get(record, "Warranty Date", "warranty_date"),
      residualValue: get(record, "Residual Value", "residual_value"),
      locationName,
      departmentName: get(record, "Department", "department"),
      kitName: get(record, "Kit", "kit"),
      imageUrl: get(record, "Image Url", "image_url"),
      uwAssetTag: get(record, "UW Asset Tag", "uw_asset_tag"),
      consumable,
      quantity,
      retired,
      link: get(record, "Link", "link"),
      description: get(record, "Description", "description"),
      owner: get(record, "Owner", "owner"),
      fiscalYear: get(record, "Fiscal Year Purchased", "fiscal_year_purchased"),
      warnings,
      errors
    });
  }

  return { headers, rows };
}

// ── POST handler ─────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get("mode") || "import";

    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      throw new HttpError(400, "Expected multipart file field named 'file'");
    }

    const text = await file.text();
    const { headers, rows } = normalizeRows(text);

    // ── Preview mode ─────────────────────────────────────
    if (mode === "preview") {
      const locationNames = [...new Set(rows.map((r) => r.locationName).filter(Boolean))];
      const departmentNames = [...new Set(rows.map((r) => r.departmentName).filter(Boolean))];
      const kitNames = [...new Set(rows.map((r) => r.kitName).filter(Boolean))];

      const existingLocations = locationNames.length > 0
        ? await db.location.findMany({ where: { name: { in: locationNames } } })
        : [];
      const existingDepartments = departmentNames.length > 0
        ? await db.department.findMany({ where: { name: { in: departmentNames } } })
        : [];

      const newLocations = locationNames.filter(
        (n) => !existingLocations.some((l) => l.name === n)
      );
      const newDepartments = departmentNames.filter(
        (n) => !existingDepartments.some((d) => d.name === n)
      );

      return ok({
        headers,
        totalRows: rows.length,
        rows: rows.slice(0, 200),
        summary: {
          totalItems: rows.length,
          withErrors: rows.filter((r) => r.errors.length > 0).length,
          withWarnings: rows.filter((r) => r.warnings.length > 0).length,
          duplicateNames: rows.filter((r) => r.assetTagDeduped).length,
          consumableItems: rows.filter((r) => r.consumable).length,
          retiredItems: rows.filter((r) => r.retired).length,
          locations: locationNames,
          newLocations,
          departments: departmentNames,
          newDepartments,
          kits: kitNames
        }
      });
    }

    // ── Import mode ──────────────────────────────────────

    // 1. Auto-create locations
    const locationNames = [...new Set(rows.map((r) => r.locationName).filter(Boolean))];
    const existingLocations = await db.location.findMany({ where: { name: { in: locationNames } } });
    const locationMap = new Map(existingLocations.map((l) => [l.name, l.id]));

    for (const name of locationNames) {
      if (!locationMap.has(name)) {
        const created = await db.location.create({ data: { name } });
        locationMap.set(name, created.id);
      }
    }

    // 2. Auto-create departments
    const deptNames = [...new Set(rows.map((r) => r.departmentName).filter(Boolean))];
    const existingDepts = deptNames.length > 0
      ? await db.department.findMany({ where: { name: { in: deptNames } } })
      : [];
    const deptMap = new Map(existingDepts.map((d) => [d.name, d.id]));

    for (const name of deptNames) {
      if (!deptMap.has(name)) {
        const created = await db.department.create({ data: { name } });
        deptMap.set(name, created.id);
      }
    }

    // 3. Import assets
    const importErrors: Array<{ line: number; assetTag: string; error: string }> = [];
    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    for (const row of rows) {
      if (row.errors.length > 0) {
        skippedCount += 1;
        importErrors.push({ line: row.line, assetTag: row.assetTag, error: row.errors.join("; ") });
        continue;
      }

      const locationId = locationMap.get(row.locationName);
      if (!locationId) {
        skippedCount += 1;
        importErrors.push({ line: row.line, assetTag: row.assetTag, error: "Location not found" });
        continue;
      }

      const departmentId = row.departmentName ? deptMap.get(row.departmentName) ?? null : null;

      try {
        const parsedPurchaseDate = row.purchaseDate ? new Date(row.purchaseDate) : null;
        const purchaseDate =
          parsedPurchaseDate && !Number.isNaN(parsedPurchaseDate.getTime())
            ? parsedPurchaseDate
            : null;

        const parsedWarrantyDate = row.warrantyDate ? new Date(row.warrantyDate) : null;
        const warrantyDate =
          parsedWarrantyDate && !Number.isNaN(parsedWarrantyDate.getTime())
            ? parsedWarrantyDate
            : null;

        const purchasePrice = row.purchasePrice
          ? Number(row.purchasePrice.replace(/[^\d.-]+/g, ""))
          : undefined;

        const residualValue = row.residualValue
          ? Number(row.residualValue.replace(/[^\d.-]+/g, ""))
          : undefined;

        const status = row.retired ? "RETIRED" as const : "AVAILABLE" as const;

        const notesPayload = {
          cheqroomName: row.name || undefined,
          description: row.description || undefined,
          owner: row.owner || undefined,
          fiscalYear: row.fiscalYear || undefined,
          link: row.link || undefined
        };

        const data = {
          assetTag: row.assetTag,
          name: row.name || null,
          type: row.type,
          brand: row.brand,
          model: row.model,
          qrCodeValue: row.qrCodeValue,
          primaryScanCode: row.primaryScanCode || null,
          purchaseDate,
          purchasePrice: Number.isFinite(purchasePrice) ? purchasePrice : undefined,
          warrantyDate,
          residualValue: Number.isFinite(residualValue) ? residualValue : undefined,
          locationId,
          departmentId,
          status,
          consumable: row.consumable,
          imageUrl: row.imageUrl || null,
          uwAssetTag: row.uwAssetTag || null,
          notes: JSON.stringify(notesPayload)
        };

        const existing = await db.asset.findUnique({
          where: { serialNumber: row.serialNumber },
          select: { id: true }
        });

        if (existing) {
          await db.asset.update({ where: { serialNumber: row.serialNumber }, data });
          updatedCount += 1;
        } else {
          await db.asset.create({ data: { ...data, serialNumber: row.serialNumber } });
          createdCount += 1;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "unknown error";
        importErrors.push({ line: row.line, assetTag: row.assetTag, error: message.slice(0, 300) });
        skippedCount += 1;
      }
    }

    // 4. Create kits and memberships
    const kitNames = [...new Set(rows.filter((r) => r.kitName).map((r) => r.kitName))];
    let kitsCreated = 0;

    for (const kitName of kitNames) {
      const kitRows = rows.filter((r) => r.kitName === kitName);
      const firstLocation = kitRows.find((r) => r.locationName)?.locationName;
      const kitLocationId = firstLocation ? locationMap.get(firstLocation) : null;
      if (!kitLocationId) continue;

      try {
        const kit = await db.kit.upsert({
          where: { name_locationId: { name: kitName, locationId: kitLocationId } },
          create: { name: kitName, locationId: kitLocationId },
          update: {}
        });

        for (const row of kitRows) {
          const asset = await db.asset.findUnique({
            where: { serialNumber: row.serialNumber },
            select: { id: true }
          });
          if (!asset) continue;

          await db.kitMembership.upsert({
            where: { kitId_assetId: { kitId: kit.id, assetId: asset.id } },
            create: { kitId: kit.id, assetId: asset.id },
            update: {}
          });
        }
        kitsCreated += 1;
      } catch {
        // Kit creation failures are non-fatal
      }
    }

    // 5. Audit log
    await db.auditLog.create({
      data: {
        actorUserId: user.id,
        entityType: "import",
        entityId: "cheqroom",
        action: "csv_import",
        afterJson: {
          created: createdCount,
          updated: updatedCount,
          skipped: skippedCount,
          kitsCreated,
          errorCount: importErrors.length
        }
      }
    });

    return ok({
      created: createdCount,
      updated: updatedCount,
      skipped: skippedCount,
      kitsCreated,
      errors: importErrors
    });
  } catch (error) {
    return fail(error);
  }
}
