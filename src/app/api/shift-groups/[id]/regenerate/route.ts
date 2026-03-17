import { withAuth } from "@/lib/api";
import { ok, HttpError } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { db } from "@/lib/db";
import { regenerateShiftsForEvent } from "@/lib/services/shift-generation";
import { createAuditEntry } from "@/lib/audit";

export const POST = withAuth<{ id: string }>(async (_req, { user, params }) => {
  requirePermission(user.role, "shift", "create");
  const { id } = params;

  const group = await db.shiftGroup.findUnique({
    where: { id },
    select: { eventId: true },
  });
  if (!group) throw new HttpError(404, "Shift group not found");

  const result = await regenerateShiftsForEvent(group.eventId);

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "shift_group",
    entityId: id,
    action: "shift_group_regenerated",
    after: { added: result.added },
  });

  return ok({ data: result });
});
