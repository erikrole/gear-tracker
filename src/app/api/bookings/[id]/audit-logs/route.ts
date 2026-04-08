import { withAuth } from "@/lib/api";
import { ok } from "@/lib/http";
import { db } from "@/lib/db";
import { requireBookingAction } from "@/lib/services/booking-rules";

const PAGE_SIZE = 50;

/**
 * GET /api/bookings/[id]/audit-logs?cursor=<id>
 * Cursor-based pagination for audit log entries on a booking.
 */
export const GET = withAuth<{ id: string }>(async (req, { user, params }) => {
  const { id } = params;

  // Verify user has view access to this booking (students can only see own bookings)
  await requireBookingAction(id, user, "view");
  const url = new URL(req.url);
  const cursor = url.searchParams.get("cursor");

  const logs = await db.auditLog.findMany({
    where: { entityType: "booking", entityId: id },
    orderBy: { createdAt: "desc" },
    take: PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: { actor: { select: { id: true, name: true, avatarUrl: true } } },
  });

  const hasMore = logs.length > PAGE_SIZE;
  const data = hasMore ? logs.slice(0, PAGE_SIZE) : logs;
  const nextCursor = hasMore ? data[data.length - 1]?.id : null;

  return ok({ data, hasMore, nextCursor });
});
