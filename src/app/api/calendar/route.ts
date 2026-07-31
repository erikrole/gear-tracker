import { BookingStatus, Prisma } from "@prisma/client";
import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { HttpError, ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";

export const GET = withAuth(async (req, { user }) => {
  // Org-wide booking calendar: requester names and emails, asset tags, and
  // serial numbers. Same internal roles as every other booking read; the map is
  // default-deny for collaborators, who get their own bookings via /api/bookings.
  requirePermission(user.role, "booking", "view");

  const { searchParams } = new URL(req.url);

  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (!from || !to) {
    throw new HttpError(400, "from and to are required");
  }

  const fromDate = new Date(from);
  const toDate = new Date(to);
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime()) || fromDate >= toDate) {
    throw new HttpError(400, "Invalid calendar range");
  }
  if (toDate.getTime() - fromDate.getTime() > 366 * 24 * 60 * 60 * 1000) {
    throw new HttpError(400, "Calendar range cannot exceed 366 days");
  }

  const where: Prisma.BookingWhereInput = {
    startsAt: { lt: toDate },
    endsAt: { gt: fromDate },
    status: { in: [BookingStatus.BOOKED, BookingStatus.PENDING_PICKUP, BookingStatus.OPEN] },
    ...(searchParams.get("location_id") ? { locationId: searchParams.get("location_id")! } : {}),
    ...(searchParams.get("asset_id")
      ? {
          serializedItems: {
            some: {
              assetId: searchParams.get("asset_id")!
            }
          }
        }
      : {})
  };

  const data = await db.booking.findMany({
    where,
    include: {
      location: { select: { id: true, name: true } },
      requester: { select: { id: true, name: true, email: true } },
      serializedItems: {
        select: {
          id: true, assetId: true, allocationStatus: true,
          asset: { select: { id: true, assetTag: true, brand: true, model: true, serialNumber: true } },
        },
      },
      bulkItems: {
        select: {
          id: true, plannedQuantity: true, checkedOutQuantity: true, checkedInQuantity: true,
          bulkSku: { select: { id: true, name: true, unit: true } },
        },
      },
    },
    orderBy: { startsAt: "asc" },
    take: 500
  });

  return ok({ data });
});
