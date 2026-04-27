import { z } from "zod";
import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { ok, cachedOk, HttpError } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { createAuditEntry } from "@/lib/audit";
import { enforceRateLimit, SETTINGS_MUTATION_LIMIT } from "@/lib/rate-limit";

const createSchema = z.object({
  name: z.string().min(1).max(100),
  parentId: z.string().cuid().nullable().optional(),
});

export const GET = withAuth(async () => {
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

  return cachedOk({ data });
});

export const POST = withAuth(async (req, { user }) => {
  requirePermission(user.role, "category", "create");
  await enforceRateLimit(`categories:write:${user.id}`, SETTINGS_MUTATION_LIMIT);

  const body = createSchema.parse(await req.json());

  if (body.parentId) {
    const parent = await db.category.findUnique({ where: { id: body.parentId } });
    if (!parent) throw new HttpError(404, "Parent category not found");
  }

  const category = await db.category.create({
    data: {
      name: body.name,
      parentId: body.parentId ?? null,
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
});
