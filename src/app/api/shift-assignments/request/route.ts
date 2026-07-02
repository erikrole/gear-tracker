import { withAuth } from "@/lib/api";
import { ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { requestShiftSchema } from "@/lib/validation";
import { pickupOpenShift } from "@/lib/services/schedule-open-work";
import { createAuditEntry } from "@/lib/audit";
import { dispatchScheduleAssignmentNotifications } from "@/lib/services/notifications";

export const POST = withAuth(async (req, { user }) => {
  requirePermission(user.role, "shift_assignment", "request");

  const body = requestShiftSchema.parse(await req.json());
  const assignment = await pickupOpenShift(body.shiftId, user.id);

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "shift_assignment",
    entityId: assignment.id,
    action: "shift_pickup_claimed",
    after: {
      shiftId: body.shiftId,
      status: assignment.status,
      hasConflict: assignment.hasConflict,
      conflictNote: assignment.conflictNote,
    },
  });

  dispatchScheduleAssignmentNotifications(assignment.id, "assigned").catch(() => {});

  return ok({ data: assignment }, 201);
});
