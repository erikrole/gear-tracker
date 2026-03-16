import { requireAuth } from "@/lib/auth";
import { ok, fail } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { swapShiftSchema } from "@/lib/validation";
import { initiateSwap } from "@/lib/services/shift-assignments";
import { createAuditEntry } from "@/lib/audit";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireAuth();
    requirePermission(actor.role, "shift_assignment", "assign");
    const { id } = await ctx.params;

    const body = swapShiftSchema.parse(await req.json());
    const assignment = await initiateSwap(id, body.targetUserId, actor.id);

    await createAuditEntry({
      actorId: actor.id,
      actorRole: actor.role,
      entityType: "shift_assignment",
      entityId: assignment.id,
      action: "shift_swapped",
      before: { fromAssignmentId: id },
      after: { userId: body.targetUserId, shiftId: assignment.shiftId },
    });

    return ok({ data: assignment }, 201);
  } catch (error) {
    return fail(error);
  }
}
