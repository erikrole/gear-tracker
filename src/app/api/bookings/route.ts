import { Prisma } from "@prisma/client";
import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { ok, parsePagination } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";

/* ── Combined bookings list (both CHECKOUT and RESERVATION) ── */

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

const SORT_MAP: Record<string, Prisma.BookingOrderByWithRelationInput[]> = {
  oldest: [{ startsAt: "asc" }, { id: "asc" }],
  title: [{ title: "asc" }, { id: "asc" }],
  title_desc: [{ title: "desc" }, { id: "asc" }],
  endsAt: [{ endsAt: "asc" }, { id: "asc" }],
  endsAt_desc: [{ endsAt: "desc" }, { id: "asc" }],
};

export const GET = withAuth(async (req, { user }) => {
  requirePermission(user.role, "booking", "view");
  const { searchParams } = new URL(req.url);

  const q = searchParams.get("q")?.trim();
  const statusParam = searchParams.get("status");
  const locationId = searchParams.get("location_id");
  const sportCode = searchParams.get("sport_code");
  const requesterId = searchParams.get("requester_id");

  const where: Prisma.BookingWhereInput = {
    // No `kind` filter — returns both CHECKOUT and RESERVATION
    ...(statusParam ? { status: statusParam as never } : {}),
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
  const orderBy = (sortParam && SORT_MAP[sortParam]) || [{ startsAt: "desc" }, { id: "asc" }];
  const { limit, offset } = parsePagination(searchParams);

  const [data, total] = await Promise.all([
    db.booking.findMany({ where, orderBy, include: bookingListInclude, take: limit, skip: offset }),
    db.booking.count({ where }),
  ]);

  return ok({ data, total, limit, offset });
});
