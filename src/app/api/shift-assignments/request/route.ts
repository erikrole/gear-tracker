export const runtime = "edge";

import { requireAuth } from "@/lib/auth";
import { ok, fail } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { requestShiftSchema } from "@/lib/validation";
import { requestShift } from "@/lib/services/shift-assignments";
import { createAuditEntry } from "@/lib/audit";

export async function POST(req: Request) {
  try {
    const actor = await requireAuth();
    requirePermission(actor.role, "shift_assignment", "request");

    const body = requestShiftSchema.parse(await req.json());
    const assignment = await requestShift(body.shiftId, actor.id);

    await createAuditEntry({
      actorId: actor.id,
      actorRole: actor.role,
      entityType: "shift_assignment",
      entityId: assignment.id,
      action: "shift_requested",
      after: { shiftId: body.shiftId },
    });

    return ok({ data: assignment }, 201);
  } catch (error) {
    return fail(error);
  }
}
