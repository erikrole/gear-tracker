import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("booking wizard event context recovery", () => {
  it("keeps failed calendar-event reads distinct from true no-event results", () => {
    const hook = readFileSync("src/components/create-booking/use-event-context.ts", "utf8");
    const step = readFileSync("src/components/booking-wizard/WizardStep1.tsx", "utf8");
    const wizard = readFileSync("src/components/booking-wizard/BookingWizard.tsx", "utf8");

    expect(hook).toContain("eventsLoadError");
    expect(hook).toContain('throw new Error(await parseErrorMessage(res, "Failed to load events"))');
    expect(hook).toContain('setEventsLoadError(err instanceof TypeError ? "network" : "server")');
    expect(hook).toContain("retryEvents");

    expect(step).toContain("Could not load upcoming events.");
    expect(step).toContain("Could not reach the calendar feed.");
    expect(step).toContain("Retry events");
    expect(step).toContain("Use ad hoc details");

    expect(wizard).toContain("eventsLoadError={eventsLoadError}");
    expect(wizard).toContain("onRetryEvents={retryEvents}");
  });
});
