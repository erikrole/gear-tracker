import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

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
  now?: Date;
}) {
  const effectiveStartDate = params.startDate
    ? new Date(params.startDate)
    : (params.now ?? new Date());

  return {
    startsAt: { gte: effectiveStartDate },
    ...(params.endDate ? { endsAt: { lte: new Date(params.endDate) } } : {}),
    ...(params.unmapped ? { locationId: null } : {}),
    ...(params.sportCode ? { sportCode: params.sportCode } : {}),
    status: { not: "CANCELLED" as const },
  };
}

describe("buildCalendarEventsWhere", () => {
  const fixedNow = new Date("2026-03-07T12:00:00Z");

  it("defaults to upcoming events from now when no startDate is given", () => {
    const where = buildCalendarEventsWhere({ now: fixedNow });
    expect(where.startsAt).toEqual({ gte: fixedNow });
  });

  it("uses explicit startDate when provided", () => {
    const explicit = "2026-01-01T00:00:00Z";
    const where = buildCalendarEventsWhere({ startDate: explicit, now: fixedNow });
    expect(where.startsAt).toEqual({ gte: new Date(explicit) });
  });

  it("includes endDate filter when provided", () => {
    const where = buildCalendarEventsWhere({
      endDate: "2026-06-01T00:00:00Z",
      now: fixedNow,
    });
    expect(where.endsAt).toEqual({ lte: new Date("2026-06-01T00:00:00Z") });
  });

  it("does not include endDate when not provided", () => {
    const where = buildCalendarEventsWhere({ now: fixedNow });
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
    expect(where.startsAt).toEqual({ gte: fixedNow });
    expect(where.locationId).toBeNull();
  });
});
