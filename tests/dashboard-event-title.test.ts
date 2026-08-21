import { describe, expect, it } from "vitest";
import { dashboardEventTitle } from "@/app/(app)/dashboard/event-title";

describe("dashboardEventTitle", () => {
  it("preserves manual event titles when sport metadata has no opponent", () => {
    expect(
      dashboardEventTitle({
        title: "Lambeau Field Visit",
        sportCode: "FB",
        opponent: null,
        isHome: null,
      }),
    ).toBe("Lambeau Field Visit");
  });

  it("keeps generated matchup labels for structured sport events", () => {
    expect(
      dashboardEventTitle({
        title: "Ohio State Football",
        sportCode: "FB",
        opponent: "Ohio State",
        isHome: true,
      }),
    ).toBe("Football vs Ohio State");
  });

  it("corrects legacy abbreviated opponent casing in dashboard labels", () => {
    expect(
      dashboardEventTitle({
        title: "Women's Soccer vs Tcu",
        sportCode: "WSOC",
        opponent: "Tcu",
        isHome: true,
      }),
    ).toBe("Women's Soccer vs TCU");
  });

  it("keeps imported matchup qualifiers out of the primary dashboard title", () => {
    expect(
      dashboardEventTitle({
        title: "Women's Soccer vs Marquette- Camper Reunion/Youth Sports Day",
        sportCode: "WSOC",
        opponent: "Marquette - Camper Reunion/Youth Sports Day",
        isHome: true,
      }),
    ).toBe("Women's Soccer vs Marquette");
  });
});
