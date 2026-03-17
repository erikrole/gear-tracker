import { withAuth } from "@/lib/api";
import { ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { removeAssignment } from "@/lib/services/shift-assignments";
import { createAuditEntry } from "@/lib/audit";

export const DELETE = withAuth<{ id: string }>(async (_req, { user, params }) => {
  requirePermission(user.role, "shift_assignment", "assign");
  const { id } = params;

  const assignment = await removeAssignment(id);

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "shift_assignment",
    entityId: id,
    action: "shift_assignment_removed",
  });

  return ok({ data: assignment });
});
