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

  it("distinguishes event-linked and assignment-linked gear states in Event detail Crew", () => {
    expect(crewSource).toContain("Assignment gear");
    expect(crewSource).toContain("Event reservation");
    expect(crewSource).toContain("Pickup ready");
    expect(crewSource).toContain("Missing gear");
  });

  it("shows audit-derived schedule changes on Schedule and Event detail surfaces", () => {
    expect(listViewSource).toContain("Review changes");
    expect(listViewSource).not.toContain("Changed recently");
    expect(crewSource).toContain("Recent schedule changes");
    expect(crewSource).toContain("Needs review");
  });

  it("preserves assignment context when Schedule opens the reservation wizard", () => {
    expect(reservationWizardSource).toContain("initialShiftAssignmentId");
    expect(reservationWizardSource).toContain("payload.shiftAssignmentId");
  });
});
