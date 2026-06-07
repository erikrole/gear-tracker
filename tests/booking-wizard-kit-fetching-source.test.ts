import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("booking wizard kit fetching recovery", () => {
  it("keeps failed kit reads distinct from true no-kit results", () => {
    const hook = readFileSync("src/components/create-booking/use-kit-fetching.ts", "utf8");
    const step = readFileSync("src/components/booking-wizard/WizardStep1.tsx", "utf8");
    const wizard = readFileSync("src/components/booking-wizard/BookingWizard.tsx", "utf8");

    expect(hook).toContain("kitsLoadError");
    expect(hook).toContain('throw new Error(await parseErrorMessage(res, "Failed to load kits"))');
    expect(hook).toContain('setKitsLoadError(err instanceof TypeError ? "network" : "server")');
    expect(hook).toContain("retryKits");

    expect(step).toContain("Could not load kits for this location.");
    expect(step).toContain("Could not reach kits for this location.");
    expect(step).toContain("You can still continue without selecting a kit.");
    expect(step).toContain("Retry kits");
    expect(step).toContain("kits.length > 0 || kitsLoading || kitsLoadError");

    expect(wizard).toContain("kitsLoadError={kitsLoadError}");
    expect(wizard).toContain("onRetryKits={retryKits}");
  });
});
