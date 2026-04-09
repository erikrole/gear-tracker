import { Prisma } from "@prisma/client";
import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { ok } from "@/lib/http";
import { createAuditEntry } from "@/lib/audit";

export const POST = withAuth<{ id: string }>(async (req, { user, params }) => {
  const { id } = params;

  // Toggle: if exists, delete; if not, create
  const existing = await db.favoriteItem.findUnique({
    where: { userId_assetId: { userId: user.id, assetId: id } },
  });

  if (existing) {
    // Use deleteMany to handle concurrent delete race (returns count 0 if already gone)
    await db.favoriteItem.deleteMany({
      where: { userId: user.id, assetId: id },
    });
    await createAuditEntry({
      actorId: user.id,
      actorRole: user.role,
      entityType: "asset",
      entityId: id,
      action: "favorite_removed",
    });
    return ok({ favorited: false });
  }

  try {
    await db.favoriteItem.create({
      data: { userId: user.id, assetId: id },
    });
  } catch (e) {
    // Concurrent toggle created it first — treat as idempotent success
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return ok({ favorited: true });
    }
    throw e;
  }
  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "asset",
    entityId: id,
    action: "favorite_added",
  });
  return ok({ favorited: true });
});
