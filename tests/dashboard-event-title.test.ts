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
});
