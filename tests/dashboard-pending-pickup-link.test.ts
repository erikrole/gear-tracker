import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function source(relativeFile: string) {
  return readFileSync(path.join(process.cwd(), relativeFile), "utf8");
}

describe("dashboard pending pickup links", () => {
  it("routes pending-pickup rows to reservations", () => {
    const component = source("src/app/(app)/dashboard/team-activity-column.tsx");
    expect(component).toContain('const PENDING_PICKUPS_HREF = "/bookings?tab=reservations"');
    expect(component).toContain('title="Pending pickup" href={PENDING_PICKUPS_HREF}');
  });

  it("retires the separate stale-reservation dashboard lane", () => {
    const component = source("src/app/(app)/dashboard/team-activity-column.tsx");
    const route = source("src/app/api/dashboard/route.ts");
    const countReader = source("src/lib/services/dashboard-counts.ts");
    expect(component).not.toContain("STALE_RESERVATIONS_HREF");
    expect(component).not.toContain('title="Stale reservations"');
    expect(route).toContain("staleReservations");
    expect(countReader).toContain("0::bigint AS stale_reservations");
  });
});
