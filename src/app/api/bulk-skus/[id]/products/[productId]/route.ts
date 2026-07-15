import { Prisma } from "@prisma/client";
import { withAuth } from "@/lib/api";
import { createAuditEntryTx } from "@/lib/audit";
import { db } from "@/lib/db";
import { HttpError, ok } from "@/lib/http";
import {
  cleanItemFamilyProductText,
  cleanOptionalItemFamilyProductText,
  normalizeItemFamilyProductName,
} from "@/lib/item-family-products";
import { requirePermission } from "@/lib/rbac";
import { updateBulkSkuProductSchema } from "@/lib/validation";

export const PATCH = withAuth<{ id: string; productId: string }>(async (req, { user, params }) => {
  requirePermission(user.role, "bulk_sku", "edit");
  const body = updateBulkSkuProductSchema.parse(await req.json());

  try {
    const product = await db.$transaction(async (tx) => {
      const before = await tx.bulkSkuProduct.findUnique({ where: { id: params.productId } });
      if (!before || before.bulkSkuId !== params.id) throw new HttpError(404, "Product not found");

      const data = {
        ...(body.name !== undefined && {
          name: cleanItemFamilyProductText(body.name),
          normalizedName: normalizeItemFamilyProductName(body.name),
        }),
        ...(body.brand !== undefined && { brand: cleanItemFamilyProductText(body.brand) }),
        ...(body.model !== undefined && { model: cleanOptionalItemFamilyProductText(body.model) }),
        ...(body.active !== undefined && { active: body.active }),
      };

      const updated = await tx.bulkSkuProduct.update({
        where: { id: before.id },
        data,
        include: { _count: { select: { units: true } } },
      });

      await createAuditEntryTx(tx, {
        actorId: user.id,
        actorRole: user.role,
        entityType: "bulk_sku_product",
        entityId: updated.id,
        action: "updated",
        before: {
          name: before.name,
          brand: before.brand,
          model: before.model,
          active: before.active,
        },
        after: {
          name: updated.name,
          brand: updated.brand,
          model: updated.model,
          active: updated.active,
        },
      });

      return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return ok({ data: product });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new HttpError(409, "A product with this name already exists in the item family");
    }
    throw error;
  }
});
