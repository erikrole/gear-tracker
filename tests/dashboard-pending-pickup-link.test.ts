import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function source(relativeFile: string) {
  return readFileSync(path.join(process.cwd(), relativeFile), "utf8");
}

describe("dashboard pending pickup links", () => {
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
