import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { ok } from "@/lib/http";
import { shiftWorkerLabel } from "@/lib/shift-display";
import { startOfTodayInAppTz } from "@/lib/app-time";

function gearStatusForBooking(status: string) {
  if (status === "OPEN") return "checked_out";
  if (status === "PENDING_PICKUP") return "pickup_ready";
  if (status === "BOOKED") return "reserved";
  return "draft";
}

function gearStatusPriority(status: string) {
  switch (status) {
    case "pickup_ready":
      return 4;
    case "checked_out":
      return 3;
    case "reserved":
      return 2;
    case "draft":
      return 1;
    default:
      return 0;
  }
}

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
          // Keep a shift on today's events listed until local midnight (endsAt
          // past the start of today), so an all-day shift doesn't vanish at
          // 12:00am and an evening game's shift isn't hidden the moment it ends.
          : { endsAt: { gt: startOfTodayInAppTz(now) }, status: "CONFIRMED" },
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
  const assignmentIds = assignments.map((a) => a.id);

  const gearBookings = eventIds.length > 0
    ? await db.booking.findMany({
        where: {
          requesterUserId: user.id,
          status: { in: ["DRAFT", "BOOKED", "PENDING_PICKUP", "OPEN"] },
          OR: [
            { eventId: { in: eventIds } },
            { events: { some: { eventId: { in: eventIds } } } },
            { shiftAssignmentId: { in: assignmentIds } },
            { shiftAssignment: { shift: { shiftGroup: { eventId: { in: eventIds } } } } },
          ],
        },
        select: {
          id: true,
          eventId: true,
          status: true,
          kind: true,
          events: { select: { eventId: true } },
          shiftAssignment: {
            select: {
              shift: {
                select: {
                  shiftGroup: { select: { eventId: true } },
                },
              },
            },
          },
          _count: { select: { serializedItems: true, bulkItems: true } },
        },
      })
    : [];

  // Index bookings by eventId for fast lookup
  const bookingsByEvent = new Map<string, typeof gearBookings>();
  for (const b of gearBookings) {
    const bookingEventIds = new Set<string>();
    if (b.eventId) bookingEventIds.add(b.eventId);
    for (const event of b.events) bookingEventIds.add(event.eventId);
    const shiftEventId = b.shiftAssignment?.shift.shiftGroup.eventId;
    if (shiftEventId) bookingEventIds.add(shiftEventId);

    for (const eventId of bookingEventIds) {
      const existing = bookingsByEvent.get(eventId) || [];
      existing.push(b);
      existing.sort((a, b) => {
        const statusDelta = gearStatusPriority(gearStatusForBooking(b.status)) - gearStatusPriority(gearStatusForBooking(a.status));
        if (statusDelta !== 0) return statusDelta;
        return a.id.localeCompare(b.id);
      });
      bookingsByEvent.set(eventId, existing);
    }
  }

  const data = assignments.map((a) => {
    const event = a.shift.shiftGroup.event;
    const eventBookings = bookingsByEvent.get(event.id) || [];
    const gearStatus = eventBookings[0] ? gearStatusForBooking(eventBookings[0].status) : "none";

    return {
      id: a.id,
      shiftId: a.shift.id,
      area: a.shift.area,
      workerType: a.shift.workerType,
      workerLabel: shiftWorkerLabel(a.shift.workerType),
      startsAt: a.shift.startsAt.toISOString(),
      endsAt: a.shift.endsAt.toISOString(),
      callStartsAt: (a.callStartsAt ?? a.shift.callStartsAt ?? a.shift.startsAt).toISOString(),
      callEndsAt: (a.callEndsAt ?? a.shift.callEndsAt ?? a.shift.endsAt).toISOString(),
      callNote: a.callNote,
      status: a.status,
      acknowledgedAt: a.acknowledgedAt?.toISOString() ?? null,
      acknowledgedById: a.acknowledgedById,
      schedulePublishedAt: a.shift.shiftGroup.publishedAt?.toISOString() ?? null,
      scheduleAcknowledged: Boolean(
        a.shift.shiftGroup.publishedAt
        && a.acknowledgedAt
        && a.acknowledgedAt >= a.shift.shiftGroup.publishedAt,
      ),
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
