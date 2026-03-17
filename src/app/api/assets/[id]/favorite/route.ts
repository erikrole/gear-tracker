import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { ok } from "@/lib/http";

export const POST = withAuth<{ id: string }>(async (req, { user, params }) => {
  const { id } = params;

  // Toggle: if exists, delete; if not, create
  const existing = await db.favoriteItem.findUnique({
    where: { userId_assetId: { userId: user.id, assetId: id } },
  });

  if (existing) {
    await db.favoriteItem.delete({ where: { id: existing.id } });
    return ok({ favorited: false });
  }

  await db.favoriteItem.create({
    data: { userId: user.id, assetId: id },
  });
  return ok({ favorited: true });
});
