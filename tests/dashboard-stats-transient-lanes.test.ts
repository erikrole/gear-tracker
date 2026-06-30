import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function source(relativeFile: string) {
  return readFileSync(path.join(process.cwd(), relativeFile), "utf8");
}

describe("dashboard stats transient-lane counts", () => {
  it("stats endpoint returns pendingPickupTotal and staleReservationTotal", () => {
    const route = source("src/app/api/dashboard/stats/route.ts");
    expect(route).toContain("pendingPickupTotal: c.pendingPickupTotal");
    expect(route).toContain("staleReservationTotal: c.staleReservationTotal");
  });

  it("stats endpoint exposes a user-scoped due-today count for sidebar chrome", () => {
    const route = source("src/app/api/dashboard/stats/route.ts");
    const reader = source("src/lib/services/dashboard-counts.ts");

    expect(reader).toContain("AS my_due_today");
    expect(reader).toContain("myDueToday: Number(c.my_due_today)");
    expect(route).toContain("myDueTodayCount: c.myDueToday");
  });

  it("stats endpoint exposes separate upcoming and today shift counts", () => {
    const route = source("src/app/api/dashboard/stats/route.ts");
    const types = source("src/app/(app)/dashboard-types.ts");

    expect(route).toContain("myShiftsCount");
    expect(route).toContain("myShiftsTodayCount");
    expect(route).toContain("startsAt: { lt: startOfTomorrow }");
    expect(route).toContain("endsAt: { gt: startOfToday }");
    expect(types).toContain("myShiftsCount: number");
    expect(types).toContain("myShiftsTodayCount: number");
  });

  it("both dashboard routes consume the shared count reader", () => {
    const stats = source("src/app/api/dashboard/stats/route.ts");
    const full = source("src/app/api/dashboard/route.ts");
    expect(stats).toContain("readDashboardCounts");
    expect(full).toContain("readDashboardCounts");
  });

  it("stats endpoint does not fetch row-level booking details", () => {
    const route = source("src/app/api/dashboard/stats/route.ts");
    expect(route).not.toContain("findMany");
    expect(route).not.toContain("toBookingSummary");
    expect(route).not.toContain("serializedItems");
  });

  it("shared reader keeps the count query as one bounded aggregate", () => {
    const reader = source("src/lib/services/dashboard-counts.ts");
    const selectCount = (reader.match(/SELECT/g) ?? []).length;
    const fromBookings = (reader.match(/FROM bookings/g) ?? []).length;
    expect(selectCount).toBe(1);
    expect(fromBookings).toBe(1);
    expect(reader).toContain("AS pending_pickup");
    expect(reader).toContain("AS stale_reservations");
  });

  it("DashboardStats type carries the two transient-lane totals", () => {
    const types = source("src/app/(app)/dashboard-types.ts");
    expect(types).toContain("pendingPickupTotal: number");
    expect(types).toContain("staleReservationTotal: number");
  });

  it("useDashboardData overlays the totals into pendingPickups and staleReservations", () => {
    const hook = source("src/hooks/use-dashboard-data.ts");
    expect(hook).toContain("pendingPickups: {");
    expect(hook).toContain("total: statsData.pendingPickupTotal");
    expect(hook).toContain("staleReservations: {");
    expect(hook).toContain("total: statsData.staleReservationTotal");
  });
});
