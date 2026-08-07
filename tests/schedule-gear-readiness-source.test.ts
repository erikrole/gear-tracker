import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const listViewSource = readFileSync("src/app/(app)/schedule/_components/ListView.tsx", "utf8");
const crewSource = readFileSync("src/app/(app)/events/[id]/_components/ShiftCoverageCard.tsx", "utf8");
const reservationWizardSource = readFileSync("src/components/booking-wizard/BookingWizard.tsx", "utf8");

describe("schedule gear readiness source contracts", () => {
  it("keeps Schedule list free of reservation prep and checkout custody actions", () => {
    expect(listViewSource).not.toContain("Reserve gear");
    expect(listViewSource).not.toContain("/reservations/new?");
    expect(listViewSource).not.toContain("/checkouts/new");
  });

  it("keeps per-row gear readiness out of Event detail Crew rows", () => {
    // Crew rows carry one signal (coverage status). Gear readiness lives in the
    // card's gear summary strip and the actionable Missing Gear section instead.
    for (const label of ["Assignment gear", "Event reservation", "Pickup ready"]) {
      expect(crewSource).not.toContain(label);
    }
    expect(crewSource).toContain("Missing Gear (");
    expect(crewSource).toContain("commandCenter.missingGear.map");
    expect(crewSource).toContain("Reserve gear");
  });

  it("shows audit-derived schedule changes without draft/review badges", () => {
    const readinessSource = readFileSync("src/app/(app)/schedule/_components/ScheduleReadiness.tsx", "utf8");
    expect(readinessSource).toContain('label: "Assignee changes"');
    expect(readinessSource).toContain("recentActivityCount");
    expect(listViewSource).not.toContain("Review changes");
    expect(listViewSource).not.toContain("Unpublished changes");
    expect(crewSource).toContain("Recent schedule changes");
    expect(crewSource).toContain("Needs review");
  });

  it("preserves assignment context when Schedule opens the reservation wizard", () => {
    expect(reservationWizardSource).toContain("initialShiftAssignmentId");
    expect(reservationWizardSource).toContain("payload.shiftAssignmentId");
  });
});
