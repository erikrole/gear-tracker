import fs from "node:fs/promises";
import path from "node:path";
import { Prisma } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";

const APPLY = process.argv.includes("--apply");
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("DATABASE_URL is required for battery-family consolidation.");
  process.exit(1);
}

const db = new PrismaClient({ adapter: new PrismaNeon({ connectionString }) });

const FAMILY = {
  goldDigital: "cmnrtqudd0005jp04hlg8vauz",
  goldDionic: "cmnrtqudx0009jp049epk5si3",
  monitor: "cmnrtqufr000pjp04ke4rr94j",
  aa: "cmnrtqug0000tjp04bl7r434l",
  fx6U35: "cmnrtquiq001tjp0493y8r0da",
  fx6U70: "cmnrtquj0001xjp04puz803gt",
  sony: "cmnrtquja0021jp04780v9kej",
  watsonF550: "cmnrtquk20029jp0478eg9p5x",
};

const ASSET = {
  goldDigitalRetired: "cmmvmbdhd000ojx04mprthq1g",
  goldDionicActive: "cmmvmbdhd000pjx04t3yg61ls",
  monitor: "cmmvmbdhg0039jx0433fxd1yw",
  aaRetired: "cmmvmbdhg003ajx04i33v7ufj",
  fx6U35: "cmmvmbdhh004ajx049n1dnfwk",
  sonyRetired: "cmmvmbdhh004cjx042v5nc4xy",
  watsonF550Retired: "cmmvmbdhi0050jx04njvcjsox",
};

const FX6_QR = "1bf6d839";
const FINAL_FAMILY_NAMES = ["FX6 Battery", "Gold Mount Battery", "Monitor Battery", "Sony Battery"];
const DELETED_ASSET_IDS = [
  ASSET.goldDigitalRetired,
  ASSET.monitor,
  ASSET.aaRetired,
  ASSET.fx6U35,
  ASSET.watsonF550Retired,
];

function option(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1]?.trim() ?? "" : "";
}

function normalizedName(value) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
}

function totalBalance(family) {
  return family.balances.reduce((sum, balance) => sum + balance.onHandQuantity, 0);
}

function countHistory(record) {
  return Object.values(record._count).reduce((sum, count) => sum + count, 0);
}

function unitStatusCounts(family) {
  return family.units.reduce((counts, unit) => {
    counts[unit.status] = (counts[unit.status] ?? 0) + 1;
    return counts;
  }, {});
}

function familySummary(family) {
  return {
    id: family.id,
    name: family.name,
    active: family.active,
    trackByNumber: family.trackByNumber,
    qr: family.binQrCodeValue,
    onHand: totalBalance(family),
    units: family.units.length,
    statuses: unitStatusCounts(family),
    printedUnits: family.units.filter((unit) => unit.labelPrintedAt).length,
    history: family._count,
  };
}

function assetSummary(asset) {
  return {
    id: asset.id,
    assetTag: asset.assetTag,
    status: asset.status,
    qr: asset.qrCodeValue,
    history: asset._count,
  };
}

async function loadFamily(client, id) {
  return client.bulkSku.findUnique({
    where: { id },
    include: {
      balances: true,
      products: { include: { _count: { select: { units: true } } } },
      units: {
        include: {
          allocations: {
            include: {
              bookingBulkItem: { include: { booking: { select: { status: true } } } },
            },
          },
        },
        orderBy: { unitNumber: "asc" },
      },
      _count: { select: { bookingItems: true, movements: true, scans: true, kitBulkMembers: true } },
    },
  });
}

async function loadAsset(client, id) {
  return client.asset.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          bookingItems: true,
          allocations: true,
          scans: true,
          kitMemberships: true,
          favoritedBy: true,
          checkinReports: true,
          accessories: true,
        },
      },
    },
  });
}

async function loadState(client = db) {
  const familyEntries = await Promise.all(
    Object.entries(FAMILY).map(async ([key, id]) => [key, await loadFamily(client, id)]),
  );
  const assetEntries = await Promise.all(
    Object.entries(ASSET).map(async ([key, id]) => [key, await loadAsset(client, id)]),
  );
  const activeBatteryFamilies = await client.bulkSku.findMany({
    where: { active: true, category: { equals: "Batteries", mode: "insensitive" } },
    select: { id: true, name: true, trackByNumber: true },
    orderBy: { name: "asc" },
  });
  const fx6QrCollision = await client.bulkSku.findFirst({
    where: { binQrCodeValue: FX6_QR, id: { not: FAMILY.fx6U35 } },
    select: { id: true, name: true },
  });

  return {
    families: Object.fromEntries(familyEntries),
    assets: Object.fromEntries(assetEntries),
    activeBatteryFamilies,
    fx6QrCollision,
  };
}

function expectFamily(blockers, family, expected) {
  if (!family) {
    blockers.push(`${expected.name} family is missing.`);
    return;
  }
  const actual = familySummary(family);
  for (const [key, value] of Object.entries(expected)) {
    if (key === "history") continue;
    if (actual[key] !== value) blockers.push(`${expected.name} expected ${key}=${value}; found ${actual[key]}.`);
  }
  for (const [key, value] of Object.entries(expected.history ?? {})) {
    if (actual.history[key] !== value) blockers.push(`${expected.name} expected ${key}=${value}; found ${actual.history[key]}.`);
  }
}

function expectAvailableSequentialUnits(blockers, family, expectedCount) {
  if (!family) return;
  if (family.units.some((unit, index) => unit.unitNumber !== index + 1 || unit.status !== "AVAILABLE")) {
    blockers.push(`${family.name} units must be available and numbered 1 through ${expectedCount}.`);
  }
  if (family.units.some((unit) => unit.labelPrintedAt || unit.allocations.length > 0 || unit.productId)) {
    blockers.push(`${family.name} source units gained labels, allocations, or product assignments.`);
  }
}

function inspectPreflight(state) {
  const blockers = [];
  const f = state.families;

  expectFamily(blockers, f.monitor, {
    name: "Monitor Battery", active: true, trackByNumber: false, qr: "bdf15b57", onHand: 14, units: 0,
    history: { bookingItems: 0, movements: 0, scans: 0, kitBulkMembers: 0 },
  });
  expectFamily(blockers, f.watsonF550, {
    name: "Watson NP-F550", active: true, trackByNumber: true, qr: "4a0bed87", onHand: 4, units: 4,
    history: { bookingItems: 0, movements: 0, scans: 0, kitBulkMembers: 0 },
  });
  expectFamily(blockers, f.goldDigital, {
    name: "Anton Bauer Digital 150 Gold-Mount Battery", active: true, trackByNumber: true, qr: "cbceaa80", onHand: 2, units: 2,
    history: { bookingItems: 2, movements: 0, scans: 0, kitBulkMembers: 0 },
  });
  expectFamily(blockers, f.goldDionic, {
    name: "Anton/Bauer Dionic XT 150Wh Gold-Mount Battery", active: true, trackByNumber: true, qr: "0C2286A4", onHand: 8, units: 8,
    history: { bookingItems: 1, movements: 3, scans: 0, kitBulkMembers: 0 },
  });
  expectFamily(blockers, f.fx6U35, {
    name: "Sony BP-U35 Battery", active: true, trackByNumber: true, qr: "bg://bulk/Sony BP-U35 Battery", onHand: 4, units: 4,
    history: { bookingItems: 0, movements: 0, scans: 0, kitBulkMembers: 0 },
  });
  expectFamily(blockers, f.fx6U70, {
    name: "Sony BP-U70 Battery", active: true, trackByNumber: true, qr: "bg://bulk/Sony BP-U70 Battery", onHand: 8, units: 8,
    history: { bookingItems: 0, movements: 0, scans: 0, kitBulkMembers: 0 },
  });
  expectFamily(blockers, f.aa, {
    name: "Panasonic eneloop pro AA Rechargeable", active: true, trackByNumber: false, qr: "2ec0c07d", onHand: 64, units: 0,
    history: { bookingItems: 0, movements: 0, scans: 0, kitBulkMembers: 0 },
  });
  expectFamily(blockers, f.sony, {
    name: "Sony Battery", active: true, trackByNumber: true, qr: "94e068d1", onHand: 25, units: 52,
    history: { bookingItems: 31, movements: 105, scans: 2, kitBulkMembers: 0 },
  });

  expectAvailableSequentialUnits(blockers, f.watsonF550, 4);
  expectAvailableSequentialUnits(blockers, f.goldDigital, 2);
  expectAvailableSequentialUnits(blockers, f.fx6U35, 4);
  expectAvailableSequentialUnits(blockers, f.fx6U70, 8);

  if (f.goldDionic?.units.some((unit, index) => unit.unitNumber !== index + 1 || unit.status !== "AVAILABLE")) {
    blockers.push("Gold Mount target units must remain available and numbered 1 through 8.");
  }
  if (f.goldDionic?.units.some((unit) => unit.labelPrintedAt || unit.productId)) {
    blockers.push("Gold Mount target units gained labels or product assignments.");
  }
  if (f.goldDionic?.units.reduce((sum, unit) => sum + unit.allocations.length, 0) !== 1) {
    blockers.push("Gold Mount target historical unit allocations changed.");
  }

  const sonyStatuses = unitStatusCounts(f.sony ?? { units: [] });
  if (sonyStatuses.AVAILABLE !== 41 || sonyStatuses.CHECKED_OUT !== 8 || sonyStatuses.RETIRED !== 3) {
    blockers.push(`Sony Battery unit states changed: ${JSON.stringify(sonyStatuses)}.`);
  }
  if (f.sony?.units.filter((unit) => unit.labelPrintedAt).length !== 52) blockers.push("Sony Battery printed-label state changed.");
  const sonyActiveAllocations = f.sony?.units.flatMap((unit) => unit.allocations).filter((allocation) => (
    ["OPEN", "PENDING_PICKUP", "APPROVED"].includes(allocation.bookingBulkItem.booking.status)
  )).length;
  if (sonyActiveAllocations !== 8) blockers.push(`Sony Battery active allocation count changed from 8 to ${sonyActiveAllocations}.`);

  for (const family of Object.values(f)) {
    if (family?.products.length !== 0) blockers.push(`${family.name} already has product records.`);
  }

  const expectedActiveIds = new Set(Object.values(FAMILY));
  const unexpectedActive = state.activeBatteryFamilies.filter((family) => !expectedActiveIds.has(family.id));
  if (unexpectedActive.length > 0 || state.activeBatteryFamilies.length !== 8) {
    blockers.push(`Active battery-family set changed: ${state.activeBatteryFamilies.map((family) => family.name).join(", ")}.`);
  }
  if (state.fx6QrCollision) blockers.push(`FX6 QR ${FX6_QR} collides with ${state.fx6QrCollision.name}.`);

  const a = state.assets;
  const historyFreeAssets = [a.goldDigitalRetired, a.monitor, a.aaRetired, a.fx6U35, a.watsonF550Retired];
  for (const asset of historyFreeAssets) {
    if (!asset) {
      blockers.push("A history-free serialized battery slated for deletion is missing.");
      continue;
    }
    if (countHistory(asset) !== asset._count.favoritedBy) {
      blockers.push(`${asset.assetTag} gained operational history and cannot be deleted.`);
    }
  }
  if (!a.goldDionicActive || a.goldDionicActive.status !== "AVAILABLE") blockers.push("Active serialized Dionic battery is missing or no longer available.");
  if (a.goldDionicActive && (
    a.goldDionicActive._count.bookingItems !== 1
    || a.goldDionicActive._count.allocations !== 1
    || a.goldDionicActive._count.scans !== 1
    || a.goldDionicActive._count.kitMemberships !== 0
    || a.goldDionicActive._count.checkinReports !== 0
  )) blockers.push("Serialized Dionic battery history changed.");
  if (!a.sonyRetired || a.sonyRetired.status !== "RETIRED" || a.sonyRetired._count.bookingItems !== 2 || a.sonyRetired._count.allocations !== 2) {
    blockers.push("Retired serialized Sony history changed.");
  }

  const locations = new Set(Object.values(f).filter(Boolean).map((family) => family.locationId));
  if (locations.size !== 1) blockers.push("Battery families are no longer in one location.");
  return blockers;
}

async function createProduct(tx, bulkSkuId, name, brand, model) {
  return tx.bulkSkuProduct.create({
    data: { bulkSkuId, name, normalizedName: normalizedName(name), brand, model },
  });
}

async function writeAudit(tx, actor, entityType, entityId, action, beforeJson, afterJson) {
  await tx.auditLog.create({
    data: {
      actorUserId: actor.id,
      entityType,
      entityId,
      action,
      beforeJson: { ...beforeJson, source: "battery-family-consolidation-2026-07-15" },
      afterJson: { ...afterJson, source: "battery-family-consolidation-2026-07-15", actorRole: actor.role },
    },
  });
}

async function applyConsolidation(actorEmail) {
  const actor = await db.user.findUnique({ where: { email: actorEmail }, select: { id: true, role: true, active: true } });
  if (!actor?.active || !["ADMIN", "STAFF"].includes(actor.role)) {
    throw new Error("--actor-email must identify an active ADMIN or STAFF user.");
  }

  const snapshot = await loadState();
  const blockers = inspectPreflight(snapshot);
  if (blockers.length > 0) throw new Error(`Preflight failed: ${blockers.join(" ")}`);

  await fs.mkdir(path.join(process.cwd(), ".tmp"), { recursive: true });
  const proofPath = path.join(process.cwd(), ".tmp", `battery-family-consolidation-${Date.now()}.json`);
  await fs.writeFile(proofPath, JSON.stringify({ generatedAt: new Date().toISOString(), actorEmail, before: summarizeState(snapshot) }, null, 2));

  const result = await db.$transaction(async (tx) => {
    const current = await loadState(tx);
    const transactionBlockers = inspectPreflight(current);
    if (transactionBlockers.length > 0) throw new Error(`State changed before apply: ${transactionBlockers.join(" ")}`);
    const f = current.families;
    const a = current.assets;

    const monitorF550 = await createProduct(tx, FAMILY.monitor, "Watson NP-F550", "Watson", "B-4203");
    await createProduct(tx, FAMILY.monitor, "Watson NP-F770", "Watson", "B-4205");
    await createProduct(tx, FAMILY.monitor, "GVM Monitor Battery", "GVM", null);
    await tx.bulkSkuUnit.createMany({
      data: Array.from({ length: 14 }, (_, index) => ({ bulkSkuId: FAMILY.monitor, unitNumber: index + 1 })),
    });
    await tx.bulkSkuUnit.updateMany({
      where: { bulkSkuId: FAMILY.watsonF550 },
      data: { bulkSkuId: FAMILY.monitor, unitNumber: { increment: 14 }, productId: monitorF550.id },
    });
    await tx.bulkSku.update({ where: { id: FAMILY.monitor }, data: { trackByNumber: true } });
    await tx.bulkStockBalance.update({
      where: { bulkSkuId_locationId: { bulkSkuId: FAMILY.monitor, locationId: f.monitor.locationId } },
      data: { onHandQuantity: { increment: 4 } },
    });
    await writeAudit(tx, actor, "BulkSku", FAMILY.watsonF550, "battery_family_hard_deleted", familySummary(f.watsonF550), { consolidatedInto: FAMILY.monitor });
    await tx.bulkSku.delete({ where: { id: FAMILY.watsonF550 } });

    const goldDionic = await createProduct(tx, FAMILY.goldDionic, "Anton/Bauer Dionic XT 150Wh", "Anton/Bauer", "8675-0127");
    const goldDigital = await createProduct(tx, FAMILY.goldDionic, "Anton Bauer Digital 150", "Anton Bauer", "8675-0093");
    await tx.bulkSkuUnit.updateMany({ where: { bulkSkuId: FAMILY.goldDionic }, data: { productId: goldDionic.id } });
    await tx.bulkSkuUnit.updateMany({
      where: { bulkSkuId: FAMILY.goldDigital },
      data: { bulkSkuId: FAMILY.goldDionic, unitNumber: { increment: 8 }, productId: goldDigital.id },
    });
    await tx.bulkSku.update({ where: { id: FAMILY.goldDionic }, data: { name: "Gold Mount Battery" } });
    await tx.bulkStockBalance.update({
      where: { bulkSkuId_locationId: { bulkSkuId: FAMILY.goldDionic, locationId: f.goldDionic.locationId } },
      data: { onHandQuantity: { increment: 2 } },
    });
    await tx.bulkStockBalance.update({
      where: { bulkSkuId_locationId: { bulkSkuId: FAMILY.goldDigital, locationId: f.goldDigital.locationId } },
      data: { onHandQuantity: 0 },
    });
    await tx.bulkSku.update({ where: { id: FAMILY.goldDigital }, data: { active: false } });

    const fx6U35 = await createProduct(tx, FAMILY.fx6U35, "Sony BP-U35", "Sony", "BP-U35");
    const fx6U70 = await createProduct(tx, FAMILY.fx6U35, "Sony BP-U70", "Sony", "BP-U70");
    await tx.bulkSkuUnit.updateMany({ where: { bulkSkuId: FAMILY.fx6U35 }, data: { productId: fx6U35.id } });
    await tx.bulkSkuUnit.updateMany({
      where: { bulkSkuId: FAMILY.fx6U70 },
      data: { bulkSkuId: FAMILY.fx6U35, unitNumber: { increment: 4 }, productId: fx6U70.id },
    });
    await tx.bulkSku.update({ where: { id: FAMILY.fx6U35 }, data: { name: "FX6 Battery", binQrCodeValue: FX6_QR } });
    await tx.bulkStockBalance.update({
      where: { bulkSkuId_locationId: { bulkSkuId: FAMILY.fx6U35, locationId: f.fx6U35.locationId } },
      data: { onHandQuantity: { increment: 8 } },
    });
    await writeAudit(tx, actor, "BulkSku", FAMILY.fx6U70, "battery_family_hard_deleted", familySummary(f.fx6U70), { consolidatedInto: FAMILY.fx6U35 });
    await tx.bulkSku.delete({ where: { id: FAMILY.fx6U70 } });

    await writeAudit(tx, actor, "BulkSku", FAMILY.aa, "battery_family_hard_deleted", familySummary(f.aa), { reason: "outside canonical four-family battery catalog" });
    await tx.bulkSku.delete({ where: { id: FAMILY.aa } });

    for (const assetId of DELETED_ASSET_IDS) {
      const asset = Object.values(a).find((candidate) => candidate?.id === assetId);
      await writeAudit(tx, actor, "Asset", assetId, "serialized_battery_hard_deleted", assetSummary(asset), { reason: "replaced by canonical numbered item family" });
      await tx.asset.delete({ where: { id: assetId } });
    }
    await writeAudit(tx, actor, "Asset", ASSET.goldDionicActive, "serialized_battery_retired", assetSummary(a.goldDionicActive), { canonicalFamilyId: FAMILY.goldDionic, status: "RETIRED" });
    await tx.asset.update({
      where: { id: ASSET.goldDionicActive },
      data: {
        status: "RETIRED",
        qrCodeValue: `retired-${ASSET.goldDionicActive}`,
        primaryScanCode: `retired-${ASSET.goldDionicActive}`,
        availableForCheckout: false,
        availableForReservation: false,
        availableForCustody: false,
      },
    });

    await tx.bulkStockMovement.createMany({
      data: [
        { bulkSkuId: FAMILY.monitor, locationId: f.monitor.locationId, actorUserId: actor.id, kind: "ADJUSTMENT", quantity: 4, reason: "Consolidated Watson NP-F550 into Monitor Battery" },
        { bulkSkuId: FAMILY.goldDionic, locationId: f.goldDionic.locationId, actorUserId: actor.id, kind: "ADJUSTMENT", quantity: 2, reason: "Consolidated Gold Mount battery families" },
        { bulkSkuId: FAMILY.goldDigital, locationId: f.goldDigital.locationId, actorUserId: actor.id, kind: "ADJUSTMENT", quantity: -2, reason: "Consolidated into Gold Mount Battery" },
        { bulkSkuId: FAMILY.fx6U35, locationId: f.fx6U35.locationId, actorUserId: actor.id, kind: "ADJUSTMENT", quantity: 8, reason: "Consolidated BP-U35 and BP-U70 into FX6 Battery" },
      ],
    });

    await writeAudit(tx, actor, "BulkSku", FAMILY.monitor, "battery_family_consolidated", familySummary(f.monitor), { name: "Monitor Battery", units: 18, qr: "bdf15b57" });
    await writeAudit(tx, actor, "BulkSku", FAMILY.goldDionic, "battery_family_consolidated", familySummary(f.goldDionic), { name: "Gold Mount Battery", units: 10, qr: "0C2286A4" });
    await writeAudit(tx, actor, "BulkSku", FAMILY.fx6U35, "battery_family_consolidated", familySummary(f.fx6U35), { name: "FX6 Battery", units: 12, qr: FX6_QR });
    await writeAudit(tx, actor, "BulkSku", FAMILY.sony, "battery_family_preserved", familySummary(f.sony), { name: "Sony Battery", units: 52, qr: "94e068d1" });

    return { monitorUnits: 18, goldMountUnits: 10, fx6Units: 12, sonyUnits: 52 };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30_000 });

  return { proofPath, ...result };
}

function summarizeState(state) {
  return {
    activeBatteryFamilies: state.activeBatteryFamilies,
    families: Object.fromEntries(Object.entries(state.families).map(([key, family]) => [key, family && familySummary(family)])),
    assets: Object.fromEntries(Object.entries(state.assets).map(([key, asset]) => [key, asset && assetSummary(asset)])),
  };
}

async function verifyFinalState() {
  const families = await db.bulkSku.findMany({
    where: { active: true, category: { equals: "Batteries", mode: "insensitive" } },
    include: { balances: true, products: { include: { _count: { select: { units: true } } } }, units: true },
    orderBy: { name: "asc" },
  });
  const summaries = families.map((family) => ({
    name: family.name,
    trackByNumber: family.trackByNumber,
    qr: family.binQrCodeValue,
    onHand: totalBalance(family),
    units: family.units.length,
    statuses: unitStatusCounts(family),
    products: family.products.map((product) => ({ name: product.name, units: product._count.units })),
  }));
  const blockers = [];
  if (JSON.stringify(families.map((family) => family.name)) !== JSON.stringify(FINAL_FAMILY_NAMES)) blockers.push("Active battery family names do not match the canonical four.");
  if (families.some((family) => !family.trackByNumber)) blockers.push("An active battery family is not unit-tracked.");
  const expectedUnits = new Map([["Monitor Battery", 18], ["Sony Battery", 52], ["Gold Mount Battery", 10], ["FX6 Battery", 12]]);
  for (const family of families) {
    if (family.units.length !== expectedUnits.get(family.name)) blockers.push(`${family.name} expected ${expectedUnits.get(family.name)} units; found ${family.units.length}.`);
  }
  return { summaries, blockers };
}

async function main() {
  const finalState = await verifyFinalState();
  if (finalState.blockers.length === 0) {
    console.log(JSON.stringify({ mode: APPLY ? "apply" : "dry-run", alreadyConsolidated: true, final: finalState.summaries }, null, 2));
    return;
  }

  const state = await loadState();
  const blockers = inspectPreflight(state);
  console.log(JSON.stringify({ mode: APPLY ? "apply" : "dry-run", before: summarizeState(state), blockers, planned: {
    activeFamilies: FINAL_FAMILY_NAMES,
    monitor: "14 new unassigned units plus Watson NP-F550 units 15-18",
    goldMount: "Dionic units 1-8 plus Digital units 9-10",
    fx6: `BP-U35 units 1-4 plus BP-U70 units 5-12; QR ${FX6_QR}`,
    sony: "preserve units 1-52, active custody, and printed-label state",
  } }, null, 2));
  if (blockers.length > 0) throw new Error("Battery-family consolidation preflight failed. No data was changed.");
  if (!APPLY) {
    console.log("Dry run only. Re-run with --apply --actor-email <staff email> to mutate live data.");
    return;
  }

  const actorEmail = option("--actor-email").toLocaleLowerCase("en-US");
  if (!actorEmail) throw new Error("--actor-email is required for audit and stock-movement attribution.");
  const result = await applyConsolidation(actorEmail);
  const after = await verifyFinalState();
  if (after.blockers.length > 0) throw new Error(`Post-apply verification failed: ${after.blockers.join(" ")}`);
  console.log(JSON.stringify({ applied: true, ...result, final: after.summaries }, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
