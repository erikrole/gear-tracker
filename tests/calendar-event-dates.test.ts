import { afterEach, describe, expect, it } from "vitest";
import {
  eventOccursOnCalendarDay,
  formatCalendarEventAllDayLabel,
  formatCalendarEventDateRange,
  sortCalendarEventsForDisplay,
} from "@/lib/calendar-event-dates";

const footballMediaDay = {
  startsAt: "2026-07-07T05:00:00.000Z",
  endsAt: "2026-07-09T05:00:00.000Z",
  allDay: true,
};

describe("calendar event date helpers", () => {
  const originalTz = process.env.TZ;

  afterEach(() => {
    process.env.TZ = originalTz;
  });

  it("formats all-day exclusive-end spans as inclusive operator copy", () => {
    expect(formatCalendarEventDateRange(footballMediaDay)).toBe("Jul 7-8");
    expect(formatCalendarEventDateRange(footballMediaDay, { includeYear: true })).toBe("Jul 7-8, 2026");
    expect(formatCalendarEventAllDayLabel(footballMediaDay)).toBe("All day Jul 7-8");
  });

  it("expands an all-day event across covered calendar dates only", () => {
    expect(eventOccursOnCalendarDay(footballMediaDay, new Date(2026, 6, 7))).toBe(true);
    expect(eventOccursOnCalendarDay(footballMediaDay, new Date(2026, 6, 8))).toBe(true);
    expect(eventOccursOnCalendarDay(footballMediaDay, new Date(2026, 6, 9))).toBe(false);
  });

  it("BUG: sorts mixed all-day and timed events by their Central display day", () => {
    process.env.TZ = "America/Chicago";

    const events = [
      { id: "all-day-sep-1", startsAt: "2026-09-01T00:00:00.000Z", endsAt: "2026-09-02T00:00:00.000Z", allDay: true },
      { id: "timed-aug-31", startsAt: "2026-09-01T00:00:00.000Z", endsAt: "2026-09-01T02:00:00.000Z", allDay: false },
      { id: "timed-sep-1", startsAt: "2026-09-02T01:00:00.000Z", endsAt: "2026-09-02T03:00:00.000Z", allDay: false },
      { id: "all-day-sep-2", startsAt: "2026-09-02T00:00:00.000Z", endsAt: "2026-09-03T00:00:00.000Z", allDay: true },
      { id: "timed-sep-2", startsAt: "2026-09-02T22:00:00.000Z", endsAt: "2026-09-03T00:00:00.000Z", allDay: false },
    ];

    expect(sortCalendarEventsForDisplay(events).map((event) => event.id)).toEqual([
      "timed-aug-31",
      "all-day-sep-1",
      "timed-sep-1",
      "all-day-sep-2",
      "timed-sep-2",
    ]);
  });
});
