import { CalendarEventStatus, ShiftAssignmentStatus } from "@prisma/client";
import { withKiosk } from "@/lib/api";
import { db } from "@/lib/db";
import { ok } from "@/lib/http";

const KIOSK_EVENT_WINDOW_DAYS = 7;

/// Assignment states that mean "this person is actually working it". A declined
/// or swapped-away assignment is not the requester's shift.
const WORKING_ASSIGNMENT_STATUSES = [
  ShiftAssignmentStatus.DIRECT_ASSIGNED,
  ShiftAssignmentStatus.APPROVED,
] as const;

/**
 * Short-lived cache for the event window.
 *
 * The list is identical for every kiosk and every requester — only the
 * per-user `isAssigned` flag differs — and a 7-day calendar window does not
 * move between two people checking out gear a minute apart. This is the
 * heaviest read on the checkout entry path, so a 60s TTL takes it off most
 * requests and lets the Neon endpoint stay idle longer.
 *
 * Best-effort by design: module scope on a serverless function means the cache
 * is per-instance and dies with it. A miss is simply the query we would have
 * run anyway. Deliberately NOT applied to the dashboard or student context —
 * those are live custody state and must never be served stale.
 */
const EVENT_CACHE_TTL_MS = 60_000;

function loadEvents(now: Date, windowEnd: Date) {
  return db.calendarEvent.findMany({
    where: {
      startsAt: { lte: windowEnd },
      endsAt: { gte: now },
      status: { not: CalendarEventStatus.CANCELLED },
      isHidden: false,
      archivedAt: null,
    },
    orderBy: { startsAt: "asc" },
    take: 80,
    select: {
      id: true,
      summary: true,
      subtitle: true,
      rawLocationText: true,
      sportCode: true,
      startsAt: true,
      endsAt: true,
      allDay: true,
    },
  });
}

type KioskEventRow = Awaited<ReturnType<typeof loadEvents>>[number];
let eventCache: { expiresAt: number; events: KioskEventRow[] } | null = null;

export const GET = withKiosk(async (req) => {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + KIOSK_EVENT_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  // Optional: the kiosk passes the identified requester so the checkout setup
  // can surface "your shifts" ahead of the full event list. Absent or unknown
  // ids simply yield no assignments — never an error — so an older kiosk build
  // keeps working against this route unchanged.
  const requesterId = new URL(req.url).searchParams.get("userId")?.trim() || null;

  let events: KioskEventRow[];
  if (eventCache && eventCache.expiresAt > now.getTime()) {
    events = eventCache.events;
  } else {
    events = await loadEvents(now, windowEnd);
    eventCache = { expiresAt: now.getTime() + EVENT_CACHE_TTL_MS, events };
  }

  // One extra query over the already-bounded event page, not a per-event read.
  const assignedEventIds = new Set<string>();
  if (requesterId && events.length > 0) {
    const assignments = await db.shiftAssignment.findMany({
      where: {
        userId: requesterId,
        status: { in: [...WORKING_ASSIGNMENT_STATUSES] },
        shift: {
          shiftGroup: {
            eventId: { in: events.map((event) => event.id) },
            publishedAt: { not: null },
            archivedAt: null,
          },
        },
      },
      select: { shift: { select: { shiftGroup: { select: { eventId: true } } } } },
    });
    for (const assignment of assignments) {
      assignedEventIds.add(assignment.shift.shiftGroup.eventId);
    }
  }

  return ok({
    data: events.map((event) => ({
      id: event.id,
      title: event.summary,
      subtitle: event.subtitle,
      sportCode: event.sportCode,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      allDay: event.allDay,
      locationName: event.rawLocationText,
      isAssigned: assignedEventIds.has(event.id),
    })),
  });
});
