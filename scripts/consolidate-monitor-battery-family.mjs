import { Prisma } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";

const APPLY = process.argv.includes("--apply");
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("DATABASE_URL is required for Monitor Battery consolidation.");
  process.exit(1);
}

const db = new PrismaClient({ adapter: new PrismaNeon({ connectionString }) });

function option(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
}

function integerOption(name) {
  const value = option(name);
  if (value == null) return null;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative integer.`);
  }
  return parsed;
}

function normalizedName(value) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
}

function familyHistoryCount(family) {
  return family._count.bookingItems + family._count.movements + family._count.scans;
}

async function loadState(client = db) {
  const [target, npf550, serialized, gvmFamilies, gvmAssets] = await Promise.all([
    client.bulkSku.findFirst({
      where: { name: { equals: "Monitor Battery", mode: "insensitive" }, active: true },
      include: {
        balances: true,
        units: {
          select: { unitNumber: true, status: true, _count: { select: { allocations: true } } },
          orderBy: { unitNumber: "asc" },
        },
        _count: { select: { bookingItems: true, movements: true, scans: true } },
      },
    }),
    client.bulkSku.findFirst({
      where: { name: { equals: "Watson NP-F550", mode: "insensitive" }, active: true },
      include: {
        balances: true,
        units: {
          select: { unitNumber: true, status: true, _count: { select: { allocations: true } } },
          orderBy: { unitNumber: "asc" },
        },
        _count: { select: { bookingItems: true, movements: true, scans: true } },
      },
    }),
    client.asset.findUnique({
      where: { assetTag: "Monitor Battery" },
      include: {
        _count: { select: { bookingItems: true, allocations: true, scans: true, kitMemberships: true, checkinReports: true } },
      },
    }),
    client.bulkSku.findMany({
      where: { OR: [{ name: { contains: "GVM", mode: "insensitive" } }, { notes: { contains: "GVM", mode: "insensitive" } }] },
      select: { id: true, name: true, active: true, trackByNumber: true },
    }),
    client.asset.findMany({
      where: { OR: [{ name: { contains: "GVM", mode: "insensitive" } }, { brand: { contains: "GVM", mode: "insensitive" } }, { model: { contains: "GVM", mode: "insensitive" } }] },
      select: { id: true, assetTag: true, name: true, brand: true, model: true, status: true },
    }),
  ]);

  return { target, npf550, serialized, gvmFamilies, gvmAssets };
}

function inspectState(state) {
  const blockers = [];
  const { target, npf550, serialized } = state;

  if (!target) blockers.push("Active Monitor Battery family not found.");
  if (!npf550) blockers.push("Active Watson NP-F550 family not found.");
  if (!serialized) blockers.push("Serialized Monitor Battery / BA-001 record not found.");
  if (blockers.length > 0) return blockers;

  const targetBalance = target.balances.reduce((sum, balance) => sum + balance.onHandQuantity, 0);
  const sourceBalance = npf550.balances.reduce((sum, balance) => sum + balance.onHandQuantity, 0);
  if (target.trackByNumber || target.units.length !== 0 || targetBalance !== 14) {
    blockers.push(`Monitor Battery expected Quantity with 14 on hand and no units; found trackByNumber=${target.trackByNumber}, balance=${targetBalance}, units=${target.units.length}.`);
  }
  if (target.binQrCodeValue !== "bdf15b57") blockers.push(`Monitor Battery QR changed from expected bdf15b57 to ${target.binQrCodeValue}.`);
  if (familyHistoryCount(target) !== 0) blockers.push("Monitor Battery gained booking, movement, or scan history.");

  if (!npf550.trackByNumber || sourceBalance !== 4 || npf550.units.length !== 4) {
    blockers.push(`Watson NP-F550 expected Units with four records and balance 4; found trackByNumber=${npf550.trackByNumber}, balance=${sourceBalance}, units=${npf550.units.length}.`);
  }
  if (npf550.binQrCodeValue !== "4a0bed87") blockers.push(`Watson NP-F550 QR changed from expected 4a0bed87 to ${npf550.binQrCodeValue}.`);
  if (familyHistoryCount(npf550) !== 0) blockers.push("Watson NP-F550 gained booking, movement, or scan history.");
  if (npf550.units.some((unit, index) => unit.unitNumber !== index + 1 || unit.status !== "AVAILABLE" || unit._count.allocations !== 0)) {
    blockers.push("Watson NP-F550 units are no longer four available, unallocated records numbered 1 through 4.");
  }
  if (target.locationId !== npf550.locationId) blockers.push("Source and target families are no longer at the same location.");

  const serializedHistory = Object.values(serialized._count).reduce((sum, count) => sum + count, 0);
  if (serializedHistory !== 0) blockers.push("Serialized Monitor Battery / BA-001 gained operational history.");
  if (serialized.status !== "AVAILABLE" || serialized.brand !== "Watson" || serialized.model !== "B-4205") {
    blockers.push("Serialized Monitor Battery identity no longer matches available Watson B-4205 source evidence.");
  }

  return blockers;
}

async function applyConsolidation(config) {
  const actor = await db.user.findUnique({
    where: { email: config.actorEmail },
    select: { id: true, role: true, active: true },
  });
  if (!actor?.active || !["ADMIN", "STAFF"].includes(actor.role)) {
    throw new Error("--actor-email must identify an active ADMIN or STAFF user.");
  }

  return db.$transaction(async (tx) => {
    const currentState = await loadState(tx);
    const blockers = inspectState(currentState);
    if (blockers.length > 0) {
      throw new Error(`Consolidation state changed before apply: ${blockers.join(" ")}`);
    }
    const { target, npf550, serialized } = currentState;
    const products = [];
    if (config.watsonNpf770Count > 0) {
      products.push(await tx.bulkSkuProduct.create({
        data: {
          bulkSkuId: target.id,
          name: "Watson NP-F770",
          normalizedName: normalizedName("Watson NP-F770"),
          brand: "Watson",
          model: "B-4205",
        },
      }));
    }
    if (config.gvmCount > 0) {
      const name = `GVM ${config.gvmModel}`;
      products.push(await tx.bulkSkuProduct.create({
        data: {
          bulkSkuId: target.id,
          name,
          normalizedName: normalizedName(name),
          brand: "GVM",
          model: config.gvmModel,
        },
      }));
    }
    const npf550Product = await tx.bulkSkuProduct.create({
      data: {
        bulkSkuId: target.id,
        name: "Watson NP-F550",
        normalizedName: normalizedName("Watson NP-F550"),
        brand: "Watson",
        model: "B-4203",
      },
    });
    products.push(npf550Product);

    const npf770Product = products.find((product) => product.name === "Watson NP-F770") ?? null;
    const gvmProduct = products.find((product) => product.brand === "GVM") ?? null;
    const targetUnitData = Array.from({ length: 14 }, (_, index) => ({
      bulkSkuId: target.id,
      unitNumber: index + 1,
      productId: index < config.watsonNpf770Count ? npf770Product?.id ?? null : gvmProduct?.id ?? null,
    }));

    await tx.bulkSkuUnit.createMany({ data: targetUnitData });
    await tx.bulkSku.update({ where: { id: target.id }, data: { trackByNumber: true } });

    const moved = await tx.bulkSkuUnit.updateMany({
      where: { bulkSkuId: npf550.id },
      data: {
        bulkSkuId: target.id,
        productId: npf550Product.id,
        unitNumber: { increment: 14 },
        labelPrintedAt: null,
        labelPrintedById: null,
        labelPrintBatchId: null,
      },
    });
    if (moved.count !== 4) throw new Error(`Expected to move four NP-F550 units, moved ${moved.count}.`);

    await Promise.all([
      tx.bulkStockBalance.update({
        where: { bulkSkuId_locationId: { bulkSkuId: target.id, locationId: target.locationId } },
        data: { onHandQuantity: { increment: 4 } },
      }),
      tx.bulkStockBalance.update({
        where: { bulkSkuId_locationId: { bulkSkuId: npf550.id, locationId: npf550.locationId } },
        data: { onHandQuantity: { decrement: 4 } },
      }),
      tx.bulkSku.update({ where: { id: npf550.id }, data: { active: false } }),
      tx.asset.update({
        where: { id: serialized.id },
        data: {
          status: "RETIRED",
          qrCodeValue: `retired-${serialized.id}`,
          primaryScanCode: `retired-${serialized.id}`,
          availableForCheckout: false,
          availableForReservation: false,
          availableForCustody: false,
        },
      }),
    ]);

    await tx.bulkStockMovement.createMany({
      data: [
        {
          bulkSkuId: target.id,
          locationId: target.locationId,
          actorUserId: actor.id,
          kind: "ADJUSTMENT",
          quantity: 4,
          reason: "Consolidated Watson NP-F550 units into Monitor Battery",
        },
        {
          bulkSkuId: npf550.id,
          locationId: npf550.locationId,
          actorUserId: actor.id,
          kind: "ADJUSTMENT",
          quantity: -4,
          reason: "Consolidated Watson NP-F550 units into Monitor Battery",
        },
      ],
    });

    await tx.auditLog.createMany({
      data: [
        ...products.map((product) => ({
          actorUserId: actor.id,
          entityType: "bulk_sku_product",
          entityId: product.id,
          action: "monitor_battery_consolidation_product_created",
          afterJson: { bulkSkuId: target.id, name: product.name, brand: product.brand, model: product.model, _actorRole: actor.role },
        })),
        {
          actorUserId: actor.id,
          entityType: "bulk_sku",
          entityId: target.id,
          action: "monitor_battery_consolidated",
          beforeJson: { trackByNumber: false, onHandQuantity: 14 },
          afterJson: { trackByNumber: true, onHandQuantity: 18, unitNumbers: "1-18", sourceBulkSkuId: npf550.id, _actorRole: actor.role },
        },
        {
          actorUserId: actor.id,
          entityType: "bulk_sku",
          entityId: npf550.id,
          action: "consolidated_into_item_family",
          beforeJson: { active: true, onHandQuantity: 4 },
          afterJson: { active: false, onHandQuantity: 0, targetBulkSkuId: target.id, _actorRole: actor.role },
        },
        {
          actorUserId: actor.id,
          entityType: "asset",
          entityId: serialized.id,
          action: "duplicate_item_family_retired",
          beforeJson: { status: serialized.status, assetTag: serialized.assetTag },
          afterJson: { status: "RETIRED", targetBulkSkuId: target.id, _actorRole: actor.role },
        },
      ],
    });

    return { targetFamilyId: target.id, activeUnits: 18, products: products.map((product) => product.name) };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 20_000 });
}

async function main() {
  const state = await loadState();
  const blockers = inspectState(state);
  const targetCount = state.target?.balances.reduce((sum, balance) => sum + balance.onHandQuantity, 0) ?? null;
  const sourceCount = state.npf550?.balances.reduce((sum, balance) => sum + balance.onHandQuantity, 0) ?? null;

  console.log(JSON.stringify({
    mode: APPLY ? "apply" : "dry-run",
    current: {
      monitorBattery: state.target && { id: state.target.id, qr: state.target.binQrCodeValue, trackByNumber: state.target.trackByNumber, onHand: targetCount, units: state.target.units.length },
      watsonNpf550: state.npf550 && { id: state.npf550.id, qr: state.npf550.binQrCodeValue, trackByNumber: state.npf550.trackByNumber, onHand: sourceCount, units: state.npf550.units.length },
      serializedMonitorBattery: state.serialized && { id: state.serialized.id, assetTag: state.serialized.assetTag, brand: state.serialized.brand, model: state.serialized.model, status: state.serialized.status },
      gvmFamilies: state.gvmFamilies,
      gvmAssets: state.gvmAssets,
    },
    blockers,
    requiredPhysicalInput: {
      targetUnits: 14,
      fields: ["--watson-np-f770-count", "--gvm-count", "--gvm-model when GVM count is greater than zero"],
    },
  }, null, 2));

  if (blockers.length > 0) throw new Error("Consolidation preflight failed. No data was changed.");
  if (!APPLY) {
    console.log("Dry run only. Confirm the physical Watson/GVM split before using --apply.");
    return;
  }

  const watsonNpf770Count = integerOption("--watson-np-f770-count");
  const gvmCount = integerOption("--gvm-count");
  const gvmModel = option("--gvm-model")?.trim() ?? "";
  const actorEmail = option("--actor-email")?.trim().toLocaleLowerCase("en-US") ?? "";
  if (watsonNpf770Count == null || gvmCount == null || watsonNpf770Count + gvmCount !== 14) {
    throw new Error("--watson-np-f770-count and --gvm-count are required and must total 14.");
  }
  if (gvmCount > 0 && !gvmModel) throw new Error("--gvm-model is required when --gvm-count is greater than zero.");
  if (!actorEmail) throw new Error("--actor-email is required for stock movement and audit attribution.");

  const result = await applyConsolidation({ watsonNpf770Count, gvmCount, gvmModel, actorEmail });
  console.log(JSON.stringify({ applied: true, ...result }, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
