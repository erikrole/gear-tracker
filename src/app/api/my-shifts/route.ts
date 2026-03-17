import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { ok } from "@/lib/http";

/**
 * GET /api/my-shifts
 *
 * Returns the current user's upcoming shift assignments with gear checkout status.
 *
 * Query params:
 *   - eventId: (optional) filter to a specific event
 *   - limit:   (optional, default 5) max results
 */
export const GET = withAuth(async (req, { user }) => {
  const url = new URL(req.url);
  const eventId = url.searchParams.get("eventId");
  const limit = Math.min(Number(url.searchParams.get("limit") || "5"), 20);

  const now = new Date();

  // Build where clause for active assignments
  const where: Record<string, unknown> = {
    userId: user.id,
    status: { in: ["DIRECT_ASSIGNED", "APPROVED"] },
    shift: {
      shiftGroup: {
        event: eventId
          ? { id: eventId }
          : { startsAt: { gte: now }, status: "CONFIRMED" },
      },
    },
  };

  const assignments = await db.shiftAssignment.findMany({
    where,
    orderBy: { shift: { startsAt: "asc" } },
    take: limit,
    include: {
      shift: {
        include: {
          shiftGroup: {
            include: {
              event: {
                select: {
                  id: true,
                  summary: true,
                  startsAt: true,
                  endsAt: true,
                  sportCode: true,
                  isHome: true,
                  opponent: true,
                  locationId: true,
                  location: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  // For each assignment, check if user has a gear checkout linked to the same event
  const eventIds = [...new Set(assignments.map((a) => a.shift.shiftGroup.event.id))];

  const gearBookings = eventIds.length > 0
    ? await db.booking.findMany({
        where: {
          requesterUserId: user.id,
          eventId: { in: eventIds },
          status: { in: ["DRAFT", "BOOKED", "OPEN"] },
        },
        select: {
          id: true,
          eventId: true,
          status: true,
          kind: true,
          _count: { select: { serializedItems: true, bulkItems: true } },
        },
      })
    : [];

  // Index bookings by eventId for fast lookup
  const bookingsByEvent = new Map<string, typeof gearBookings>();
  for (const b of gearBookings) {
    if (!b.eventId) continue;
    const existing = bookingsByEvent.get(b.eventId) || [];
    existing.push(b);
    bookingsByEvent.set(b.eventId, existing);
  }

  const data = assignments.map((a) => {
    const event = a.shift.shiftGroup.event;
    const eventBookings = bookingsByEvent.get(event.id) || [];
    const hasGear = eventBookings.length > 0;
    const gearStatus = hasGear
      ? eventBookings.some((b) => b.status === "OPEN")
        ? "checked_out"
        : eventBookings.some((b) => b.status === "BOOKED")
          ? "reserved"
          : "draft"
      : "none";

    return {
      id: a.id,
      shiftId: a.shift.id,
      area: a.shift.area,
      workerType: a.shift.workerType,
      startsAt: a.shift.startsAt.toISOString(),
      endsAt: a.shift.endsAt.toISOString(),
      status: a.status,
      event: {
        id: event.id,
        summary: event.summary,
        startsAt: event.startsAt.toISOString(),
        endsAt: event.endsAt.toISOString(),
        sportCode: event.sportCode,
        isHome: event.isHome,
        opponent: event.opponent,
        locationId: event.locationId,
        locationName: event.location?.name ?? null,
      },
      gear: {
        status: gearStatus,
        bookings: eventBookings.map((b) => ({
          id: b.id,
          status: b.status,
          kind: b.kind,
          itemCount: b._count.serializedItems + b._count.bulkItems,
        })),
      },
    };
  });

  return ok({ data });
});
