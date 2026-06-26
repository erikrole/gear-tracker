import { Prisma } from "@prisma/client";
import { withAuth } from "@/lib/api";
import { createAuditEntry } from "@/lib/audit";
import { db } from "@/lib/db";
import { HttpError, ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";

export const POST = withAuth<{ id: string }>(async (_req, { user, params }) => {
  requirePermission(user.role, "asset", "favorite");

  const { id } = params;
  const sku = await db.bulkSku.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!sku) throw new HttpError(404, "Item family not found");

  const existing = await db.favoriteItemFamily.findUnique({
    where: { userId_bulkSkuId: { userId: user.id, bulkSkuId: id } },
  });

  if (existing) {
    await db.favoriteItemFamily.deleteMany({
      where: { userId: user.id, bulkSkuId: id },
    });
    await createAuditEntry({
      actorId: user.id,
      actorRole: user.role,
      entityType: "bulk_sku",
      entityId: id,
      action: "favorite_removed",
    });
    return ok({ favorited: false });
  }

  try {
    await db.favoriteItemFamily.create({
      data: { userId: user.id, bulkSkuId: id },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return ok({ favorited: true });
    }
    throw e;
  }

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "bulk_sku",
    entityId: id,
    action: "favorite_added",
  });
  return ok({ favorited: true });
});
