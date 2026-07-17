import { Prisma } from "@prisma/client";
import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { HttpError, ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { createAuditEntry } from "@/lib/audit";
import { MAX_NUMBERED_UNITS_PER_CREATE } from "@/lib/request-limits";

/**
 * POST /api/bulk-skus/[id]/convert-to-numbered
 *
 * Converts a plain quantity-tracking BulkSku to numbered unit tracking.
 * Creates unit records 1..onHandQuantity from the current balance.
 */
export const POST = withAuth<{ id: string }>(async (_req, { user, params }) => {
  requirePermission(user.role, "bulk_sku", "adjust");
  const { id } = params;

  const result = await db.$transaction(async (tx) => {
    const sku = await tx.bulkSku.findUnique({
      where: { id },
      include: { balances: true },
    });
    if (!sku) throw new HttpError(404, "Bulk SKU not found");
    if (sku.trackByNumber) throw new HttpError(400, "SKU already tracks by number");

    const currentLocationBalance = sku.balances.find(
      (balance) => balance.locationId === sku.locationId,
    );
    const offLocationBalance = sku.balances.find(
      (balance) => balance.locationId !== sku.locationId && balance.onHandQuantity !== 0,
    );
    if (offLocationBalance) {
      throw new HttpError(409, "Nonzero bulk stock exists outside the current location");
    }
    const onHand = currentLocationBalance?.onHandQuantity ?? 0;
    if (onHand < 0) {
      throw new HttpError(409, "Bulk stock balance cannot be negative");
    }
    if (onHand > MAX_NUMBERED_UNITS_PER_CREATE) {
      throw new HttpError(
        409,
        `Convert at most ${MAX_NUMBERED_UNITS_PER_CREATE} numbered units at once`,
      );
    }

    await tx.bulkSku.update({
      where: { id },
      data: { trackByNumber: true },
    });

    if (onHand > 0) {
      await tx.bulkSkuUnit.createMany({
        data: Array.from({ length: onHand }, (_, i) => ({
          bulkSkuId: id,
          unitNumber: i + 1,
        })),
      });
    }

    return { converted: true, unitsCreated: onHand };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "bulk_sku",
    entityId: id,
    action: "convert_to_numbered",
    after: result,
  });

  return ok({ data: result });
});
