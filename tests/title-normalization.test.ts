import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  normalizeBookingTitle,
  normalizeManualEventTitle,
} from "@/lib/title-normalization";
import { splitEventsForSync } from "@/lib/services/calendar-sync";

describe("operational title normalization", () => {
  it.each([
    ["MBB practice", "MBB Practice"],
    ["MBB GOLF", "MBB Golf"],
    ["wbb recruit shoot", "WBB Recruit Shoot"],
    ["  WHKY   GAME DAY  ", "WHKY Game Day"],
    ["MBB vs IOWA", "MBB vs Iowa"],
    ["WSOC at NORTHWESTERN", "WSOC at Northwestern"],
    ["WBB/MBB PRACTICE", "WBB/MBB Practice"],
    ["iPad and YouTube setup", "iPad and YouTube Setup"],
  ])("normalizes booking title %j to %j", (input, expected) => {
    expect(normalizeBookingTitle(input)).toBe(expected);
  });

  it.each([
    ["b1g media days", "B1G Media Days"],
    ["B1g Media Days", "B1G Media Days"],
    ["ncaa tournament", "NCAA Tournament"],
    ["wbb b1g championship", "WBB B1G Championship"],
    ["espn setup", "ESPN Setup"],
    ["av cart pull", "AV Cart Pull"],
    ["4k camera test", "4K Camera Test"],
    ["b1g's media room", "B1G's Media Room"],
    ["fb dji mic 1", "FB DJI Mic 1"],
    ["new ad staff", "New AD Staff"],
    ["ux checkout guard smoke", "UX Checkout Guard Smoke"],
  ])("always capitalizes known terms: %j to %j", (input, expected) => {
    expect(normalizeBookingTitle(input)).toBe(expected);
  });

  it("uses the same rule for manually authored event titles", () => {
    expect(normalizeManualEventTitle("mbb PRACTICE")).toBe("MBB Practice");
  });

  it("preserves non-UW acronyms in imported event summaries", () => {
    const result = splitEventsForSync([
      {
        uid: "event-1",
        summary: "MBB vs USC / UCLA / TCU",
        description: "",
        location: "",
        dtstart: "20260716T150000Z",
        dtend: "20260716T170000Z",
        status: "CONFIRMED",
      },
    ], [], []);

    expect(result.toCreate[0]?.summary).toBe("MBB vs USC / UCLA / TCU");
    expect(result.toCreate[0]?.rawSummary).toBe("MBB vs USC / UCLA / TCU");
  });

  it("wires the normalizer into manual create and edit writes", () => {
    const createRoute = readFileSync("src/app/api/calendar-events/route.ts", "utf8");
    const editRoute = readFileSync("src/app/api/calendar-events/[id]/route.ts", "utf8");

    expect(createRoute).toContain("summary: normalizeManualEventTitle(body.summary)");
    expect(editRoute).toContain("existing.sourceId === null");
    expect(editRoute).toContain("? normalizeManualEventTitle(body.summary)");
    expect(editRoute).toContain("patch.summary = derived");
  });
});
