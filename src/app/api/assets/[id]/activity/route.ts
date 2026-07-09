import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { ok, HttpError } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export const GET = withAuth<{ id: string }>(async (req, { user, params }) => {
  requirePermission(user.role, "asset", "audit");
  const { id } = params;

  const asset = await db.asset.findUnique({ where: { id }, select: { id: true } });
  if (!asset) throw new HttpError(404, "Asset not found");

  const url = new URL(req.url);
  const cursor = url.searchParams.get("cursor") || undefined;
  const scope = url.searchParams.get("scope") || "all";
  if (!["all", "asset", "booking"].includes(scope)) {
    throw new HttpError(400, "Invalid activity scope");
  }
  const limit = Math.min(
    Math.max(1, Number(url.searchParams.get("limit")) || DEFAULT_LIMIT),
    MAX_LIMIT,
  );

  // Fetch audit logs for this asset + any bookings that included this asset
  const bookingIds = await db.bookingSerializedItem.findMany({
    where: { assetId: id },
    select: { bookingId: true },
    distinct: ["bookingId"],
  });

  const bookingIdList = bookingIds.map((b: { bookingId: string }) => b.bookingId);
  const scopedClauses =
    scope === "asset"
      ? [{ entityType: "asset", entityId: id }]
      : scope === "booking"
        ? (bookingIdList.length > 0 ? [{ entityType: "booking", entityId: { in: bookingIdList } }] : [])
        : [
            { entityType: "asset", entityId: id },
            ...(bookingIdList.length > 0
              ? [{ entityType: "booking", entityId: { in: bookingIdList } }]
              : []),
          ];
  if (scopedClauses.length === 0) return ok({ data: [], nextCursor: null });

  const logs = await db.auditLog.findMany({
    where: {
      OR: scopedClauses,
    },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: {
      actor: { select: { name: true, email: true, avatarUrl: true } },
    },
  });

  const hasMore = logs.length > limit;
  const data = hasMore ? logs.slice(0, limit) : logs;
  const nextCursor = hasMore ? data[data.length - 1]!.id : null;

  // Booking audit payloads don't snapshot the booking title, so rows like
  // "cancelled" are unidentifiable on an item timeline. Join title/kind for
  // the bookings on this page so the client can name and link them.
  const pageBookingIds = [
    ...new Set(data.filter((l) => l.entityType === "booking").map((l) => l.entityId)),
  ];
  const bookings = pageBookingIds.length
    ? await db.booking.findMany({
        where: { id: { in: pageBookingIds } },
        select: { id: true, title: true, kind: true },
      })
    : [];
  const bookingById = new Map(bookings.map((b) => [b.id, b]));

  return ok({
    data: data.map((log) => {
      const booking = log.entityType === "booking" ? bookingById.get(log.entityId) : undefined;
      return booking ? { ...log, entity: { label: booking.title, kind: booking.kind } } : log;
    }),
    nextCursor,
  });
});
