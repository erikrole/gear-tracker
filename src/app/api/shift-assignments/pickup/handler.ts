import type { AuthUser } from "@/lib/auth";
import { createAuditEntry } from "@/lib/audit";
import { ok } from "@/lib/http";
import { dispatchScheduleAssignmentNotifications } from "@/lib/services/notifications";
import { enforceRateLimit, SCHEDULE_MUTATION_LIMIT } from "@/lib/rate-limit";
import { requirePermission } from "@/lib/rbac";
import { pickupOpenShift } from "@/lib/services/schedule-open-work";
import { requestShiftSchema } from "@/lib/validation";

export async function handleOpenShiftPickup(
  req: Request,
  { user }: { user: AuthUser },
) {
  requirePermission(user.role, "shift_assignment", "request");
  await enforceRateLimit(`shift-pickup:${user.id}`, SCHEDULE_MUTATION_LIMIT);

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
}
