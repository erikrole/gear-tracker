export const runtime = "edge";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { fail, HttpError, ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { createAuditEntry } from "@/lib/audit";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth();
    requirePermission(user.role, "asset", "maintenance");

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

    await createAuditEntry({
      actorId: user.id,
      actorRole: user.role,
      entityType: "asset",
      entityId: id,
      action: newStatus === "MAINTENANCE" ? "marked_maintenance" : "cleared_maintenance",
      before: { status: before.status },
      after: { status: newStatus },
    });

    return ok({ data: asset });
  } catch (error) {
    return fail(error);
  }
}
