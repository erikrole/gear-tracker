import { z } from "zod";
import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { createAuditEntries } from "@/lib/audit";

const schema = z.object({
  // Matches the cap on /api/assets/bulk so "Select all matching" (up to 5,000)
  // can be starred/unstarred in one request.
  assetIds: z.array(z.string().cuid()).min(1).max(5000),
  action: z.enum(["add", "remove"]),
});

export const POST = withAuth(async (req, { user }) => {
  requirePermission(user.role, "asset", "favorite");

  const { assetIds, action } = schema.parse(await req.json());

  if (action === "add") {
    // Only favorite assets that exist and aren't already favorited. Filtering
    // up front avoids an FK violation (P2002/P2003) and keeps the count + audit
    // trail accurate (mirrors the single-item endpoint).
    const [existing, alreadyFavorited] = await Promise.all([
      db.asset.findMany({ where: { id: { in: assetIds } }, select: { id: true } }),
      db.favoriteItem.findMany({
        where: { userId: user.id, assetId: { in: assetIds } },
        select: { assetId: true },
      }),
    ]);
    const alreadySet = new Set(alreadyFavorited.map((f) => f.assetId));
    const toAdd = existing.map((a) => a.id).filter((id) => !alreadySet.has(id));

    if (toAdd.length === 0) return ok({ data: { count: 0, action } });

    await db.favoriteItem.createMany({
      data: toAdd.map((assetId) => ({ userId: user.id, assetId })),
      skipDuplicates: true,
    });
    await createAuditEntries(
      toAdd.map((assetId) => ({
        actorId: user.id,
        actorRole: user.role,
        entityType: "asset",
        entityId: assetId,
        action: "favorite_added",
      })),
    );
    return ok({ data: { count: toAdd.length, action } });
  }

  // remove: audit only the favorites that actually existed.
  const existingFavs = await db.favoriteItem.findMany({
    where: { userId: user.id, assetId: { in: assetIds } },
    select: { assetId: true },
  });
  const toRemove = existingFavs.map((f) => f.assetId);

  if (toRemove.length === 0) return ok({ data: { count: 0, action } });

  await db.favoriteItem.deleteMany({
    where: { userId: user.id, assetId: { in: toRemove } },
  });
  await createAuditEntries(
    toRemove.map((assetId) => ({
      actorId: user.id,
      actorRole: user.role,
      entityType: "asset",
      entityId: assetId,
      action: "favorite_removed",
    })),
  );
  return ok({ data: { count: toRemove.length, action } });
});
