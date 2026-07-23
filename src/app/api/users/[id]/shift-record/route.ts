import { Role } from "@prisma/client";
import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { HttpError, ok } from "@/lib/http";
import { requireRole } from "@/lib/rbac";
import { getShiftRecordStats } from "@/lib/services/shift-records";
import { canReadUserProfile } from "@/lib/user-visibility";

export const GET = withAuth<{ id: string }>(async (_req, { user, params }) => {
  requireRole(user.role, [Role.ADMIN, Role.STAFF, Role.STUDENT]);
  const { id } = params;

  if (user.role === Role.STUDENT && user.id !== id) {
    throw new HttpError(403, "Forbidden");
  }

  const target = await db.user.findUnique({
    where: { id },
    select: {
      id: true,
      role: true,
      hiddenFromRoster: true,
    },
  });
  if (!target || target.role === Role.COLLABORATOR) {
    throw new HttpError(404, "User not found");
  }
  if (!canReadUserProfile(user, target)) {
    throw new HttpError(404, "User not found");
  }

  return ok({ data: await getShiftRecordStats(id) });
});
