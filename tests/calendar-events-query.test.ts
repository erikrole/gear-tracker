import { describe, it, expect } from "vitest";

/**
 * Tests for the calendar-events API query logic.
 *
 * We extract the WHERE-building logic inline to test it without
 * spinning up the full Next.js edge runtime.
 */

// Mirror the logic from src/app/api/calendar-events/route.ts
function buildCalendarEventsWhere(params: {
  startDate?: string | null;
  endDate?: string | null;
  unmapped?: boolean;
  sportCode?: string | null;
  includePast?: boolean;
  now?: Date;
}) {
  const start = params.startDate ? new Date(params.startDate) : null;
  const end = params.endDate ? new Date(params.endDate) : null;
  const where: Record<string, unknown> = {
    ...(params.unmapped ? { locationId: null } : {}),
    ...(params.sportCode ? { sportCode: params.sportCode } : {}),
    status: { not: "CANCELLED" as const },
  };

  if (start && end) {
    where.startsAt = { lte: end };
    where.endsAt = { gt: start };
  } else if (start) {
    where.endsAt = { gt: start };
  } else if (end) {
    where.startsAt = { lte: end };
  } else if (!params.includePast) {
    where.endsAt = { gt: params.now ?? new Date() };
  }

  return where;
}

describe("buildCalendarEventsWhere", () => {
  const fixedNow = new Date("2026-03-07T12:00:00Z");

  it("defaults to events still active or upcoming from now when no startDate is given", () => {
    const where = buildCalendarEventsWhere({ now: fixedNow });
    expect(where.endsAt).toEqual({ gt: fixedNow });
  });

  it("uses explicit startDate as an overlap lower boundary", () => {
    const explicit = "2026-01-01T00:00:00Z";
    const where = buildCalendarEventsWhere({ startDate: explicit, now: fixedNow });
    expect(where.endsAt).toEqual({ gt: new Date(explicit) });
  });

  it("uses startDate and endDate as an overlap window", () => {
    const where = buildCalendarEventsWhere({
      startDate: "2026-05-31T00:00:00Z",
      endDate: "2026-06-01T00:00:00Z",
      now: fixedNow,
    });
    expect(where.startsAt).toEqual({ lte: new Date("2026-06-01T00:00:00Z") });
    expect(where.endsAt).toEqual({ gt: new Date("2026-05-31T00:00:00Z") });
  });

  it("uses endDate alone as an upper overlap boundary", () => {
    const where = buildCalendarEventsWhere({
      endDate: "2026-06-01T00:00:00Z",
      includePast: true,
      now: fixedNow,
    });
    expect(where.startsAt).toEqual({ lte: new Date("2026-06-01T00:00:00Z") });
    expect(where).not.toHaveProperty("endsAt");
  });

  it("includes unmapped filter when requested", () => {
    const where = buildCalendarEventsWhere({ unmapped: true, now: fixedNow });
    expect(where.locationId).toBeNull();
  });

  it("does not include locationId filter when unmapped is false", () => {
    const where = buildCalendarEventsWhere({ unmapped: false, now: fixedNow });
    expect(where).not.toHaveProperty("locationId");
  });

  it("includes sportCode filter when provided", () => {
    const where = buildCalendarEventsWhere({ sportCode: "MBB", now: fixedNow });
    expect(where.sportCode).toBe("MBB");
  });

  it("always excludes cancelled events", () => {
    const where = buildCalendarEventsWhere({ now: fixedNow });
    expect(where.status).toEqual({ not: "CANCELLED" });
  });

  it("preserves unmapped filter alongside startDate default", () => {
    const where = buildCalendarEventsWhere({ unmapped: true, now: fixedNow });
    expect(where.endsAt).toEqual({ gt: fixedNow });
    expect(where.locationId).toBeNull();
  });
});
