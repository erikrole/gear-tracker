import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { HttpError, ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { createAuditEntry } from "@/lib/audit";

export const POST = withAuth<{ id: string }>(async (_req, { user, params }) => {
  requirePermission(user.role, "shift", "manage");
  const { id } = params;

  const group = await db.shiftGroup.findUnique({
    where: { id },
    select: { id: true, archivedAt: true, eventId: true },
  });
  if (!group) throw new HttpError(404, "Shift group not found");
  if (group.archivedAt) throw new HttpError(409, "Shift group already archived");

  const updated = await db.shiftGroup.update({
    where: { id },
    data: { archivedAt: new Date() },
    select: { id: true, archivedAt: true },
  });

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "shift_group",
    entityId: id,
    action: "shift_group_archived",
    after: { archivedAt: updated.archivedAt },
  });

  return ok({ data: updated });
});
