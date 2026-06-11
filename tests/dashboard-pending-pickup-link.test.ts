import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function source(relativeFile: string) {
  return readFileSync(path.join(process.cwd(), relativeFile), "utf8");
}

describe("dashboard pending pickup links", () => {
  it("guards dashboard overflow footers with any active filter, not sport alone", () => {
    const page = source("src/app/(app)/page.tsx");
    const myGear = source("src/app/(app)/dashboard/my-gear-column.tsx");
    const teamActivity = source("src/app/(app)/dashboard/team-activity-column.tsx");

    expect(page).toContain("hasActiveFilter={filters.hasActiveFilter}");
    expect(myGear).toContain("hasActiveFilter: boolean");
    expect(teamActivity).toContain("hasActiveFilter: boolean");
    expect(myGear.match(/!hasActiveFilter/g)).toHaveLength(2);
    expect(teamActivity.match(/!hasActiveFilter/g)).toHaveLength(4);
    expect(myGear).not.toContain("!activeSport && data.myCheckouts");
    expect(myGear).not.toContain("!activeSport && data.myReservations");
    expect(teamActivity).not.toContain("!activeSport && data.teamCheckouts");
    expect(teamActivity).not.toContain("!activeSport && data.pendingPickups");
    expect(teamActivity).not.toContain("!activeSport && data.staleReservations");
    expect(teamActivity).not.toContain("!activeSport && data.teamReservations");
  });

  it("routes awaiting-pickup rows to checkout pending-pickup list, not reservations", () => {
    const component = source("src/app/(app)/dashboard/team-activity-column.tsx");
    expect(component).toContain('const PENDING_PICKUPS_HREF = "/bookings?tab=checkouts&status=PENDING_PICKUP"');
    expect(component).not.toContain('title="Awaiting pickup" href="/bookings?tab=reservations"');
  });

  it("routes stale reservations to the reservation overdue list", () => {
    const component = source("src/app/(app)/dashboard/team-activity-column.tsx");
    const route = source("src/app/api/dashboard/route.ts");
    expect(component).toContain('const STALE_RESERVATIONS_HREF = "/bookings?tab=reservations&filter=overdue"');
    expect(component).toContain('title="Stale reservations" href={STALE_RESERVATIONS_HREF}');
    expect(route).toContain("staleReservations");
    expect(route).toContain("kind = 'RESERVATION' AND status = 'BOOKED' AND ends_at <");
  });
});
