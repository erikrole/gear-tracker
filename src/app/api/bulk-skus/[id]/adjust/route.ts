import { BulkMovementKind } from "@prisma/client";
import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { HttpError, ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { adjustBulkSchema } from "@/lib/validation";
import { createAuditEntry } from "@/lib/audit";

export const POST = withAuth<{ id: string }>(async (req, { user, params }) => {
  requirePermission(user.role, "bulk_sku", "adjust");
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
        actorUserId: user.id,
        kind: BulkMovementKind.ADJUSTMENT,
        quantity: Math.abs(body.quantityDelta),
        reason: body.reason
      }
    });

    return { current, next };
  });

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "bulk_sku",
    entityId: params.id,
    action: "adjust",
    after: { quantityDelta: body.quantityDelta, reason: body.reason, ...result },
  });

  return ok({ data: result });
});
