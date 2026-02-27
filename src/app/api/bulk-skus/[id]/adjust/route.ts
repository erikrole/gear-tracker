export const runtime = "edge";
import { BulkMovementKind } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { fail, HttpError, ok } from "@/lib/http";
import { adjustBulkSchema } from "@/lib/validation";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireAuth();
    const params = await ctx.params;
    const body = adjustBulkSchema.parse(await req.json());

    const result = await db.$transaction(async (tx) => {
      const sku = await tx.bulkSku.findUnique({ where: { id: params.id } });
      if (!sku) {
        throw new HttpError(404, "Bulk SKU not found");
      }

      const balance = await tx.bulkStockBalance.findUnique({
        where: {
          bulkSkuId_locationId: {
            bulkSkuId: sku.id,
            locationId: sku.locationId
          }
        }
      });

      const current = balance?.onHandQuantity ?? 0;
      const next = current + body.quantityDelta;
      if (next < 0) {
        throw new HttpError(409, `Adjustment would drop stock below zero. Current: ${current}`);
      }

      await tx.bulkStockBalance.upsert({
        where: {
          bulkSkuId_locationId: {
            bulkSkuId: sku.id,
            locationId: sku.locationId
          }
        },
        create: {
          bulkSkuId: sku.id,
          locationId: sku.locationId,
          onHandQuantity: next
        },
        update: {
          onHandQuantity: next
        }
      });

      await tx.bulkStockMovement.create({
        data: {
          bulkSkuId: sku.id,
          locationId: sku.locationId,
          actorUserId: actor.id,
          kind: BulkMovementKind.ADJUSTMENT,
          quantity: Math.abs(body.quantityDelta),
          reason: body.reason
        }
      });

      return { current, next };
    });

    return ok({ data: result });
  } catch (error) {
    return fail(error);
  }
}
