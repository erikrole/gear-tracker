import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { ok, HttpError } from "@/lib/http";
import { requireRole } from "@/lib/rbac";

export const GET = withAuth<{ id: string }>(async (_req, { user, params }) => {
  requireRole(user.role, ["ADMIN", "STAFF", "STUDENT"]);

  const { id } = params;

  // Students can only view their own activity
  if (user.role === "STUDENT" && user.id !== id) {
    throw new HttpError(403, "Forbidden");
  }

  const target = await db.user.findUnique({ where: { id }, select: { id: true } });
  if (!target) throw new HttpError(404, "User not found");

  // Fetch audit logs where:
  // 1. This user is the entity being acted on (entityType: "user", entityId: id)
  // 2. This user performed an action (actorId: id)
  const logs = await db.auditLog.findMany({
    where: {
      OR: [
        { entityType: "user", entityId: id },
        { actorUserId: id },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      actor: { select: { name: true, email: true } },
    },
  });

  return ok({ data: logs });
});
