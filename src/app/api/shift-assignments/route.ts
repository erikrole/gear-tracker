export const runtime = "edge";

import { requireAuth } from "@/lib/auth";
import { ok, fail } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { assignShiftSchema } from "@/lib/validation";
import { directAssignShift } from "@/lib/services/shift-assignments";
import { createAuditEntry } from "@/lib/audit";

export async function POST(req: Request) {
  try {
    const actor = await requireAuth();
    requirePermission(actor.role, "shift_assignment", "assign");

    const body = assignShiftSchema.parse(await req.json());
    const assignment = await directAssignShift(body.shiftId, body.userId, actor.id);

    await createAuditEntry({
      actorId: actor.id,
      actorRole: actor.role,
      entityType: "shift_assignment",
      entityId: assignment.id,
      action: "shift_assigned",
      after: { shiftId: body.shiftId, userId: body.userId },
    });

    return ok({ data: assignment }, 201);
  } catch (error) {
    return fail(error);
  }
}
