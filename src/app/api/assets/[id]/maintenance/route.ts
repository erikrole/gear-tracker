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

    // Toggle: if already MAINTENANCE, set back to AVAILABLE
    const newStatus = before.status === "MAINTENANCE" ? "AVAILABLE" : "MAINTENANCE";

    const asset = await db.asset.update({
      where: { id },
      data: { status: newStatus },
      include: { location: true, category: true },
    });

    await db.auditLog.create({
      data: {
        actorUserId: user.id,
        entityType: "asset",
        entityId: id,
        action: newStatus === "MAINTENANCE" ? "marked_maintenance" : "cleared_maintenance",
        beforeJson: { status: before.status },
        afterJson: { status: newStatus },
      },
    });

    return ok({ data: asset });
  } catch (error) {
    return fail(error);
  }
}
