import { describe, expect, it } from "vitest";
import { venueToneFromEvent } from "@/lib/venue-tone";

describe("venueToneFromEvent", () => {
  it.each([
    [{ isHome: true, opponent: "Iowa" }, "home"],
    [{ isHome: false, opponent: "Iowa" }, "away"],
    [{ isHome: null, opponent: "Iowa" }, "neutral"],
    [{ isHome: null, opponent: null }, "non-game"],
  ] as const)("classifies %j as %s", (event, expected) => {
    expect(venueToneFromEvent(event)).toBe(expected);
  });

  it("keeps opponent-free media days non-game even with a legacy neutral prefix", () => {
    expect(venueToneFromEvent({
      isHome: null,
      opponent: null,
      rawSummary: "[N] Volleyball Media Day",
    })).toBe("non-game");
  });
});
