import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { ok, HttpError } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { updateBulkSkuSchema } from "@/lib/validation";
import { createAuditEntry } from "@/lib/audit";
import { buildActiveBulkUnitAllocationMap } from "@/lib/bulk-unit-status";
import { summarizeItemFamilyState } from "@/lib/item-family-state";

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

  const activeAllocationByUnitId = await loadActiveBulkUnitAllocationMap(sku.units.map((unit) => unit.id));
  const state = summarizeItemFamilyState(sku, activeAllocationByUnitId);

  return ok({ data: { ...sku, units: state.effectiveUnits, onHand: state.balanceOnHandQuantity, availableQuantity: state.availableQuantity } });
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
      units: { select: { id: true, status: true } },
    },
  });

  const activeAllocationByUnitId = await loadActiveBulkUnitAllocationMap(sku.units.map((unit) => unit.id));
  const state = summarizeItemFamilyState(sku, activeAllocationByUnitId);
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

  return ok({ data: { ...skuRest, onHand: state.balanceOnHandQuantity, availableQuantity: state.availableQuantity } });
});

async function loadActiveBulkUnitAllocationMap(unitIds: string[]) {
  if (unitIds.length === 0) return new Map<string, { bulkSkuUnitId: string }>();

  const activeAllocations = await db.bookingBulkUnitAllocation.findMany({
    where: {
      bulkSkuUnitId: { in: unitIds },
      checkedOutAt: { not: null },
      checkedInAt: null,
    },
    select: { bulkSkuUnitId: true },
    orderBy: { checkedOutAt: "desc" },
  });

  return buildActiveBulkUnitAllocationMap(activeAllocations);
}

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
