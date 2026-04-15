import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { HttpError, ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";

export const DELETE = withAuth<{ id: string; memberId: string }>(async (_req, { user, params }) => {
  requirePermission(user.role, "shift", "manage");
  const { id, memberId } = params;

  const member = await db.eventTravelMember.findUnique({
    where: { id: memberId },
    select: { eventId: true },
  });

  if (!member) throw new HttpError(404, "Travel member not found");
  if (member.eventId !== id) throw new HttpError(404, "Travel member not found");

  await db.eventTravelMember.delete({ where: { id: memberId } });

  return ok({ data: null });
});
