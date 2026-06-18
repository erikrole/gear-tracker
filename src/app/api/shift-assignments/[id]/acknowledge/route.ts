import { withAuth } from "@/lib/api";
import { createAuditEntry } from "@/lib/audit";
import { ok } from "@/lib/http";
import { acknowledgeShiftAssignment } from "@/lib/services/schedule-publication";

export const POST = withAuth<{ id: string }>(async (_req, { user, params }) => {
  const result = await acknowledgeShiftAssignment(params.id, {
    id: user.id,
    role: user.role,
  });

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "shift_assignment",
    entityId: params.id,
    action: "shift_assignment_acknowledged",
    before: result.before,
    after: {
      acknowledgedAt: result.after.acknowledgedAt,
      acknowledgedById: result.after.acknowledgedById,
      shiftGroupId: result.shiftGroupId,
    },
  });

  return ok({ data: result.after });
});
