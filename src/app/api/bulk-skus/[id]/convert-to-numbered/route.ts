import { Prisma } from "@prisma/client";
import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { HttpError, ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { createAuditEntry } from "@/lib/audit";

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

    const onHand = sku.balances[0]?.onHandQuantity ?? 0;

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
