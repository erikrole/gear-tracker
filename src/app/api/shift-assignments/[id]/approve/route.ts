import { requireAuth } from "@/lib/auth";
import { ok, fail } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { approveRequest } from "@/lib/services/shift-assignments";
import { createAuditEntry } from "@/lib/audit";
import { createShiftGearUpNotification } from "@/lib/services/notifications";

export async function PATCH(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireAuth();
    requirePermission(actor.role, "shift_assignment", "approve");
    const { id } = await ctx.params;

    const assignment = await approveRequest(id);

    await createAuditEntry({
      actorId: actor.id,
      actorRole: actor.role,
      entityType: "shift_assignment",
      entityId: id,
      action: "shift_request_approved",
      after: { userId: assignment.userId, shiftId: assignment.shiftId },
    });

    // Notify student to reserve gear (non-blocking)
    createShiftGearUpNotification(assignment.id).catch(() => {});

    return ok({ data: assignment });
  } catch (error) {
    return fail(error);
  }
}
