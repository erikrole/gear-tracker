import { withAuth } from "@/lib/api";
import { createAuditEntry } from "@/lib/audit";
import { ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { repairRoleSlotMismatch } from "@/lib/services/shift-assignments";

export const POST = withAuth<{ id: string }>(async (_req, { user, params }) => {
  requirePermission(user.role, "shift_assignment", "assign");

  const result = await repairRoleSlotMismatch(params.id);

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "shift_assignment",
    entityId: result.assignment.id,
    action: "shift_assignment_role_slot_repaired",
    after: {
      assignmentId: result.assignment.id,
      shiftId: result.assignment.shiftId,
      roleSlotOutcome: result.outcome,
    },
  });

  return ok({ data: result.assignment, meta: { roleSlotOutcome: result.outcome } });
});
