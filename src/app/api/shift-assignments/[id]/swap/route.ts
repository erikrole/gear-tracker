import { withAuth } from "@/lib/api";
import { ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { swapShiftSchema } from "@/lib/validation";
import { initiateSwap } from "@/lib/services/shift-assignments";
import { createAuditEntry } from "@/lib/audit";

export const POST = withAuth<{ id: string }>(async (req, { user, params }) => {
  requirePermission(user.role, "shift_assignment", "assign");
  const { id } = params;

  const body = swapShiftSchema.parse(await req.json());
  const assignment = await initiateSwap(id, body.targetUserId, user.id);

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "shift_assignment",
    entityId: assignment.id,
    action: "shift_swapped",
    before: { fromAssignmentId: id },
    after: { userId: body.targetUserId, shiftId: assignment.shiftId },
  });

  return ok({ data: assignment }, 201);
});
