import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(path, "utf8");
}

describe("booking real-time sync source contract", () => {
  it("forces the persisted dashboard payload to refetch on mount", () => {
    const hook = source("src/hooks/use-dashboard-data.ts");

    expect(hook).toMatch(/queryKey:\s*DASHBOARD_KEY,[\s\S]*?refetchOnMount:\s*"always"/);
  });

  it("forces the dashboard stats overlay to refetch on mount", () => {
    const hook = source("src/hooks/use-dashboard-data.ts");

    expect(hook).toMatch(/queryKey:\s*DASHBOARD_STATS_KEY,[\s\S]*?refetchOnMount:\s*"always"/);
  });

  it("forces booking detail cache to verify server truth on mount", () => {
    const hook = source("src/hooks/useBookingDetail.ts");

    expect(hook).toMatch(/queryKey,[\s\S]*?refetchOnMount:\s*"always"/);
  });

  it("forces shared booking lists to verify server truth on mount", () => {
    const list = source("src/components/BookingListPage.tsx");

    expect(list).toMatch(/queryKey:\s*\["bookingList", config\.kind, listUrl\],[\s\S]*?refetchOnMount:\s*"always"/);
  });

  it("polls the lightweight booking change signal instead of the heavy dashboard route", () => {
    const hook = source("src/hooks/use-booking-change-sync.ts");

    expect(hook).toContain('"/api/bookings/changes"');
    expect(hook).not.toContain('"/api/dashboard"');
    expect(hook).toContain("BOOKING_CHANGE_SYNC_INTERVAL_MS = 5_000");
    expect(hook).toContain('document.visibilityState === "hidden"');
    expect(hook).toContain("!navigator.onLine");
  });

  it("invalidates dashboard, stats, booking lists, and changed booking details", () => {
    const hook = source("src/hooks/use-booking-change-sync.ts");

    expect(hook).toContain("queryKey: DASHBOARD_KEY");
    expect(hook).toContain("queryKey: DASHBOARD_STATS_KEY");
    expect(hook).toContain('queryKey: ["bookingList"]');
    expect(hook).toContain('queryKey: ["booking", bookingId]');
    expect(hook).toContain("BOOKING_CHANGE_SYNC_EVENT");
    expect(hook).toContain("window.dispatchEvent");
  });

  it("wires booking change sync into dashboard and the shared booking list", () => {
    const dashboard = source("src/app/(app)/page.tsx");
    const list = source("src/components/BookingListPage.tsx");

    expect(dashboard).toContain('import { useBookingChangeSync } from "@/hooks/use-booking-change-sync"');
    expect(dashboard).toContain("useBookingChangeSync();");
    expect(list).toContain('import { useBookingChangeSync } from "@/hooks/use-booking-change-sync"');
    expect(list).toContain("useBookingChangeSync();");
  });

  it("refreshes an open booking detail sheet when its booking id changes", () => {
    const sheet = source("src/components/BookingDetailsSheet.tsx");

    expect(sheet).toContain('BOOKING_CHANGE_SYNC_EVENT');
    expect(sheet).toContain("window.addEventListener(BOOKING_CHANGE_SYNC_EVENT");
    expect(sheet).toContain("changedBookingIds.includes(bookingId)");
    expect(sheet).toContain("fetchBooking({ silent: true })");
  });
});
