import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { fail, ok } from "@/lib/http";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth();
    const { id } = await ctx.params;

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
  } catch (error) {
    return fail(error);
  }
}
