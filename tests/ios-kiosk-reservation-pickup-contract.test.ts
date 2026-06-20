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
});
