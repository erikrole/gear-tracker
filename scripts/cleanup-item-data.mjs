import fs from "node:fs/promises";
import path from "node:path";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";

const APPLY = process.argv.includes("--apply");
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("DATABASE_URL is required for item data cleanup.");
  process.exit(1);
}

const db = new PrismaClient({
  adapter: new PrismaNeon({ connectionString }),
});

const ACTION_SOURCE = "item-data-cleanup-2026-06";

function compact(value) {
  return (value ?? "").toString().trim();
}

function normalize(value) {
  return compact(value).toLowerCase();
}

function includesAny(text, terms) {
  return terms.some((term) => text.includes(term));
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function printRows(title, rows, formatter) {
  console.log(`\n## ${title}`);
  if (rows.length === 0) {
    console.log("- none");
    return;
  }

  for (const row of rows) {
    console.log(`- ${formatter(row)}`);
  }
}

function afterAsset(asset, data) {
  return {
    id: asset.id,
    assetTag: asset.assetTag,
    status: data.status ?? asset.status,
    brand: data.brand ?? asset.brand,
    model: data.model ?? asset.model,
    serialNumber: data.serialNumber ?? asset.serialNumber,
    imageUrl: data.imageUrl ?? asset.imageUrl,
    categoryId: data.categoryId ?? asset.categoryId,
    departmentId: data.departmentId ?? asset.departmentId,
    qrCodeValue: data.qrCodeValue ?? asset.qrCodeValue,
    primaryScanCode: data.primaryScanCode ?? asset.primaryScanCode,
    parentAssetId: data.parentAssetId ?? asset.parentAssetId,
    availableForCheckout: data.availableForCheckout ?? asset.availableForCheckout,
    availableForReservation: data.availableForReservation ?? asset.availableForReservation,
    availableForCustody: data.availableForCustody ?? asset.availableForCustody,
  };
}

function beforeAsset(asset) {
  return afterAsset(asset, {});
}

function afterBulkSku(sku, data) {
  return {
    id: sku.id,
    name: data.name ?? sku.name,
    category: data.category ?? sku.category,
    categoryId: data.categoryId ?? sku.categoryId,
    departmentId: data.departmentId ?? sku.departmentId,
    imageUrl: data.imageUrl ?? sku.imageUrl,
  };
}

function beforeBulkSku(sku) {
  return afterBulkSku(sku, {});
}

function buildCategoryPath(category, byId) {
  const parts = [];
  let current = category;
  const seen = new Set();

  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    parts.unshift(current.name);
    current = current.parentId ? byId.get(current.parentId) : null;
  }

  return parts.join("/");
}

function categoryIdFor(pathName, categoryPaths) {
  return categoryPaths.get(pathName) ?? null;
}

function departmentIdFor(name, departmentsByName) {
  return departmentsByName.get(name) ?? null;
}

function suggestCategoryPath({ name, brand, model, type, legacyCategory }) {
  const joined = normalize([name, brand, model, type, legacyCategory].join(" "));
  const source = normalize(legacyCategory || type);

  if (includesAny(joined, ["sandbag", "milk crate"])) return "Lighting";
  if (includesAny(joined, ["lens cap", "front cap", "rear cap"])) return "Lenses/Accessories";
  if (includesAny(joined, ["nd filter", "variable nd", "filter"])) return "Lenses/ND Filters";
  if (includesAny(joined, ["tripod"])) return "Tripods/Tripods";
  if (includesAny(joined, ["monopod"])) return "Tripods/Monopods";
  if (includesAny(joined, ["gimbal", "ronin", "rs 3", "rs3"])) return "Gimbal";
  if (includesAny(joined, ["charger", "charge station", "charging"])) return "Batteries/Chargers";
  if (includesAny(joined, ["battery", "eneloop", "np-f", "np f", "gold-mount", "v-mount"])) return "Batteries/Batteries";
  if (includesAny(joined, ["sdxc", "sd card", "uhs-ii", "memory card"])) return "Media Storage/SD Cards";
  if (includesAny(joined, ["ssd", "solid state", "extreme pro portable"])) return "Media Storage/SSDs";
  if (includesAny(joined, ["hard drive", "hdd", "g-drive", "g drive"])) return "Media Storage/HDDs";
  if (includesAny(joined, ["lav", "microphone", "mic ", "shotgun", "recorder", "tascam", "headphone", "headset", "xlr"])) return "Audio/Microphones";
  if (includesAny(joined, ["cage", "top plate", "baseplate", "monitor mount", "handle", "cheese plate", "camera accessory"])) return "Cameras/Accessories";
  if (includesAny(joined, ["fx3", "fx30", "a7", "ilce", "ilme", "camera body", "camcorder"])) return "Cameras/Camera Bodies";
  if (includesAny(joined, ["lens ", "tamron", "sony fe", "sigma "])) return "Lenses/Lenses";
  if (includesAny(joined, ["keyboard", "mouse", "trackpad", "monitor arm", "dock"])) return "Office/Peripherals";
  if (includesAny(joined, ["computer monitor", "display"])) return "Office/Monitors";
  if (includesAny(joined, ["backpack", "sling", "case"])) return "Office/Backpacks";
  if (includesAny(joined, ["flash", "strobe", "light stand", "aputure", "nanlite", "godox", "led light"])) return "Lighting";

  if (source === "audio/microphones") return "Audio/Microphones";
  if (source === "batteries" || source === "batteries/batteries") return "Batteries/Batteries";
  if (source === "chargers" || source === "batteries/chargers") return "Batteries/Chargers";
  if (source === "cameras/bodies") return "Cameras/Camera Bodies";
  if (source === "cameras/camera accessories") return "Cameras/Accessories";
  if (source === "gimbals") return "Gimbal";
  if (source === "lenses") return "Lenses/Lenses";
  if (source === "media storage/sd cards") return "Media Storage/SD Cards";
  if (source === "media storage/hard drives") return includesAny(joined, ["ssd", "solid state"]) ? "Media Storage/SSDs" : "Media Storage/HDDs";
  if (source === "office/backpacks") return "Office/Backpacks";
  if (source === "recording equipment/tripods") return "Tripods/Tripods";
  if (source === "recording equipment/monopods") return "Tripods/Monopods";
  if (source === "filters") return "Lenses/ND Filters";
  if (source === "flash") return "Lighting";

  return null;
}

function suggestDepartmentId({ name, category }, departmentsByName) {
  const joined = normalize([name, category].join(" "));
  if (includesAny(joined, ["football"])) return departmentIdFor("Football", departmentsByName);
  if (includesAny(joined, ["basketball", "mbb"])) return departmentIdFor("Men's Basketball", departmentsByName);
  if (includesAny(joined, ["photo", "photography"])) return departmentIdFor("Photography", departmentsByName);
  if (includesAny(joined, ["live production"])) return departmentIdFor("Live Production", departmentsByName);
  return departmentIdFor("Video", departmentsByName);
}

function scanValueOwners(assets, bulkSkus, plannedAssetUpdates) {
  const ownerMap = new Map();
  const addOwner = (value, owner) => {
    const key = normalize(value);
    if (!key) return;
    if (!ownerMap.has(key)) ownerMap.set(key, []);
    ownerMap.get(key).push(owner);
  };

  for (const asset of assets) {
    const planned = plannedAssetUpdates.get(asset.id) ?? {};
    addOwner(asset.assetTag, { kind: "asset", id: asset.id, source: "assetTag" });
    addOwner(planned.qrCodeValue ?? asset.qrCodeValue, { kind: "asset", id: asset.id, source: "qrCodeValue" });
    addOwner(planned.primaryScanCode ?? asset.primaryScanCode, { kind: "asset", id: asset.id, source: "primaryScanCode" });
  }

  for (const sku of bulkSkus) {
    if (!sku.active) continue;
    addOwner(sku.binQrCodeValue, { kind: "bulkSku", id: sku.id, source: "bulkBinQr" });
  }

  return ownerMap;
}

function safeBackfillActions(assets, bulkSkus, plannedAssetUpdates) {
  const owners = scanValueOwners(assets, bulkSkus, plannedAssetUpdates);
  const actions = [];
  const skipped = [];

  for (const asset of assets) {
    const planned = plannedAssetUpdates.get(asset.id) ?? {};
    const status = planned.status ?? asset.status;
    const currentPrimary = planned.primaryScanCode ?? asset.primaryScanCode;
    const qrCodeValue = planned.qrCodeValue ?? asset.qrCodeValue;

    if (status === "RETIRED") continue;
    if (compact(currentPrimary)) continue;
    if (!compact(qrCodeValue)) {
      skipped.push({ assetTag: asset.assetTag, reason: "missing qrCodeValue" });
      continue;
    }

    const matchingOwners = owners.get(normalize(qrCodeValue)) ?? [];
    const foreignOwners = matchingOwners.filter((owner) => owner.kind !== "asset" || owner.id !== asset.id);
    if (foreignOwners.length > 0) {
      skipped.push({
        assetTag: asset.assetTag,
        proposed: qrCodeValue,
        reason: `collides with ${foreignOwners.map((owner) => `${owner.kind}:${owner.id}:${owner.source}`).join(", ")}`,
      });
      continue;
    }

    actions.push({
      type: "assetPrimaryScanBackfill",
      asset,
      data: { primaryScanCode: qrCodeValue },
    });
  }

  return { actions, skipped };
}

async function main() {
  const [categories, departments, assets, bulkSkus] = await Promise.all([
    db.category.findMany({ orderBy: [{ name: "asc" }] }),
    db.department.findMany({ orderBy: [{ name: "asc" }] }),
    db.asset.findMany({ orderBy: [{ assetTag: "asc" }] }),
    db.bulkSku.findMany({ orderBy: [{ name: "asc" }] }),
  ]);

  const categoriesById = new Map(categories.map((category) => [category.id, category]));
  const categoryPaths = new Map(categories.map((category) => [buildCategoryPath(category, categoriesById), category.id]));
  const departmentsByName = new Map(departments.map((department) => [department.name, department.id]));

  const plannedAssetUpdates = new Map();
  const taxonomyActions = [];
  const assetMetadataActions = [];
  const bulkTaxonomyActions = [];
  const bulkLegacyCategoryActions = [];
  const bulkNameActions = [];
  const bulkImageActions = [];
  const duplicateActions = [];
  const attachmentActions = [];
  const taxonomySkipped = [];
  const bulkSkipped = [];
  const bulkImageSkipped = [];
  const duplicateSkipped = [];
  const attachmentReview = [];

  const bulkScanValues = new Map();
  for (const sku of bulkSkus) {
    if (!sku.active || !compact(sku.binQrCodeValue)) continue;
    bulkScanValues.set(normalize(sku.binQrCodeValue), sku);
  }

  for (const asset of assets) {
    const matchedSku = bulkScanValues.get(normalize(asset.qrCodeValue)) ?? bulkScanValues.get(normalize(asset.primaryScanCode));
    if (!matchedSku || asset.status === "RETIRED") continue;

    const hasActiveAllocation = await db.assetAllocation.count({
      where: {
        assetId: asset.id,
        active: true,
      },
    });

    if (hasActiveAllocation > 0) {
      duplicateSkipped.push({ assetTag: asset.assetTag, sku: matchedSku.name, reason: "active asset allocation" });
      continue;
    }

    const retiredScan = `retired-${asset.id}`;
    const data = {
      status: "RETIRED",
      qrCodeValue: retiredScan,
      primaryScanCode: retiredScan,
      availableForCheckout: false,
      availableForReservation: false,
      availableForCustody: false,
    };
    duplicateActions.push({ type: "assetDuplicateFamilyRetire", asset, sku: matchedSku, data });
    plannedAssetUpdates.set(asset.id, { ...(plannedAssetUpdates.get(asset.id) ?? {}), ...data });
  }

  for (const asset of assets) {
    if (asset.categoryId) continue;

    const categoryPath = suggestCategoryPath(asset);
    const categoryId = categoryPath ? categoryIdFor(categoryPath, categoryPaths) : null;

    if (!categoryId) {
      taxonomySkipped.push({
        assetTag: asset.assetTag,
        name: asset.name,
        type: asset.type,
        reason: categoryPath ? `missing category path ${categoryPath}` : "no deterministic category rule",
      });
      continue;
    }

    taxonomyActions.push({
      type: "assetTaxonomy",
      asset,
      categoryPath,
      data: { categoryId },
    });
  }

  for (const asset of assets) {
    const name = normalize(asset.name);
    const linkUrl = normalize(asset.linkUrl);
    const data = {};
    let reason = null;

    if (normalize(asset.brand) === "unknown" && name.includes("dell ultrasharp") && asset.model === "U3824DW") {
      data.brand = "Dell";
      reason = "name/model/link identify Dell U3824DW";
    } else if (
      asset.assetTag === "Monitor Battery"
      && normalize(asset.brand) === "unknown"
      && normalize(asset.model) === "unknown"
      && linkUrl.includes("watson_b_4205_np_f770")
    ) {
      data.brand = "Watson";
      data.model = "B-4205";
      reason = "B&H link identifies Watson B-4205 NP-F770 battery pack";
    } else if (asset.assetTag === "SMOKE-20260512-1" && asset.status !== "RETIRED") {
      data.status = "RETIRED";
      data.availableForCheckout = false;
      data.availableForReservation = false;
      data.availableForCustody = false;
      reason = "active smoke-test asset has no booking, allocation, scan, kit, or attachment history";
    }

    if (Object.keys(data).length > 0) {
      assetMetadataActions.push({
        type: "assetMetadata",
        asset,
        reason,
        data,
      });
      plannedAssetUpdates.set(asset.id, { ...(plannedAssetUpdates.get(asset.id) ?? {}), ...data });
    }
  }

  for (const sku of bulkSkus) {
    if (!sku.active) continue;
    const data = {};
    let categoryPath = null;

    if (!sku.categoryId) {
      categoryPath = suggestCategoryPath({
        name: sku.name,
        brand: "",
        model: "",
        type: "",
        legacyCategory: sku.category,
      });
      const categoryId = categoryPath ? categoryIdFor(categoryPath, categoryPaths) : null;
      if (categoryId) {
        data.categoryId = categoryId;
        data.category = categoriesById.get(categoryId)?.name ?? sku.category;
      } else {
        bulkSkipped.push({
          name: sku.name,
          category: sku.category,
          reason: categoryPath ? `missing category path ${categoryPath}` : "no deterministic category rule",
        });
      }
    }

    if (!sku.departmentId) {
      const departmentId = suggestDepartmentId({ name: sku.name, category: sku.category }, departmentsByName);
      if (departmentId) data.departmentId = departmentId;
      else bulkSkipped.push({ name: sku.name, category: sku.category, reason: "no deterministic department rule" });
    }

    if (Object.keys(data).length > 0) {
      bulkTaxonomyActions.push({
        type: "bulkTaxonomy",
        sku,
        categoryPath,
        data,
      });
    }
  }

  for (const sku of bulkSkus) {
    if (!sku.categoryId) continue;
    const category = categoriesById.get(sku.categoryId);
    if (!category) continue;
    if (compact(sku.category) === category.name) continue;

    bulkLegacyCategoryActions.push({
      type: "bulkLegacyCategory",
      sku,
      data: { category: category.name },
    });
  }

  for (const sku of bulkSkus) {
    if (!sku.active) continue;
    if (sku.binQrCodeValue === "94e068d1" && sku.name === "Sony Battery") {
      bulkNameActions.push({
        type: "bulkName",
        sku,
        data: { name: "Sony NP-FZ100 Battery" },
        reason: "retired duplicate asset with matching former scan identity stores model NP-FZ100 and B&H source link",
      });
    }
  }

  const activeAssetImagesByName = new Map();
  for (const asset of assets) {
    if (asset.status === "RETIRED" || !compact(asset.imageUrl)) continue;
    const key = normalize(asset.name);
    if (!key) continue;
    if (!activeAssetImagesByName.has(key)) activeAssetImagesByName.set(key, []);
    activeAssetImagesByName.get(key).push(asset);
  }

  for (const sku of bulkSkus) {
    if (!sku.active || compact(sku.imageUrl)) continue;
    const matches = activeAssetImagesByName.get(normalize(sku.name)) ?? [];
    const imageUrls = unique(matches.map((match) => match.imageUrl));

    if (imageUrls.length === 1) {
      bulkImageActions.push({
        type: "bulkImageBackfill",
        sku,
        sourceAsset: matches.find((match) => match.imageUrl === imageUrls[0]),
        data: { imageUrl: imageUrls[0] },
      });
      continue;
    }

    bulkImageSkipped.push({
      name: sku.name,
      reason: imageUrls.length === 0 ? "no exact active asset image match" : "multiple exact image matches",
      matches: matches.map((match) => match.assetTag),
    });
  }

  for (const asset of assets) {
    const planned = plannedAssetUpdates.get(asset.id) ?? {};
    if ((planned.status ?? asset.status) === "RETIRED") continue;
    if (asset.parentAssetId) continue;

    const text = normalize([asset.assetTag, asset.name, asset.brand, asset.model, asset.type].join(" "));
    if (!includesAny(text, ["handle", "cage", "top plate", "baseplate", "lens cap", "grip"])) continue;

    const exactParentTag = compact(asset.assetTag).replace(/\s+(handle|cage|top plate|baseplate|lens cap|grip)$/i, "");
    const parent = exactParentTag
      ? assets.find((candidate) => normalize(candidate.assetTag) === normalize(exactParentTag))
      : null;

    if (parent && parent.id !== asset.id && parent.status !== "RETIRED") {
      const data = {
        parentAssetId: parent.id,
        availableForCheckout: false,
        availableForReservation: false,
        availableForCustody: false,
      };
      attachmentActions.push({ type: "assetAttachment", asset, parent, data });
      plannedAssetUpdates.set(asset.id, { ...(plannedAssetUpdates.get(asset.id) ?? {}), ...data });
      continue;
    }

    attachmentReview.push({
      assetTag: asset.assetTag,
      name: asset.name,
      brand: asset.brand,
      model: asset.model,
      type: asset.type,
      reason: exactParentTag ? `no active parent assetTag ${exactParentTag}` : "no parseable parent tag",
    });
  }

  const { actions: primaryBackfillActions, skipped: primarySkipped } = safeBackfillActions(
    assets,
    bulkSkus,
    plannedAssetUpdates,
  );

  const actions = [
    ...duplicateActions,
    ...taxonomyActions,
    ...assetMetadataActions,
    ...bulkTaxonomyActions,
    ...bulkLegacyCategoryActions,
    ...bulkNameActions,
    ...bulkImageActions,
    ...attachmentActions,
    ...primaryBackfillActions,
  ];

  const dryRun = {
    generatedAt: new Date().toISOString(),
    apply: APPLY,
    counts: {
      duplicateRetirements: duplicateActions.length,
      assetTaxonomyUpdates: taxonomyActions.length,
      assetMetadataUpdates: assetMetadataActions.length,
      bulkTaxonomyUpdates: bulkTaxonomyActions.length,
      bulkLegacyCategoryUpdates: bulkLegacyCategoryActions.length,
      bulkNameUpdates: bulkNameActions.length,
      bulkImageBackfills: bulkImageActions.length,
      attachmentUpdates: attachmentActions.length,
      primaryScanBackfills: primaryBackfillActions.length,
      skippedAssetTaxonomy: taxonomySkipped.length,
      skippedBulkTaxonomy: bulkSkipped.length,
      skippedBulkImageBackfills: bulkImageSkipped.length,
      skippedDuplicates: duplicateSkipped.length,
      skippedPrimaryScanBackfills: primarySkipped.length,
      attachmentReviewRows: attachmentReview.length,
    },
    actions: actions.map((action) => {
      if (action.asset) {
        return {
          type: action.type,
          assetTag: action.asset.assetTag,
          name: action.asset.name,
          before: beforeAsset(action.asset),
          after: afterAsset(action.asset, action.data),
          sku: action.sku?.name,
          parentAssetTag: action.parent?.assetTag,
          categoryPath: action.categoryPath,
          reason: action.reason,
        };
      }

      return {
        type: action.type,
        name: action.sku.name,
        before: beforeBulkSku(action.sku),
        after: afterBulkSku(action.sku, action.data),
        categoryPath: action.categoryPath,
        sourceAssetTag: action.sourceAsset?.assetTag,
      };
    }),
    skipped: {
      taxonomy: taxonomySkipped,
      bulkTaxonomy: bulkSkipped,
      bulkImageBackfill: bulkImageSkipped,
      duplicates: duplicateSkipped,
      primaryScanBackfill: primarySkipped,
      attachmentReview,
    },
  };

  console.log(`# Item Data Cleanup ${APPLY ? "Apply" : "Dry Run"}`);
  console.log(`Generated: ${dryRun.generatedAt}`);
  console.log(`Total planned actions: ${actions.length}`);
  for (const [key, value] of Object.entries(dryRun.counts)) {
    console.log(`${key}: ${value}`);
  }

  printRows("Duplicate serialized rows to retire in favor of item families", duplicateActions, (action) => (
    `${action.asset.assetTag} -> ${action.sku.name} (${action.asset.qrCodeValue} -> ${action.data.qrCodeValue})`
  ));
  printRows("Serialized taxonomy updates", taxonomyActions.slice(0, 30), (action) => (
    `${action.asset.assetTag}: ${action.categoryPath}`
  ));
  printRows("Serialized metadata updates", assetMetadataActions, (action) => (
    `${action.asset.assetTag}: ${action.reason}`
  ));
  printRows("Item-family taxonomy updates", bulkTaxonomyActions, (action) => (
    `${action.sku.name}: ${action.categoryPath ?? "category unchanged"}${action.data.departmentId ? ", department set" : ""}`
  ));
  printRows("Item-family legacy category text updates", bulkLegacyCategoryActions, (action) => (
    `${action.sku.name}: ${action.sku.category} -> ${action.data.category}`
  ));
  printRows("Item-family name updates", bulkNameActions, (action) => (
    `${action.sku.name}: ${action.data.name} (${action.reason})`
  ));
  printRows("Item-family image backfills", bulkImageActions, (action) => (
    `${action.sku.name}: copied from ${action.sourceAsset.assetTag}`
  ));
  printRows("Primary scan backfills", primaryBackfillActions, (action) => (
    `${action.asset.assetTag}: ${action.data.primaryScanCode}`
  ));
  printRows("Attachment updates", attachmentActions, (action) => (
    `${action.asset.assetTag} -> ${action.parent.assetTag}`
  ));
  printRows("Attachment rows needing physical mapping", attachmentReview.slice(0, 30), (row) => (
    `${row.assetTag}: ${row.reason}`
  ));

  if (!APPLY) {
    console.log("\nDry run only. Re-run with --apply to mutate data.");
    return;
  }

  await fs.mkdir(path.join(process.cwd(), ".tmp"), { recursive: true });
  const logPath = path.join(process.cwd(), ".tmp", `item-data-cleanup-${Date.now()}.json`);
  await fs.writeFile(logPath, JSON.stringify(dryRun, null, 2));

  await db.$transaction(async (tx) => {
    for (const action of actions) {
      if (action.type === "bulkTaxonomy" || action.type === "bulkLegacyCategory" || action.type === "bulkName" || action.type === "bulkImageBackfill") {
        await tx.bulkSku.update({
          where: { id: action.sku.id },
          data: action.data,
        });
        await tx.auditLog.create({
          data: {
            actorUserId: null,
            action: action.type === "bulkTaxonomy"
              ? "data_cleanup_bulk_taxonomy"
              : action.type === "bulkLegacyCategory"
                ? "data_cleanup_bulk_legacy_category"
                : action.type === "bulkName"
                  ? "data_cleanup_bulk_name"
                  : "data_cleanup_bulk_image_backfill",
            entityType: "BulkSku",
            entityId: action.sku.id,
            beforeJson: { ...beforeBulkSku(action.sku), source: ACTION_SOURCE },
            afterJson: { ...afterBulkSku(action.sku, action.data), source: ACTION_SOURCE },
          },
        });
        continue;
      }

      await tx.asset.update({
        where: { id: action.asset.id },
        data: action.data,
      });
      await tx.auditLog.create({
        data: {
          actorUserId: null,
          action: action.type === "assetDuplicateFamilyRetire"
            ? "data_cleanup_duplicate_family_retired"
            : action.type === "assetTaxonomy"
              ? "data_cleanup_asset_taxonomy"
              : action.type === "assetMetadata"
                ? "data_cleanup_asset_metadata"
                : action.type === "assetAttachment"
                  ? "data_cleanup_asset_attachment"
                  : "data_cleanup_primary_scan_backfill",
          entityType: "Asset",
          entityId: action.asset.id,
          beforeJson: { ...beforeAsset(action.asset), source: ACTION_SOURCE },
          afterJson: { ...afterAsset(action.asset, action.data), source: ACTION_SOURCE },
        },
      });
    }
  }, { timeout: 20_000 });

  console.log(`\nApplied ${actions.length} actions.`);
  console.log(`Mutation log: ${logPath}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
