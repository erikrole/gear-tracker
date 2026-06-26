import { BulkUnitStatus, Prisma } from "@prisma/client";
import { z } from "zod";
import { withAuth } from "@/lib/api";
import { createAuditEntriesTx } from "@/lib/audit";
import { isBatterySku } from "@/lib/bulk-batteries";
import { db } from "@/lib/db";
import { ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";

const repairStaleBatteryFlagsSchema = z.object({
  reason: z.string().trim().min(3).max(500).optional(),
});

const DEFAULT_REPAIR_REASON = "Repair stale checked-out battery flags with no active allocation";

export const POST = withAuth(async (req, { user }) => {
  requirePermission(user.role, "bulk_sku", "adjust");
  const body = repairStaleBatteryFlagsSchema.parse(await req.json().catch(() => ({})));
  const reason = body.reason ?? DEFAULT_REPAIR_REASON;

  const result = await db.$transaction(async (tx) => {
    const candidates = await tx.bulkSkuUnit.findMany({
      where: {
        status: BulkUnitStatus.CHECKED_OUT,
        bulkSku: { active: true },
        allocations: {
          none: {
            checkedOutAt: { not: null },
            checkedInAt: null,
          },
        },
      },
      select: {
        id: true,
        bulkSkuId: true,
        unitNumber: true,
        status: true,
        bulkSku: {
          select: {
            id: true,
            name: true,
            category: true,
            categoryRel: { select: { name: true } },
          },
        },
      },
      orderBy: [{ bulkSkuId: "asc" }, { unitNumber: "asc" }],
    });

    const staleBatteryUnits = candidates.filter((unit) => isBatterySku(unit.bulkSku));
    if (staleBatteryUnits.length === 0) {
      return { repairedCount: 0, units: [] };
    }

    const ids = staleBatteryUnits.map((unit) => unit.id);
    const update = await tx.bulkSkuUnit.updateMany({
      where: {
        id: { in: ids },
        status: BulkUnitStatus.CHECKED_OUT,
        allocations: {
          none: {
            checkedOutAt: { not: null },
            checkedInAt: null,
          },
        },
      },
      data: { status: BulkUnitStatus.AVAILABLE },
    });

    await createAuditEntriesTx(tx, staleBatteryUnits.map((unit) => ({
      actorId: user.id,
      actorRole: user.role,
      entityType: "bulk_sku_unit",
      entityId: `${unit.bulkSkuId}#${unit.unitNumber}`,
      action: "repair_stale_checked_out",
      before: { status: unit.status },
      after: {
        status: BulkUnitStatus.AVAILABLE,
        reason,
        bulkSkuId: unit.bulkSkuId,
        unitNumber: unit.unitNumber,
      },
    })));

    return {
      repairedCount: update.count,
      units: staleBatteryUnits.map((unit) => ({
        id: unit.id,
        skuId: unit.bulkSkuId,
        skuName: unit.bulkSku.name,
        unitNumber: unit.unitNumber,
      })),
    };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  return ok({ data: result });
});
