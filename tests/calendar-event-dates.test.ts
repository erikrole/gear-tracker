import { describe, expect, it } from "vitest";
import {
  eventOccursOnCalendarDay,
  formatCalendarEventAllDayLabel,
  formatCalendarEventDateRange,
} from "@/lib/calendar-event-dates";

const footballMediaDay = {
  startsAt: "2026-07-07T05:00:00.000Z",
  endsAt: "2026-07-09T05:00:00.000Z",
  allDay: true,
};

describe("calendar event date helpers", () => {
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
});
