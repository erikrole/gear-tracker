import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { HttpError, ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { autoAssignShiftGroup } from "@/lib/services/auto-assign";

export const POST = withAuth<{ id: string }>(async (_req, { user, params }) => {
  requirePermission(user.role, "shift", "manage");
  const { id } = params;

  const group = await db.shiftGroup.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!group) throw new HttpError(404, "Shift group not found");

  const result = await autoAssignShiftGroup(id, user.id);
  return ok({ data: result });
});
