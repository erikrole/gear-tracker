import { withAuth } from "@/lib/api";
import { ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { assignShiftSchema } from "@/lib/validation";
import { directAssignShift } from "@/lib/services/shift-assignments";
import { createAuditEntry } from "@/lib/audit";
import { createShiftGearUpNotification } from "@/lib/services/notifications";

export const POST = withAuth(async (req, { user }) => {
  requirePermission(user.role, "shift_assignment", "assign");

  const body = assignShiftSchema.parse(await req.json());
  const assignment = await directAssignShift(body.shiftId, body.userId, user.id);

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "shift_assignment",
    entityId: assignment.id,
    action: "shift_assigned",
    after: { shiftId: body.shiftId, userId: body.userId },
  });

  // Notify assigned user to reserve gear (non-blocking)
  createShiftGearUpNotification(assignment.id).catch(() => {});

  return ok({ data: assignment }, 201);
});
