import { db } from "@/lib/db";

/**
 * Event-default checkout creation contract (BRIEF_CHECKOUT_UX_V2.md):
 *
 * When a sportCode is provided but no eventId, look up the next upcoming
 * confirmed event for that sport within a 30-day window. If found, link
 * the checkout to the event and use its data as defaults. If not found,
 * proceed as ad hoc (no event link, caller-supplied values used as-is).
 */

export type EventDefaultResult = {
  eventId: string | null;
  title: string | null;
  startsAt: Date | null;
  endsAt: Date | null;
  locationId: string | null;
  sportCode: string | null;
};

const LOOKUP_WINDOW_DAYS = 30;

/**
 * Look up the next upcoming event for a sport code.
 * Returns prefill defaults if an event is found, null fields otherwise.
 */
export async function resolveEventDefaults(
  sportCode: string | undefined
): Promise<EventDefaultResult> {
  const empty: EventDefaultResult = {
    eventId: null,
    title: null,
    startsAt: null,
    endsAt: null,
    locationId: null,
    sportCode: sportCode ?? null,
  };

  if (!sportCode) return empty;

  const now = new Date();
  const windowEnd = new Date(now.getTime() + LOOKUP_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const event = await db.calendarEvent.findFirst({
    where: {
      sportCode,
      status: "CONFIRMED",
      startsAt: { gte: now, lte: windowEnd },
    },
    orderBy: { startsAt: "asc" },
  });

  if (!event) return empty;

  return {
    eventId: event.id,
    title: event.summary,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    locationId: event.locationId,
    sportCode: event.sportCode,
  };
}
