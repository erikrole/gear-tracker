import { z } from "zod";
import { Prisma } from "@prisma/client";
import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { ok, HttpError } from "@/lib/http";
import { requirePermission, requirePermissionOrCollaboratorCapability } from "@/lib/rbac";
import { createAuditEntry } from "@/lib/audit";
import { enforceRateLimit, SETTINGS_MUTATION_LIMIT } from "@/lib/rate-limit";

const createSchema = z.object({
  name: z.string().trim().min(1).max(100),
  parentId: z.string().cuid().nullable().optional(),
});

export const GET = withAuth(async (_req, { user }) => {
  requirePermissionOrCollaboratorCapability(user, "category", "view", "GEAR_CATALOG_VIEW");
  const [categories, assetCounts, bulkCounts] = await Promise.all([
    db.category.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, parentId: true },
    }),
    db.asset.groupBy({
      by: ["categoryId"],
      where: { categoryId: { not: null } },
      _count: { id: true },
    }),
    db.bulkSku.groupBy({
      by: ["categoryId"],
      where: { categoryId: { not: null } },
      _count: { id: true },
    }),
  ]);

  const countMap = new Map<string, number>();
  for (const row of assetCounts) {
    if (row.categoryId) {
      countMap.set(row.categoryId, (countMap.get(row.categoryId) ?? 0) + row._count.id);
    }
  }
  for (const row of bulkCounts) {
    if (row.categoryId) {
      countMap.set(row.categoryId, (countMap.get(row.categoryId) ?? 0) + row._count.id);
    }
  }

  const data = categories.map((c) => ({
    ...c,
    itemCount: countMap.get(c.id) ?? 0,
  }));

  // Admin-mutated taxonomy: do not HTTP-cache, or a rename/delete reload can
  // serve a stale list from the browser cache for up to the max-age window.
  return ok({
    data: user.role === "COLLABORATOR"
      ? data.map(({ id, name, parentId }) => ({ id, name, parentId }))
      : data,
  });
});

export const POST = withAuth(async (req, { user }) => {
  requirePermission(user.role, "category", "create");
  await enforceRateLimit(`categories:write:${user.id}`, SETTINGS_MUTATION_LIMIT);

  const body = createSchema.parse(await req.json());
  const parentId = body.parentId ?? null;

  if (parentId) {
    const parent = await db.category.findUnique({ where: { id: parentId } });
    if (!parent) throw new HttpError(404, "Parent category not found");
  }

  const duplicate = await db.category.findFirst({
    where: { name: body.name, parentId },
  });
  if (duplicate) throw new HttpError(409, "Category already exists in this level");

  try {
    const category = await db.category.create({
      data: {
        name: body.name,
        parentId,
      },
    });

    await createAuditEntry({
      actorId: user.id,
      actorRole: user.role,
      entityType: "category",
      entityId: category.id,
      action: "created",
      after: { name: category.name, parentId: category.parentId },
    });

    return ok({ data: category }, 201);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError
      && error.code === "P2002"
    ) {
      throw new HttpError(409, "Category already exists in this level");
    }
    throw error;
  }
});
