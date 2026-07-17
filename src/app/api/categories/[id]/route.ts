import { z } from "zod";
import { Prisma } from "@prisma/client";
import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { HttpError, ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { createAuditEntryTx } from "@/lib/audit";
import { enforceRateLimit, SETTINGS_MUTATION_LIMIT } from "@/lib/rate-limit";
import {
  assertValidCategoryPlacement,
  loadCategoryGraph,
  rethrowCategoryMutationError,
  withCategorySerializableRetry,
} from "@/lib/services/category-mutations";

const updateSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  parentId: z.string().cuid().nullable().optional(),
}).refine((body) => body.name !== undefined || body.parentId !== undefined, {
  message: "No fields to update",
});

export const PATCH = withAuth<{ id: string }>(async (req, { user, params }) => {
  requirePermission(user.role, "category", "edit");
  await enforceRateLimit(`categories:write:${user.id}`, SETTINGS_MUTATION_LIMIT);

  const { id } = params;
  const body = updateSchema.parse(await req.json());

  try {
    const category = await withCategorySerializableRetry(() => db.$transaction(async (tx) => {
      const graph = await loadCategoryGraph(tx);
      const existing = graph.find((node) => node.id === id);
      if (!existing) throw new HttpError(404, "Category not found");

      const nextName = body.name ?? existing.name;
      const nextParentId = body.parentId !== undefined ? body.parentId : existing.parentId;
      if (body.parentId !== undefined) {
        assertValidCategoryPlacement(graph, id, nextParentId);
      }

      const duplicate = await tx.category.findFirst({
        where: {
          id: { not: id },
          name: nextName,
          parentId: nextParentId,
        },
      });
      if (duplicate) throw new HttpError(409, "Category already exists in this level");

      const updated = await tx.category.update({
        where: { id },
        data: {
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.parentId !== undefined ? { parentId: body.parentId } : {}),
        },
      });

      await createAuditEntryTx(tx, {
        actorId: user.id,
        actorRole: user.role,
        entityType: "category",
        entityId: id,
        action: "updated",
        before: { name: existing.name, parentId: existing.parentId },
        after: { name: updated.name, parentId: updated.parentId },
      });

      return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));

    return ok({ data: category });
  } catch (error) {
    rethrowCategoryMutationError(error, {
      foreignKeyMessage: "Parent category not found",
      notFoundMessage: "Category not found",
    });
  }
});

export const DELETE = withAuth<{ id: string }>(async (_req, { user, params }) => {
  requirePermission(user.role, "category", "delete");
  await enforceRateLimit(`categories:write:${user.id}`, SETTINGS_MUTATION_LIMIT);

  const { id } = params;
  try {
    await withCategorySerializableRetry(() => db.$transaction(async (tx) => {
      const existing = await tx.category.findUnique({ where: { id } });
      if (!existing) throw new HttpError(404, "Category not found");

      const [assetCount, bulkCount, childCount] = await Promise.all([
        tx.asset.count({ where: { categoryId: id } }),
        tx.bulkSku.count({ where: { categoryId: id } }),
        tx.category.count({ where: { parentId: id } }),
      ]);

      if (assetCount > 0 || bulkCount > 0) {
        throw new HttpError(409, `Cannot delete: ${assetCount + bulkCount} items are linked to this category`);
      }
      if (childCount > 0) {
        throw new HttpError(409, "Cannot delete: category has subcategories");
      }

      await tx.category.delete({ where: { id } });
      await createAuditEntryTx(tx, {
        actorId: user.id,
        actorRole: user.role,
        entityType: "category",
        entityId: id,
        action: "deleted",
        before: { name: existing.name, parentId: existing.parentId },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));

    return ok({ success: true });
  } catch (error) {
    rethrowCategoryMutationError(error, {
      foreignKeyMessage: "Cannot delete: category gained linked items or subcategories",
      notFoundMessage: "Category not found",
    });
  }
});
