import { BookingStatus, Prisma } from "@prisma/client";
import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { HttpError, ok, parsePagination } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { BOOKING_SORT_MAP } from "@/lib/services/bookings-queries";

/* ── Combined bookings list (both CHECKOUT and RESERVATION) ── */

function parseStatusParam(value: string | null): BookingStatus | undefined {
  if (!value) return undefined;
  if (!Object.values(BookingStatus).includes(value as BookingStatus)) {
    throw new HttpError(400, `Invalid booking status: ${value}`);
  }
  return value as BookingStatus;
}

const bookingListInclude = {
  location: { select: { id: true, name: true } },
  requester: { select: { id: true, name: true, email: true, avatarUrl: true } },
  serializedItems: {
    select: {
      id: true, assetId: true, allocationStatus: true,
      asset: { select: { id: true, assetTag: true, brand: true, model: true, serialNumber: true, imageUrl: true } },
    },
  },
  bulkItems: {
    select: {
      id: true, plannedQuantity: true, checkedOutQuantity: true, checkedInQuantity: true,
      bulkSku: { select: { id: true, name: true, unit: true } },
    },
  },
  event: { select: { id: true, summary: true, sportCode: true, opponent: true, isHome: true } },
} satisfies Prisma.BookingInclude;


export const GET = withAuth(async (req, { user }) => {
  requirePermission(user.role, "booking", "view");
  const { searchParams } = new URL(req.url);

  const q = searchParams.get("q")?.trim();
  const filter = searchParams.get("filter");
  const status = parseStatusParam(searchParams.get("status"));
  const locationId = searchParams.get("location_id");
  const sportCode = searchParams.get("sport_code");
  const requesterId = searchParams.get("requester_id");

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 86400_000);

  const where: Prisma.BookingWhereInput = {
    // No `kind` filter — returns both CHECKOUT and RESERVATION
    ...(status ? { status } : {}),
    ...(filter === "overdue"
      ? { endsAt: { lt: now }, status: { in: ["OPEN", "BOOKED"] } }
      : filter === "due-today"
        ? { endsAt: { gte: todayStart, lt: todayEnd }, status: { in: ["OPEN", "BOOKED"] } }
        : {}),
    ...(locationId ? { locationId } : {}),
    ...(sportCode ? { sportCode } : {}),
    ...(requesterId ? { requesterUserId: requesterId } : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" as const } },
            { requester: { name: { contains: q, mode: "insensitive" as const } } },
            { refNumber: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const sortParam = searchParams.get("sort");
  const orderBy = (sortParam && BOOKING_SORT_MAP[sortParam]) || [{ startsAt: "desc" }, { id: "asc" }];
  const { limit, offset } = parsePagination(searchParams);

  const [data, total] = await Promise.all([
    db.booking.findMany({ where, orderBy, include: bookingListInclude, take: limit, skip: offset }),
    db.booking.count({ where }),
  ]);

  return ok({ data, total, limit, offset });
});
