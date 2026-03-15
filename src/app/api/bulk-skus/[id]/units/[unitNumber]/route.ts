export const runtime = "edge";
import { BulkUnitStatus } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { fail, HttpError, ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { updateBulkUnitSchema } from "@/lib/validation";
import { createAuditEntry } from "@/lib/audit";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string; unitNumber: string }> }
) {
  try {
    const actor = await requireAuth();
    requirePermission(actor.role, "bulk_sku", "adjust");
    const { id, unitNumber: unitNumStr } = await ctx.params;
    const unitNumber = parseInt(unitNumStr, 10);
    if (isNaN(unitNumber)) throw new HttpError(400, "Invalid unit number");

    const body = updateBulkUnitSchema.parse(await req.json());

    const result = await db.$transaction(async (tx) => {
      const unit = await tx.bulkSkuUnit.findUnique({
        where: { bulkSkuId_unitNumber: { bulkSkuId: id, unitNumber } }
      });
      if (!unit) throw new HttpError(404, "Unit not found");

      if (unit.status === BulkUnitStatus.CHECKED_OUT && body.status !== "AVAILABLE") {
        throw new HttpError(
          409,
          "Cannot mark a checked-out unit as lost/retired. Check it in first."
        );
      }

      const before = { status: unit.status, notes: unit.notes };

      const updated = await tx.bulkSkuUnit.update({
        where: { id: unit.id },
        data: {
          status: body.status as BulkUnitStatus,
          notes: body.notes ?? unit.notes
        }
      });

      // Adjust on-hand balance when taking a unit out of / back into service
      const wasAvailable = unit.status === BulkUnitStatus.AVAILABLE;
      const isAvailable = body.status === "AVAILABLE";

      if (wasAvailable && !isAvailable) {
        const sku = await tx.bulkSku.findUniqueOrThrow({ where: { id } });
        await tx.bulkStockBalance.update({
          where: {
            bulkSkuId_locationId: { bulkSkuId: id, locationId: sku.locationId }
          },
          data: { onHandQuantity: { decrement: 1 } }
        });
      } else if (!wasAvailable && isAvailable) {
        const sku = await tx.bulkSku.findUniqueOrThrow({ where: { id } });
        await tx.bulkStockBalance.update({
          where: {
            bulkSkuId_locationId: { bulkSkuId: id, locationId: sku.locationId }
          },
          data: { onHandQuantity: { increment: 1 } }
        });
      }

      return { before, updated };
    });

    await createAuditEntry({
      actorId: actor.id,
      actorRole: actor.role,
      entityType: "bulk_sku_unit",
      entityId: `${id}#${unitNumber}`,
      action: "update_status",
      before: result.before,
      after: { status: result.updated.status, notes: result.updated.notes },
    });

    return ok({ data: result.updated });
  } catch (error) {
    return fail(error);
  }
}
