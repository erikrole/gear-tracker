import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { HttpError, ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { addBulkUnitsSchema } from "@/lib/validation";
import { createAuditEntry } from "@/lib/audit";

export const GET = withAuth<{ id: string }>(async (_req, { params }) => {
  const { id } = params;

  const sku = await db.bulkSku.findUnique({ where: { id } });
  if (!sku) throw new HttpError(404, "Bulk SKU not found");
  if (!sku.trackByNumber) throw new HttpError(400, "This SKU does not track by number");

  const units = await db.bulkSkuUnit.findMany({
    where: { bulkSkuId: id },
    orderBy: { unitNumber: "asc" }
  });

  return ok({ data: units });
});

export const POST = withAuth<{ id: string }>(async (req, { user, params }) => {
  requirePermission(user.role, "bulk_sku", "adjust");
  const { id } = params;
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
        actorUserId: user.id,
        kind: "ADJUSTMENT",
        quantity: body.count,
        reason: `Added units #${startNumber}–#${startNumber + body.count - 1}`
      }
    });

    return { startNumber, endNumber: startNumber + body.count - 1 };
  });

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "bulk_sku",
    entityId: id,
    action: "add_units",
    after: result,
  });

  return ok({ data: result }, 201);
});
