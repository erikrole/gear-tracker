import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { fail, HttpError, ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { createAuditEntry } from "@/lib/audit";

/**
 * POST /api/bulk-skus/[id]/convert-to-numbered
 *
 * Converts a plain quantity-tracking BulkSku to numbered unit tracking.
 * Creates unit records 1..onHandQuantity from the current balance.
 */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireAuth();
    requirePermission(actor.role, "bulk_sku", "adjust");
    const { id } = await ctx.params;

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
    });

    await createAuditEntry({
      actorId: actor.id,
      actorRole: actor.role,
      entityType: "bulk_sku",
      entityId: id,
      action: "convert_to_numbered",
      after: result,
    });

    return ok({ data: result });
  } catch (error) {
    return fail(error);
  }
}
