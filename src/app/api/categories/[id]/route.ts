import { z } from "zod";
import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { HttpError, ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { createAuditEntry } from "@/lib/audit";
import { enforceRateLimit, SETTINGS_MUTATION_LIMIT } from "@/lib/rate-limit";

const updateSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  parentId: z.string().cuid().nullable().optional(),
}).refine((body) => body.name !== undefined || body.parentId !== undefined, {
  message: "No fields to update",
});
const MAX_CATEGORY_PARENT_DEPTH = 25;

export const PATCH = withAuth<{ id: string }>(async (req, { user, params }) => {
  requirePermission(user.role, "category", "edit");
  await enforceRateLimit(`categories:write:${user.id}`, SETTINGS_MUTATION_LIMIT);

  const { id } = params;
  const [existing, body] = await Promise.all([
    db.category.findUnique({ where: { id } }),
    req.json().then(updateSchema.parse),
  ]);
  if (!existing) throw new HttpError(404, "Category not found");
  if (body.parentId === id) {
    throw new HttpError(400, "Category cannot be its own parent");
  }

  if (body.parentId) {
    let parent = await db.category.findUnique({
      where: { id: body.parentId },
      select: { id: true, parentId: true },
    });
    if (!parent) throw new HttpError(404, "Parent category not found");

    let depth = 0;
    while (parent.parentId) {
      depth += 1;
      if (depth > MAX_CATEGORY_PARENT_DEPTH) {
        throw new HttpError(400, "Category parent chain is too deep");
      }
      if (parent.parentId === id) {
        throw new HttpError(400, "Category cannot be moved under one of its subcategories");
      }
      parent = await db.category.findUnique({
        where: { id: parent.parentId },
        select: { id: true, parentId: true },
      });
      if (!parent) break;
    }
  }

  const nextName = body.name ?? existing.name;
  const nextParentId = body.parentId !== undefined ? body.parentId : existing.parentId;
  const duplicate = await db.category.findFirst({
    where: {
      id: { not: id },
      name: nextName,
      parentId: nextParentId,
    },
  });
  if (duplicate) throw new HttpError(409, "Category already exists in this level");

  const category = await db.category.update({
    where: { id },
    data: {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.parentId !== undefined ? { parentId: body.parentId } : {}),
    },
  });

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "category",
    entityId: id,
    action: "updated",
    before: { name: existing.name, parentId: existing.parentId },
    after: { name: category.name, parentId: category.parentId },
  });

  return ok({ data: category });
});

export const DELETE = withAuth<{ id: string }>(async (_req, { user, params }) => {
  requirePermission(user.role, "category", "delete");
  await enforceRateLimit(`categories:write:${user.id}`, SETTINGS_MUTATION_LIMIT);

  const { id } = params;
  const existing = await db.category.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, "Category not found");

  // Check for linked items
  const [assetCount, bulkCount, childCount] = await Promise.all([
    db.asset.count({ where: { categoryId: id } }),
    db.bulkSku.count({ where: { categoryId: id } }),
    db.category.count({ where: { parentId: id } }),
  ]);

  if (assetCount > 0 || bulkCount > 0) {
    throw new HttpError(409, `Cannot delete: ${assetCount + bulkCount} items are linked to this category`);
  }

  if (childCount > 0) {
    throw new HttpError(409, "Cannot delete: category has subcategories");
  }

  await db.category.delete({ where: { id } });

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "category",
    entityId: id,
    action: "deleted",
    before: { name: existing.name, parentId: existing.parentId },
  });

  return ok({ success: true });
});
