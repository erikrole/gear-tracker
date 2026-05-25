import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("users location options state", () => {
  it("does not silently treat failed form-options locations as no-location user data", () => {
    const source = readFileSync("src/app/(app)/users/page.tsx", "utf8");

    expect(source).toContain("error: formOptionsError");
    expect(source).toContain("reload: reloadFormOptions");
    expect(source).toContain("Locations could not load. User location filters and Add User location assignment are unavailable until locations are readable.");
    expect(source).toContain("locationsLoading={formOptionsLoading}");
    expect(source).toContain("locationsError={Boolean(formOptionsError)}");
    expect(source).toContain("onRetryLocations={reloadFormOptions}");
  });

  it("keeps Add User creation blocked and retryable while location assignment data is unavailable", () => {
    const source = readFileSync("src/app/(app)/users/CreateUserCard.tsx", "utf8");

    expect(source).toContain("locationsLoading");
    expect(source).toContain("locationsError");
    expect(source).toContain("onRetryLocations");
    expect(source).toContain("locationOptionsUnavailable");
    expect(source).toContain("Locations could not load, so location assignment is unavailable.");
    expect(source).toContain("Retry locations");
    expect(source).toContain("if (locationsLoading || locationsError) return;");
    expect(source).toContain("disabled={submitting || locationsLoading || locationsError}");
  });

  it("marks the roster location filter unavailable when location options are loading or failed", () => {
    const source = readFileSync("src/app/(app)/users/UserFilters.tsx", "utf8");

    expect(source).toContain("locationsLoading");
    expect(source).toContain("locationsError");
    expect(source).toContain("locationFilterUnavailable");
    expect(source).toContain('aria-label={locationsError ? "Location filter unavailable" : "Location filter"}');
    expect(source).toContain("Locations unavailable");
    expect(source).toContain("Loading locations");
  });
});
