import { withAuth } from "@/lib/api";
import { ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { approveRequest } from "@/lib/services/shift-assignments";
import { createAuditEntry } from "@/lib/audit";
import { createShiftGearUpNotification } from "@/lib/services/notifications";

export const PATCH = withAuth<{ id: string }>(async (_req, { user, params }) => {
  requirePermission(user.role, "shift_assignment", "approve");
  const { id } = params;

  const assignment = await approveRequest(id);

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "shift_assignment",
    entityId: id,
    action: "shift_request_approved",
    after: { userId: assignment.userId, shiftId: assignment.shiftId },
  });

  // Notify student to reserve gear (non-blocking)
  createShiftGearUpNotification(assignment.id).catch(() => {});

  return ok({ data: assignment });
});
