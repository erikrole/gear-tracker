export const runtime = "edge";

import { requireAuth } from "@/lib/auth";
import { ok, fail } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { removeAssignment } from "@/lib/services/shift-assignments";
import { createAuditEntry } from "@/lib/audit";

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireAuth();
    requirePermission(actor.role, "shift_assignment", "assign");
    const { id } = await ctx.params;

    const assignment = await removeAssignment(id);

    await createAuditEntry({
      actorId: actor.id,
      actorRole: actor.role,
      entityType: "shift_assignment",
      entityId: id,
      action: "shift_assignment_removed",
    });

    return ok({ data: assignment });
  } catch (error) {
    return fail(error);
  }
}
