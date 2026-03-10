export const runtime = "edge";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { fail, HttpError, ok } from "@/lib/http";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth();
    if (user.role !== "ADMIN" && user.role !== "STAFF") {
      throw new HttpError(403, "Forbidden");
    }

    const { id } = await ctx.params;
    const before = await db.asset.findUnique({ where: { id } });
    if (!before) throw new HttpError(404, "Asset not found");

    const asset = await db.asset.update({
      where: { id },
      data: { status: "RETIRED" },
      include: { location: true, category: true },
    });

    await db.auditLog.create({
      data: {
        actorUserId: user.id,
        entityType: "asset",
        entityId: id,
        action: "retired",
        beforeJson: { status: before.status },
        afterJson: { status: "RETIRED" },
      },
    });

    return ok({ data: asset });
  } catch (error) {
    return fail(error);
  }
}
