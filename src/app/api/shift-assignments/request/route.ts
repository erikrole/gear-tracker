import { withAuth } from "@/lib/api";
import { ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { requestShiftSchema } from "@/lib/validation";
import { requestShift } from "@/lib/services/shift-assignments";
import { createAuditEntry } from "@/lib/audit";

export const POST = withAuth(async (req, { user }) => {
  requirePermission(user.role, "shift_assignment", "request");

  const body = requestShiftSchema.parse(await req.json());
  const assignment = await requestShift(body.shiftId, user.id);

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "shift_assignment",
    entityId: assignment.id,
    action: "shift_requested",
    after: { shiftId: body.shiftId },
  });

  return ok({ data: assignment }, 201);
});
