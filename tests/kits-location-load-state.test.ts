import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("kits location load state", () => {
  it("does not silently treat failed location loads as empty kit filters", () => {
    const source = readFileSync("src/app/(app)/kits/page.tsx", "utf8");

    expect(source).toContain("error: locationsError");
    expect(source).toContain("reload: reloadLocations");
    expect(source).toContain("locationFilterUnavailable");
    expect(source).toContain("Locations could not load. Kit filters and new-kit assignment are unavailable until locations are readable.");
    expect(source).toContain("onRetryLocations={reloadLocations}");
  });

  it("keeps new-kit creation disabled and retryable when locations fail", () => {
    const source = readFileSync("src/app/(app)/kits/new-kit-sheet.tsx", "utf8");

    expect(source).toContain("locationsError");
    expect(source).toContain("locationsLoading");
    expect(source).toContain("locationsUnavailable");
    expect(source).toContain("Locations could not load, so new kits cannot be assigned yet.");
    expect(source).toContain("Retry locations");
    expect(source).toContain("disabled={locationsUnavailable || submitting}");
  });
});
