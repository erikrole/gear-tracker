import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { HttpError, ok } from "@/lib/http";
import { checkRateLimit } from "@/lib/rate-limit";
import { requirePermission } from "@/lib/rbac";

const BOOKING_CHANGE_LIMIT = { max: 180, windowMs: 60_000 };
const MAX_CHANGE_ROWS = 100;
const EMPTY_CURSOR_DATE = new Date(0);

type BookingChangeCursor = {
  at: string;
};

function encodeCursor(date: Date): string {
  return Buffer.from(JSON.stringify({ at: date.toISOString() } satisfies BookingChangeCursor), "utf8").toString("base64url");
}

function decodeCursor(value: string | null): Date | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<BookingChangeCursor>;
    if (typeof parsed.at === "string") return parseDate(parsed.at);
  } catch {
    // Accept ISO timestamps too so the route remains easy to probe locally.
  }

  return parseDate(value);
}

function parseDate(value: string): Date {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new HttpError(400, "Invalid booking change cursor");
  return date;
}

function latestDate(dates: Date[]): Date {
  if (dates.length === 0) return EMPTY_CURSOR_DATE;
  return new Date(Math.max(...dates.map((date) => date.getTime())));
}

export const GET = withAuth(async (req, { user }) => {
  requirePermission(user.role, "booking", "view");

  const { allowed } = await checkRateLimit(`bookings:changes:${user.id}`, BOOKING_CHANGE_LIMIT);
  if (!allowed) throw new HttpError(429, "Too many requests. Please wait a moment.");

  const { searchParams } = new URL(req.url);
  const since = decodeCursor(searchParams.get("since"));
  const visibleBookingWhere = user.role === "STUDENT" ? { requesterUserId: user.id } : {};

  if (!since) {
    const [latestBooking, latestAudit] = await Promise.all([
      db.booking.findFirst({
        where: visibleBookingWhere,
        orderBy: { updatedAt: "desc" },
        select: { updatedAt: true },
      }),
      db.auditLog.findFirst({
        where: { entityType: "booking" },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
    ]);
    const cursorDate = latestDate([
      latestBooking?.updatedAt ?? EMPTY_CURSOR_DATE,
      latestAudit?.createdAt ?? EMPTY_CURSOR_DATE,
    ]);
    return ok({ data: { cursor: encodeCursor(cursorDate), changedBookingIds: [] } });
  }

  const [bookingRows, auditRows] = await Promise.all([
    db.booking.findMany({
      where: { ...visibleBookingWhere, updatedAt: { gt: since } },
      orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
      select: { id: true, updatedAt: true },
      take: MAX_CHANGE_ROWS,
    }),
    db.auditLog.findMany({
      where: { entityType: "booking", createdAt: { gt: since } },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { entityId: true, createdAt: true },
      take: MAX_CHANGE_ROWS,
    }),
  ]);

  const auditBookingIds = [...new Set(auditRows.map((row) => row.entityId).filter(Boolean))];
  const visibleAuditBookings = auditBookingIds.length > 0
    ? await db.booking.findMany({
        where: { ...visibleBookingWhere, id: { in: auditBookingIds } },
        select: { id: true },
        take: MAX_CHANGE_ROWS,
      })
    : [];
  const visibleAuditBookingIds = new Set(visibleAuditBookings.map((row) => row.id));
  const visibleAuditRows = auditRows.filter((row) => visibleAuditBookingIds.has(row.entityId));

  const changedBookingIds = [
    ...new Set([
      ...bookingRows.map((row) => row.id),
      ...visibleAuditBookings.map((row) => row.id),
    ]),
  ];
  const cursorDate = latestDate([
    since,
    ...bookingRows.map((row) => row.updatedAt),
    ...visibleAuditRows.map((row) => row.createdAt),
  ]);

  return ok({ data: { cursor: encodeCursor(cursorDate), changedBookingIds } });
});
