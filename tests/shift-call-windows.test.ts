import { describe, expect, it } from "vitest";
import {
  effectiveCallWindow,
  summarizeEffectiveCallWindows,
  toDateTimeLocalValue,
  dateTimeLocalToIso,
} from "@/lib/shift-call-windows";

describe("shift call-window helpers", () => {
  const shift = {
    startsAt: "2026-07-07T13:00:00.000Z",
    endsAt: "2026-07-07T16:00:00.000Z",
    callStartsAt: "2026-07-07T12:30:00.000Z",
    callEndsAt: "2026-07-07T15:30:00.000Z",
  };

  it("uses assignment override before slot and default windows", () => {
    expect(effectiveCallWindow(shift, {
      callStartsAt: "2026-07-07T14:15:00.000Z",
      callEndsAt: "2026-07-07T15:30:00.000Z",
    })).toEqual({
      startsAt: "2026-07-07T14:15:00.000Z",
      endsAt: "2026-07-07T15:30:00.000Z",
      source: "assignment",
    });
  });

  it("uses slot override before generated/default shift window", () => {
    expect(effectiveCallWindow(shift)).toEqual({
      startsAt: "2026-07-07T12:30:00.000Z",
      endsAt: "2026-07-07T15:30:00.000Z",
      source: "slot",
    });
  });

  it("falls back to generated/default shift window when no override pair exists", () => {
    expect(effectiveCallWindow({
      startsAt: "2026-07-07T13:00:00.000Z",
      endsAt: "2026-07-07T16:00:00.000Z",
      callStartsAt: null,
      callEndsAt: null,
    }, { callStartsAt: null, callEndsAt: null })).toEqual({
      startsAt: "2026-07-07T13:00:00.000Z",
      endsAt: "2026-07-07T16:00:00.000Z",
      source: "default",
    });
  });

  it("summarizes mixed effective call windows instead of one false shared label", () => {
    const summary = summarizeEffectiveCallWindows([
      effectiveCallWindow(shift),
      effectiveCallWindow(shift, {
        callStartsAt: "2026-07-07T14:15:00.000Z",
        callEndsAt: "2026-07-07T15:30:00.000Z",
      }),
    ]);

    expect(summary.mixed).toBe(true);
    expect(summary.label).toBe("Mixed call windows");
    expect(summary.title).toContain("Slot:");
    expect(summary.title).toContain("Personal:");
  });

  it("hides inherited midnight-to-midnight windows for all-day event chrome", () => {
    const startsAt = new Date(2026, 5, 17).toISOString();
    const endsAt = new Date(2026, 5, 18).toISOString();
    const summary = summarizeEffectiveCallWindows([
      {
        startsAt,
        endsAt,
        source: "default",
      },
    ], { hideInheritedFullDayWindows: true });

    expect(summary).toEqual({ label: null, title: null, mixed: false });
  });

  it("keeps explicit all-day call overrides visible", () => {
    const summary = summarizeEffectiveCallWindows([
      {
        startsAt: "2026-06-17T14:00:00.000Z",
        endsAt: "2026-06-17T18:00:00.000Z",
        source: "slot",
      },
    ], { hideInheritedFullDayWindows: true });

    expect(summary.label).toContain("Call");
    expect(summary.title).toBe("Slot call window");
  });

  it("suppresses all call-window labels when the owning event is all-day", () => {
    const summary = summarizeEffectiveCallWindows([
      {
        startsAt: "2026-06-17T13:00:00.000Z",
        endsAt: "2026-06-18T00:00:00.000Z",
        source: "slot",
      },
      {
        startsAt: "2026-06-17T14:00:00.000Z",
        endsAt: "2026-06-17T18:00:00.000Z",
        source: "assignment",
      },
    ], { hideAllDayEventWindows: true });

    expect(summary).toEqual({ label: null, title: null, mixed: false });
  });

  it("round-trips datetime-local values through ISO strings", () => {
    const localValue = toDateTimeLocalValue("2026-07-07T14:15:00.000Z");
    expect(localValue).toMatch(/^2026-07-07T\d{2}:15$/);
    expect(dateTimeLocalToIso(localValue)).toMatch(/2026-07-07T/);
  });
});
