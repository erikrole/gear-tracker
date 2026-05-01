import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { ok, HttpError } from "@/lib/http";
import { requireRole } from "@/lib/rbac";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export const GET = withAuth<{ id: string }>(async (req, { user, params }) => {
  requireRole(user.role, ["ADMIN", "STAFF", "STUDENT"]);

  const { id } = params;

  // Students can only view their own activity
  if (user.role === "STUDENT" && user.id !== id) {
    throw new HttpError(403, "Forbidden");
  }

  const target = await db.user.findUnique({ where: { id }, select: { id: true } });
  if (!target) throw new HttpError(404, "User not found");

  const url = new URL(req.url);
  const cursor = url.searchParams.get("cursor") || undefined;
  const limit = Math.min(
    Math.max(1, Number(url.searchParams.get("limit")) || DEFAULT_LIMIT),
    MAX_LIMIT,
  );

  // Fetch one extra to detect if there are more entries
  const logs = await db.auditLog.findMany({
    where: {
      OR: [
        { entityType: "user", entityId: id },
        { actorUserId: id },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: {
      actor: { select: { id: true, name: true, email: true, avatarUrl: true } },
    },
  });

  const hasMore = logs.length > limit;
  const data = hasMore ? logs.slice(0, limit) : logs;
  const nextCursor = hasMore ? data[data.length - 1].id : null;

  return ok({ data, nextCursor });
});
