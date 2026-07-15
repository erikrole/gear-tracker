import { Prisma } from "@prisma/client";
import { withAuth } from "@/lib/api";
import { createAuditEntryTx } from "@/lib/audit";
import { db } from "@/lib/db";
import { HttpError, ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { assignBulkUnitProductSchema } from "@/lib/validation";

export const PATCH = withAuth<{ id: string; unitNumber: string }>(async (req, { user, params }) => {
  requirePermission(user.role, "bulk_sku", "adjust");
  const unitNumber = Number(params.unitNumber);
  if (!Number.isSafeInteger(unitNumber) || unitNumber <= 0) {
    throw new HttpError(400, "Invalid unit number");
  }
  const body = assignBulkUnitProductSchema.parse(await req.json());

  const updated = await db.$transaction(async (tx) => {
    const unit = await tx.bulkSkuUnit.findUnique({
      where: { bulkSkuId_unitNumber: { bulkSkuId: params.id, unitNumber } },
      include: { product: { select: { id: true, name: true } } },
    });
    if (!unit) throw new HttpError(404, "Unit not found");

    let product: { id: string; name: string } | null = null;
    if (body.productId) {
      product = await tx.bulkSkuProduct.findFirst({
        where: { id: body.productId, bulkSkuId: params.id, active: true },
        select: { id: true, name: true },
      });
      if (!product) throw new HttpError(400, "Active product not found in this item family");
    }

    const result = await tx.bulkSkuUnit.update({
      where: { id: unit.id },
      data: { productId: product?.id ?? null },
      include: { product: true },
    });

    await createAuditEntryTx(tx, {
      actorId: user.id,
      actorRole: user.role,
      entityType: "bulk_sku_unit",
      entityId: `${params.id}#${unitNumber}`,
      action: "assign_product",
      before: { productId: unit.product?.id ?? null, productName: unit.product?.name ?? null },
      after: { productId: product?.id ?? null, productName: product?.name ?? null },
    });

    return result;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  return ok({ data: updated });
});
