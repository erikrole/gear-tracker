import { describe, expect, it } from "vitest";
import { sportDefaultShiftWindow } from "@/lib/schedule-defaults";

describe("sportDefaultShiftWindow", () => {
  it("applies Sport settings offsets to timed events", () => {
    const result = sportDefaultShiftWindow(
      {
        startsAt: new Date("2026-08-20T18:00:00Z"),
        endsAt: new Date("2026-08-20T21:00:00Z"),
        allDay: false,
      },
      { shiftStartOffset: 90, shiftEndOffset: 30 },
    );

    expect(result).toEqual({
      startsAt: new Date("2026-08-20T16:30:00Z"),
      endsAt: new Date("2026-08-20T21:30:00Z"),
    });
  });

  it("keeps all-day event boundaries without fabricating clock times", () => {
    const result = sportDefaultShiftWindow(
      {
        startsAt: new Date("2026-08-21T00:00:00Z"),
        endsAt: new Date("2026-08-22T00:00:00Z"),
        allDay: true,
      },
      { shiftStartOffset: 90, shiftEndOffset: 30 },
    );

    expect(result).toEqual({
      startsAt: new Date("2026-08-21T00:00:00Z"),
      endsAt: new Date("2026-08-22T00:00:00Z"),
    });
  });
});
