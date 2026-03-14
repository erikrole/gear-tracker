export const runtime = "edge";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { fail, ok } from "@/lib/http";
import { createAuditEntry } from "@/lib/audit";

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  parentId: z.string().cuid().nullable().optional(),
});

type RouteCtx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: RouteCtx) {
  try {
    const user = await requireAuth();
    if (user.role !== "ADMIN" && user.role !== "STAFF") {
      return ok({ error: "Forbidden" }, 403);
    }

    const { id } = await ctx.params;
    const existing = await db.category.findUnique({ where: { id } });
    if (!existing) return ok({ error: "Category not found" }, 404);

    const body = updateSchema.parse(await req.json());

    // Prevent circular parent reference
    if (body.parentId === id) {
      return ok({ error: "Category cannot be its own parent" }, 400);
    }

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
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(req: Request, ctx: RouteCtx) {
  try {
    const user = await requireAuth();
    if (user.role !== "ADMIN") {
      return ok({ error: "Forbidden" }, 403);
    }

    const { id } = await ctx.params;
    const existing = await db.category.findUnique({ where: { id } });
    if (!existing) return ok({ error: "Category not found" }, 404);

    // Check for linked items
    const [assetCount, bulkCount, childCount] = await Promise.all([
      db.asset.count({ where: { categoryId: id } }),
      db.bulkSku.count({ where: { categoryId: id } }),
      db.category.count({ where: { parentId: id } }),
    ]);

    if (assetCount > 0 || bulkCount > 0) {
      return ok(
        { error: `Cannot delete: ${assetCount + bulkCount} items are linked to this category` },
        409
      );
    }

    if (childCount > 0) {
      return ok({ error: "Cannot delete: category has subcategories" }, 409);
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
  } catch (error) {
    return fail(error);
  }
}
