import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

function source(relativeFile: string) {
  return readFileSync(path.join(process.cwd(), relativeFile), "utf8");
}

describe("iOS kiosk reservation pickup contract", () => {
  it("routes due reservation pickups through the existing native pickup flow", () => {
    const studentRoute = source("src/app/api/kiosk/student/[userId]/route.ts");
    const detailRoute = source("src/app/api/kiosk/checkout/[id]/route.ts");
    const scanRoute = source("src/app/api/kiosk/pickup/[id]/scan/route.ts");
    const confirmRoute = source("src/app/api/kiosk/pickup/[id]/confirm/route.ts");
    const studentHub = source("ios/Wisconsin/Kiosk/KioskStudentHubView.swift");
    const apiClient = source("ios/Wisconsin/Kiosk/KioskAPIClient.swift");
    const models = source("ios/Wisconsin/Kiosk/KioskModels.swift");

    expect(studentRoute).toContain("dueReservations");
    expect(studentRoute).toContain("pendingPickups: [...pendingPickups, ...dueReservations].map");
    expect(detailRoute).toContain('booking.kind === "RESERVATION"');
    expect(scanRoute).toContain('booking.kind === "RESERVATION" && booking.status === "BOOKED"');
    expect(confirmRoute).toContain("sourceReservationId: sourceReservation.id");

    expect(models).toContain("struct KioskPendingPickup: Decodable, Identifiable");
    expect(studentHub).toContain("store.screen = .pickup(bookingId: pickup.id, userId: user.id)");
    expect(apiClient).toContain("func kioskCheckoutDetail(id: String)");
    expect(apiClient).toContain("func kioskPickupScan(bookingId: String, scanValue: String)");
    expect(apiClient).toContain("func kioskPickupConfirm(bookingId: String, actorId: String)");
  });

  it("binds numbered bulk units atomically with checkout creation and reservation fulfillment", () => {
    const confirmRoute = source("src/app/api/kiosk/pickup/[id]/confirm/route.ts");
    const lifecycle = source("src/lib/services/bookings-lifecycle.ts");

    // The route passes staged units into createBooking instead of binding them
    // in a second transaction after the reservation is already COMPLETED.
    expect(confirmRoute).toContain("bulkUnitItems,");
    expect(confirmRoute).not.toContain("Battery unit no longer matches this checkout");
    // Exactly one transaction remains in the route (the PENDING_PICKUP branch).
    expect(confirmRoute.match(/db\.\$transaction/g)).toHaveLength(1);

    // createBooking owns the unit bind inside its SERIALIZABLE transaction.
    expect(lifecycle).toContain("bulkUnitItems?: Array<{ bulkSkuId: string; unitNumber: number }>");
    expect(lifecycle).toContain("status: BulkUnitStatus.CHECKED_OUT");
    expect(lifecycle).toContain("bookingBulkUnitAllocation.createMany");

    // The bind must cover exactly plannedQuantity per numbered SKU — the
    // ledger was decremented by planned, so under- or over-binding desyncs
    // custody from stock from the first minute.
    expect(lifecycle).toContain("if (bound !== item.plannedQuantity)");

    // Duplicate staged scans cannot satisfy planned quantity or double-bind.
    expect(confirmRoute).toContain("stagedUnitNumbers");

    // Already-done confirms read as success states, not raw status leaks.
    expect(confirmRoute).toContain("This reservation was already picked up");
    expect(confirmRoute).toContain("This pickup was already confirmed");
  });
});
