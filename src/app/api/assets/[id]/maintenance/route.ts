import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { HttpError, ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { createAuditEntry } from "@/lib/audit";

export const POST = withAuth<{ id: string }>(async (req, { user, params }) => {
  requirePermission(user.role, "asset", "maintenance");

  const { id } = params;

  // Wrap in SERIALIZABLE transaction to prevent concurrent toggle lost updates
  const { asset, beforeStatus, newStatus } = await db.$transaction(async (tx) => {
    const before = await tx.asset.findUnique({ where: { id } });
    if (!before) throw new HttpError(404, "Asset not found");

    const toggled = before.status === "MAINTENANCE" ? "AVAILABLE" : "MAINTENANCE";
    const updated = await tx.asset.update({
      where: { id },
      data: { status: toggled },
      include: { location: true, category: true },
    });

    return { asset: updated, beforeStatus: before.status, newStatus: toggled };
  }, { isolationLevel: "Serializable" });

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "asset",
    entityId: id,
    action: newStatus === "MAINTENANCE" ? "marked_maintenance" : "cleared_maintenance",
    before: { status: beforeStatus },
    after: { status: newStatus },
  });

  return ok({ data: asset });
});
