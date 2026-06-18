import { describe, it, expect } from "vitest";
import {
  startOfTodayInAppTz,
  startOfDayInAppTz,
  normalizeAllDayToUtcMidnight,
} from "@/lib/app-time";

describe("startOfTodayInAppTz", () => {
  it("returns Central (CDT) midnight for a summer-morning UTC instant", () => {
    // 6:47am CDT on Jun 17 → start of today is Jun 17 00:00 CDT = 05:00Z.
    const now = new Date("2026-06-17T11:47:00Z");
    expect(startOfTodayInAppTz(now, "America/Chicago").toISOString()).toBe(
      "2026-06-17T05:00:00.000Z",
    );
  });

  it("uses the Central calendar day, not the UTC one, in the evening", () => {
    // 9pm CDT on Jun 16 (= 02:00Z Jun 17). "Today" is still Jun 16 locally.
    const now = new Date("2026-06-17T02:00:00Z");
    expect(startOfTodayInAppTz(now, "America/Chicago").toISOString()).toBe(
      "2026-06-16T05:00:00.000Z",
    );
  });

  it("handles standard time (CST, UTC-6)", () => {
    const now = new Date("2026-01-15T12:00:00Z"); // 6am CST Jan 15
    expect(startOfTodayInAppTz(now, "America/Chicago").toISOString()).toBe(
      "2026-01-15T06:00:00.000Z",
    );
  });
});

describe("startOfDayInAppTz (offset)", () => {
  it("returns start of tomorrow in the app timezone", () => {
    const now = new Date("2026-06-17T11:47:00Z"); // Jun 17 CDT
    expect(startOfDayInAppTz(now, 1, "America/Chicago").toISOString()).toBe(
      "2026-06-18T05:00:00.000Z",
    );
  });
});

describe("normalizeAllDayToUtcMidnight", () => {
  it("maps a Central (CDT) midnight encoding to UTC midnight of the same date", () => {
    // Lambeau-shaped: 2026-06-17T05:00Z is midnight CDT on Jun 17.
    expect(
      normalizeAllDayToUtcMidnight(new Date("2026-06-17T05:00:00Z"), "America/Chicago").toISOString(),
    ).toBe("2026-06-17T00:00:00.000Z");
  });

  it("is idempotent for an already-UTC-midnight instant (ICS shape)", () => {
    expect(
      normalizeAllDayToUtcMidnight(new Date("2026-06-17T00:00:00Z"), "America/Chicago").toISOString(),
    ).toBe("2026-06-17T00:00:00.000Z");
  });

  it("handles standard time (CST, UTC-6)", () => {
    expect(
      normalizeAllDayToUtcMidnight(new Date("2026-01-15T06:00:00Z"), "America/Chicago").toISOString(),
    ).toBe("2026-01-15T00:00:00.000Z");
  });
});
