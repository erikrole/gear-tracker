import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { fail, HttpError, ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { createAuditEntry } from "@/lib/audit";

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

// ── Column mapping ───────────────────────────────────────

type ColumnMapping = Record<string, string>; // csvHeader → fieldName

/** Default Cheqroom preset: maps known Cheqroom headers to our fields */
const CHEQROOM_PRESET: Record<string, string> = {
  "Name": "assetTag",
  "name": "assetTag",
  "Category": "type",
  "Brand": "brand",
  "Model": "model",
  "Serial number": "serialNumber",
  "serial_number": "serialNumber",
  "Quantity": "quantity",
  "Kind": "kind",
  "Warranty Date": "warrantyDate",
  "Purchase Price": "purchasePrice",
  "Purchase Date": "purchaseDate",
  "Residual Value": "residualValue",
  "Location": "locationName",
  "location_name": "locationName",
  "Department": "department",
  "Kit": "kitName",
  "Image Url": "imageUrl",
  "image_url": "imageUrl",
  "UW Asset Tag": "uwAssetTag",
  "uw_asset_tag": "uwAssetTag",
  "Codes": "codes",
  "Barcodes": "barcodes",
  "Id": "sourceId",
  "Retired": "retired",
  "Link": "link",
  "Description": "description",
  "Owner": "owner",
  "Fiscal Year Purchased": "fiscalYear",
  "Flag": "flag",
  "Geo": "geo",
};

function autoDetectMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  for (const header of headers) {
    if (CHEQROOM_PRESET[header]) {
      mapping[header] = CHEQROOM_PRESET[header];
    }
  }
  return mapping;
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
  /** "create" | "update" | "skip" — set during preview with DB lookup */
  action?: string;
};

function getMapped(record: Record<string, string>, mapping: ColumnMapping, field: string): string {
  for (const [csvHeader, targetField] of Object.entries(mapping)) {
    if (targetField === field) {
      const value = record[csvHeader];
      if (value && value.trim()) return value.trim();
    }
  }
  return "";
}

function parseRows(content: string, userMapping?: ColumnMapping): {
  headers: string[];
  rows: NormalizedRow[];
  mapping: ColumnMapping;
} {
  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) {
    throw new HttpError(400, "CSV must include a header and at least one data row");
  }

  const delimiter = lines[0].includes(";") ? ";" : ",";
  const headers = parseDelimitedLine(lines[0], delimiter);
  const mapping = userMapping ?? autoDetectMapping(headers);

  // First pass: collect tags to detect duplicates
  const rawRows: Array<{ record: Record<string, string>; lineNo: number }> = [];
  const tagCounts = new Map<string, number>();

  for (let i = 1; i < lines.length; i += 1) {
    const values = parseDelimitedLine(lines[i], delimiter);
    const record = Object.fromEntries(
      headers.map((h, idx) => [h, values[idx] ?? ""])
    ) as Record<string, string>;
    rawRows.push({ record, lineNo: i + 1 });

    const name = getMapped(record, mapping, "assetTag");
    const tag = name || `import-${i}`;
    tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
  }

  // Second pass: normalize
  const tagUsed = new Map<string, number>();
  const rows: NormalizedRow[] = [];

  for (const { record, lineNo } of rawRows) {
    const warnings: string[] = [];
    const errors: string[] = [];

    const name = getMapped(record, mapping, "assetTag");
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

    const kind = getMapped(record, mapping, "kind").toLowerCase();
    const quantity = parseInt(getMapped(record, mapping, "quantity") || "1", 10) || 1;
    const consumable = kind === "bulk";

    const sourceId = getMapped(record, mapping, "sourceId");
    const serialNumber =
      getMapped(record, mapping, "serialNumber") ||
      `auto-${sourceId || assetTag}`;

    const barcodes = getMapped(record, mapping, "barcodes");
    const codes = getMapped(record, mapping, "codes");
    const primaryScanCode = barcodes || codes || "";
    const qrCodeValue = primaryScanCode || `bg://item/${assetTag}`;

    const locationName = getMapped(record, mapping, "locationName");
    if (!locationName) errors.push("Missing location");

    const retiredRaw = getMapped(record, mapping, "retired").toLowerCase();
    const retired = retiredRaw === "true" || retiredRaw === "yes" || retiredRaw === "1";

    rows.push({
      line: lineNo,
      assetTag,
      assetTagDeduped: deduped,
      name,
      type: getMapped(record, mapping, "type") || "equipment",
      brand: getMapped(record, mapping, "brand") || "Unknown",
      model: getMapped(record, mapping, "model") || "Unknown",
      serialNumber,
      qrCodeValue,
      primaryScanCode,
      purchaseDate: getMapped(record, mapping, "purchaseDate"),
      purchasePrice: getMapped(record, mapping, "purchasePrice"),
      warrantyDate: getMapped(record, mapping, "warrantyDate"),
      residualValue: getMapped(record, mapping, "residualValue"),
      locationName,
      departmentName: getMapped(record, mapping, "department"),
      kitName: getMapped(record, mapping, "kitName"),
      imageUrl: getMapped(record, mapping, "imageUrl"),
      uwAssetTag: getMapped(record, mapping, "uwAssetTag"),
      consumable,
      quantity,
      retired,
      link: getMapped(record, mapping, "link"),
      description: getMapped(record, mapping, "description"),
      owner: getMapped(record, mapping, "owner"),
      fiscalYear: getMapped(record, mapping, "fiscalYear"),
      warnings,
      errors,
    });
  }

  return { headers, rows, mapping };
}

// ── Shared helpers ───────────────────────────────────────

function parseDate(raw: string): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseCurrency(raw: string): number | undefined {
  if (!raw) return undefined;
  const n = Number(raw.replace(/[^\d.-]+/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

function buildAssetData(
  row: NormalizedRow,
  locationId: string,
  departmentId: string | null
) {
  const notesPayload = {
    cheqroomName: row.name || undefined,
    description: row.description || undefined,
    owner: row.owner || undefined,
    fiscalYear: row.fiscalYear || undefined,
    link: row.link || undefined,
  };

  return {
    assetTag: row.assetTag,
    name: row.name || null,
    type: row.type,
    brand: row.brand,
    model: row.model,
    serialNumber: row.serialNumber,
    qrCodeValue: row.qrCodeValue,
    primaryScanCode: row.primaryScanCode || null,
    purchaseDate: parseDate(row.purchaseDate),
    purchasePrice: parseCurrency(row.purchasePrice),
    warrantyDate: parseDate(row.warrantyDate),
    residualValue: parseCurrency(row.residualValue),
    locationId,
    departmentId,
    status: row.retired ? ("RETIRED" as const) : ("AVAILABLE" as const),
    consumable: row.consumable,
    imageUrl: row.imageUrl || null,
    uwAssetTag: row.uwAssetTag || null,
    linkUrl: row.link || null,
    notes: JSON.stringify(notesPayload),
  };
}

// ── POST handler ─────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const user = await requireAuth();
    requirePermission(user.role, "asset", "import");
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get("mode") || "import";

    const formData = await req.formData();
    const file = formData.get("file");
    const mappingRaw = formData.get("mapping");

    if (!(file instanceof File)) {
      throw new HttpError(400, "Expected multipart file field named 'file'");
    }

    const userMapping = mappingRaw
      ? (JSON.parse(mappingRaw as string) as ColumnMapping)
      : undefined;

    const text = await file.text();
    const { headers, rows, mapping } = parseRows(text, userMapping);

    // ── Preview mode (3-4 DB calls) ───────────────────────
    if (mode === "preview") {
      const locationNames = [...new Set(rows.map((r) => r.locationName).filter(Boolean))];
      const departmentNames = [...new Set(rows.map((r) => r.departmentName).filter(Boolean))];
      const kitNames = [...new Set(rows.map((r) => r.kitName).filter(Boolean))];

      // Batch: 2 findMany calls for locations + departments
      const [existingLocations, existingDepartments] = await db.$transaction([
        db.location.findMany({ where: { name: { in: locationNames.length > 0 ? locationNames : ["__none__"] } } }),
        db.department.findMany({ where: { name: { in: departmentNames.length > 0 ? departmentNames : ["__none__"] } } }),
      ]);

      const newLocations = locationNames.filter(
        (n) => !existingLocations.some((l) => l.name === n)
      );
      const newDepartments = departmentNames.filter(
        (n) => !existingDepartments.some((d) => d.name === n)
      );

      // Batch: check for existing assets by serialNumber + assetTag (1 call)
      const allSerials = rows.map((r) => r.serialNumber).filter(Boolean);
      const allTags = rows.map((r) => r.assetTag).filter(Boolean);

      const existingAssets = await db.asset.findMany({
        where: {
          OR: [
            { serialNumber: { in: allSerials.length > 0 ? allSerials : ["__none__"] } },
            { assetTag: { in: allTags.length > 0 ? allTags : ["__none__"] } },
          ],
        },
        select: { id: true, serialNumber: true, assetTag: true },
      });

      const existingBySerial = new Set(existingAssets.map((a) => a.serialNumber));
      const existingByTag = new Set(existingAssets.map((a) => a.assetTag));

      // Mark each row with its action
      let willCreate = 0;
      let willUpdate = 0;
      for (const row of rows) {
        if (row.errors.length > 0) {
          row.action = "skip";
        } else if (existingBySerial.has(row.serialNumber) || existingByTag.has(row.assetTag)) {
          row.action = "update";
          willUpdate += 1;
        } else {
          row.action = "create";
          willCreate += 1;
        }
      }

      return ok({
        headers,
        totalRows: rows.length,
        rows: rows.slice(0, 200),
        mapping,
        summary: {
          totalItems: rows.length,
          willCreate,
          willUpdate,
          withErrors: rows.filter((r) => r.errors.length > 0).length,
          withWarnings: rows.filter((r) => r.warnings.length > 0).length,
          duplicateNames: rows.filter((r) => r.assetTagDeduped).length,
          consumableItems: rows.filter((r) => r.consumable).length,
          retiredItems: rows.filter((r) => r.retired).length,
          locations: locationNames,
          newLocations,
          departments: departmentNames,
          newDepartments,
          kits: kitNames,
        },
      });
    }

    // ── Import mode (batched — target ≤20 DB calls) ───────

    const validRows = rows.filter((r) => r.errors.length === 0);
    const importErrors: Array<{ line: number; assetTag: string; error: string }> = [];
    const skippedCount = rows.length - validRows.length;

    // Collect error rows
    for (const row of rows) {
      if (row.errors.length > 0) {
        importErrors.push({ line: row.line, assetTag: row.assetTag, error: row.errors.join("; ") });
      }
    }

    // 1. Batch: upsert locations + departments via $transaction (1 call)
    const locationNames = [...new Set(validRows.map((r) => r.locationName).filter(Boolean))];
    const deptNames = [...new Set(validRows.map((r) => r.departmentName).filter(Boolean))];

    const locationUpserts = locationNames.map((name) =>
      db.location.upsert({ where: { name }, create: { name }, update: {} })
    );
    const deptUpserts = deptNames.map((name) =>
      db.department.upsert({ where: { name }, create: { name }, update: {} })
    );

    const upsertResults = await db.$transaction([...locationUpserts, ...deptUpserts]);
    const locationMap = new Map<string, string>();
    const deptMap = new Map<string, string>();

    for (let i = 0; i < locationNames.length; i++) {
      locationMap.set(locationNames[i], upsertResults[i].id);
    }
    for (let i = 0; i < deptNames.length; i++) {
      deptMap.set(deptNames[i], upsertResults[locationNames.length + i].id);
    }

    // 2. Batch: find existing assets by serialNumber + assetTag (1 call)
    const allSerials = validRows.map((r) => r.serialNumber);
    const allTags = validRows.map((r) => r.assetTag);

    const existingAssets = await db.asset.findMany({
      where: {
        OR: [
          { serialNumber: { in: allSerials } },
          { assetTag: { in: allTags } },
        ],
      },
      select: { id: true, serialNumber: true, assetTag: true, qrCodeValue: true },
    });

    const existingBySerial = new Map(existingAssets.map((a) => [a.serialNumber, a]));
    const existingByTag = new Map(existingAssets.map((a) => [a.assetTag, a]));

    // 3. Split rows into creates vs updates
    const toCreate: Array<ReturnType<typeof buildAssetData>> = [];
    const toUpdate: Array<{ id: string; data: Record<string, unknown> }> = [];
    let createdCount = 0;
    let updatedCount = 0;

    for (const row of validRows) {
      const locationId = locationMap.get(row.locationName);
      if (!locationId) {
        importErrors.push({ line: row.line, assetTag: row.assetTag, error: "Location not resolved" });
        continue;
      }

      const departmentId = row.departmentName ? deptMap.get(row.departmentName) ?? null : null;

      const existing = existingBySerial.get(row.serialNumber) ?? existingByTag.get(row.assetTag);

      if (existing) {
        // Update: reuse existing qrCodeValue to avoid unique constraint conflicts
        const data = buildAssetData(row, locationId, departmentId);
        const { serialNumber: _sn, qrCodeValue: _qr, ...updateData } = data;
        toUpdate.push({ id: existing.id, data: updateData });
        updatedCount += 1;
      } else {
        toCreate.push(buildAssetData(row, locationId, departmentId));
        createdCount += 1;
      }
    }

    // 4. Batch: create new assets (1 call)
    if (toCreate.length > 0) {
      await db.asset.createMany({ data: toCreate, skipDuplicates: true });
    }

    // 5. Batch: update existing assets via $transaction (1 call)
    if (toUpdate.length > 0) {
      const updateOps = toUpdate.map(({ id, data }) =>
        db.asset.update({ where: { id }, data })
      );
      await db.$transaction(updateOps);
    }

    // 6. Batch: kit creation + membership (1-2 calls)
    const kitNames = [...new Set(validRows.filter((r) => r.kitName).map((r) => r.kitName))];
    let kitsCreated = 0;

    if (kitNames.length > 0) {
      // Upsert all kits in one transaction
      const kitUpserts = kitNames.map((kitName) => {
        const firstRow = validRows.find((r) => r.kitName === kitName && r.locationName);
        const kitLocationId = firstRow ? locationMap.get(firstRow.locationName) : null;
        if (!kitLocationId) return null;
        return db.kit.upsert({
          where: { name_locationId: { name: kitName, locationId: kitLocationId } },
          create: { name: kitName, locationId: kitLocationId },
          update: {},
        });
      }).filter(Boolean) as ReturnType<typeof db.kit.upsert>[];

      if (kitUpserts.length > 0) {
        const kits = await db.$transaction(kitUpserts);
        kitsCreated = kitUpserts.length;

        // Look up all assets that belong to kits (1 call)
        const kitRowSerials = validRows.filter((r) => r.kitName).map((r) => r.serialNumber);
        const kitAssets = await db.asset.findMany({
          where: { serialNumber: { in: kitRowSerials } },
          select: { id: true, serialNumber: true },
        });
        const assetBySerial = new Map(kitAssets.map((a) => [a.serialNumber, a.id]));

        // Build kit name → kit id map
        const kitMap = new Map<string, string>();
        const validKitNames = kitNames.filter((_, i) => {
          const firstRow = validRows.find((r) => r.kitName === kitNames[i] && r.locationName);
          return firstRow && locationMap.get(firstRow.locationName);
        });
        for (let i = 0; i < validKitNames.length; i++) {
          kitMap.set(validKitNames[i], kits[i].id);
        }

        // Batch: create all kit memberships (1 call)
        const memberships: Array<{ kitId: string; assetId: string }> = [];
        for (const row of validRows) {
          if (!row.kitName) continue;
          const kitId = kitMap.get(row.kitName);
          const assetId = assetBySerial.get(row.serialNumber);
          if (kitId && assetId) {
            memberships.push({ kitId, assetId });
          }
        }

        if (memberships.length > 0) {
          await db.kitMembership.createMany({ data: memberships, skipDuplicates: true });
        }
      }
    }

    // 7. Audit log (1 call)
    await createAuditEntry({
      actorId: user.id,
      actorRole: user.role,
      entityType: "import",
      entityId: "cheqroom",
      action: "csv_import",
      after: {
        created: createdCount,
        updated: updatedCount,
        skipped: skippedCount,
        kitsCreated,
        errorCount: importErrors.length,
      },
    });

    return ok({
      created: createdCount,
      updated: updatedCount,
      skipped: skippedCount,
      kitsCreated,
      errors: importErrors,
    });
  } catch (error) {
    return fail(error);
  }
}
