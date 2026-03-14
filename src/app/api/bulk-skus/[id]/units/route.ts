export const runtime = "edge";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { fail, HttpError, ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { addBulkUnitsSchema } from "@/lib/validation";
import { createAuditEntry } from "@/lib/audit";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const { id } = await ctx.params;

    const sku = await db.bulkSku.findUnique({ where: { id } });
    if (!sku) throw new HttpError(404, "Bulk SKU not found");
    if (!sku.trackByNumber) throw new HttpError(400, "This SKU does not track by number");

    const units = await db.bulkSkuUnit.findMany({
      where: { bulkSkuId: id },
      orderBy: { unitNumber: "asc" }
    });

    return ok({ data: units });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireAuth();
    requirePermission(actor.role, "bulk_sku", "adjust");
    const { id } = await ctx.params;
    const body = addBulkUnitsSchema.parse(await req.json());

    const result = await db.$transaction(async (tx) => {
      const sku = await tx.bulkSku.findUnique({ where: { id } });
      if (!sku) throw new HttpError(404, "Bulk SKU not found");
      if (!sku.trackByNumber) throw new HttpError(400, "This SKU does not track by number");

      const maxUnit = await tx.bulkSkuUnit.findFirst({
        where: { bulkSkuId: id },
        orderBy: { unitNumber: "desc" }
      });

      const startNumber = (maxUnit?.unitNumber ?? 0) + 1;

      await tx.bulkSkuUnit.createMany({
        data: Array.from({ length: body.count }, (_, i) => ({
          bulkSkuId: id,
          unitNumber: startNumber + i
        }))
      });

      await tx.bulkStockBalance.update({
        where: {
          bulkSkuId_locationId: {
            bulkSkuId: id,
            locationId: sku.locationId
          }
        },
        data: { onHandQuantity: { increment: body.count } }
      });

      await tx.bulkStockMovement.create({
        data: {
          bulkSkuId: id,
          locationId: sku.locationId,
          actorUserId: actor.id,
          kind: "ADJUSTMENT",
          quantity: body.count,
          reason: `Added units #${startNumber}–#${startNumber + body.count - 1}`
        }
      });

      return { startNumber, endNumber: startNumber + body.count - 1 };
    });

    await createAuditEntry({
      actorId: actor.id,
      actorRole: actor.role,
      entityType: "bulk_sku",
      entityId: id,
      action: "add_units",
      after: result,
    });

    return ok({ data: result }, 201);
  } catch (error) {
    return fail(error);
  }
}
