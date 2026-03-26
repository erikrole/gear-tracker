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
    await db.favoriteItem.delete({ where: { id: existing.id } });
    await createAuditEntry({
      actorId: user.id,
      actorRole: user.role,
      entityType: "asset",
      entityId: id,
      action: "favorite_removed",
    });
    return ok({ favorited: false });
  }

  await db.favoriteItem.create({
    data: { userId: user.id, assetId: id },
  });
  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "asset",
    entityId: id,
    action: "favorite_added",
  });
  return ok({ favorited: true });
});
