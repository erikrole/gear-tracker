import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { ok, HttpError } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { updateBulkSkuSchema } from "@/lib/validation";
import { createAuditEntry } from "@/lib/audit";

export const GET = withAuth<{ id: string }>(async (_req, { params }) => {
  const sku = await db.bulkSku.findUnique({
    where: { id: params.id },
    include: {
      location: { select: { id: true, name: true } },
      categoryRel: { select: { id: true, name: true } },
      department: { select: { id: true, name: true } },
      balances: true,
      units: {
        orderBy: { unitNumber: "asc" },
        include: {
          allocations: {
            orderBy: { createdAt: "desc" },
            take: 1,
            include: {
              bookingBulkItem: {
                include: {
                  booking: {
                    select: {
                      refNumber: true,
                      title: true,
                      requester: { select: { name: true } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!sku) throw new HttpError(404, "Bulk SKU not found");

  const onHand = sku.balances.reduce((s, b) => s + b.onHandQuantity, 0);
  const availableQuantity = sku.trackByNumber
    ? sku.units.filter((u) => u.status === "AVAILABLE").length
    : Math.max(0, onHand);

  return ok({ data: { ...sku, onHand, availableQuantity } });
});

export const PATCH = withAuth<{ id: string }>(async (req, { user, params }) => {
  requirePermission(user.role, "bulk_sku", "edit");
  const body = updateBulkSkuSchema.parse(await req.json());

  const before = await db.bulkSku.findUnique({ where: { id: params.id } });
  if (!before) throw new HttpError(404, "Bulk SKU not found");

  const category = body.categoryId
    ? await db.category.findUnique({
        where: { id: body.categoryId },
        select: { name: true },
      })
    : null;
  if (body.categoryId && !category) throw new HttpError(400, "Category not found");
  const data = category ? { ...body, category: category.name } : body;

  const sku = await db.bulkSku.update({
    where: { id: params.id },
    data,
    include: {
      location: { select: { id: true, name: true } },
      categoryRel: { select: { id: true, name: true } },
      department: { select: { id: true, name: true } },
      balances: true,
      units: { where: { status: "AVAILABLE" }, select: { id: true } },
    },
  });

  const onHand = sku.balances.reduce((s, b) => s + b.onHandQuantity, 0);
  const availableQuantity = sku.trackByNumber
    ? sku.units.length
    : Math.max(0, onHand);
  const skuRest = Object.fromEntries(
    Object.entries(sku).filter(([key]) => key !== "units"),
  );

  const changedKeys = Object.keys(data);
  const beforeDiff: Record<string, unknown> = {};
  const afterDiff: Record<string, unknown> = {};
  for (const key of changedKeys) {
    beforeDiff[key] = (before as Record<string, unknown>)[key] ?? null;
    afterDiff[key] = (sku as Record<string, unknown>)[key] ?? null;
  }

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "bulk_sku",
    entityId: params.id,
    action: "updated",
    before: beforeDiff,
    after: afterDiff,
  });

  return ok({ data: { ...skuRest, onHand, availableQuantity } });
});

export const DELETE = withAuth<{ id: string }>(async (_req, { user, params }) => {
  requirePermission(user.role, "bulk_sku", "delete");

  const sku = await db.bulkSku.findUnique({ where: { id: params.id } });
  if (!sku) throw new HttpError(404, "Bulk SKU not found");

  const bookingCount = await db.bookingBulkItem.count({ where: { bulkSkuId: params.id } });
  if (bookingCount > 0) {
    throw new HttpError(409, "Cannot delete: this SKU has booking history.");
  }

  await db.bulkSku.delete({ where: { id: params.id } });

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "bulk_sku",
    entityId: params.id,
    action: "deleted",
    before: { name: sku.name },
  });

  return ok({ success: true });
});
