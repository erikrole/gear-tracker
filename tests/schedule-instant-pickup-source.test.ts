import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(path, "utf8");
}

describe("Schedule instant-pickup compatibility", () => {
  it("keeps both worker entry routes on one direct-claim implementation", () => {
    const pickupRoute = source("src/app/api/shift-assignments/pickup/route.ts");
    const pickupHandler = source("src/app/api/shift-assignments/pickup/handler.ts");
    const compatibilityRoute = source("src/app/api/shift-assignments/request/route.ts");

    expect(pickupRoute).toContain("withAuth(handleOpenShiftPickup)");
    expect(pickupHandler).toContain("pickupOpenShift(body.shiftId, user.id)");
    expect(pickupHandler).toContain('action: "shift_pickup_claimed"');
    expect(pickupHandler).toContain('dispatchScheduleAssignmentNotifications(assignment.id, "assigned")');
    expect(compatibilityRoute).toContain("withAuth(handleOpenShiftPickup)");
    expect(compatibilityRoute).not.toContain('status: "REQUESTED"');
  });

  it("labels remaining request rows as legacy while current actions say claim", () => {
    const webSlot = source("src/components/shift-detail/ShiftSlotCard.tsx");
    const webCrew = source("src/components/shift-detail/crew-row.tsx");
    const nativeCrew = source("ios/Wisconsin/Views/Components/CrewRow.swift");
    const nativeEvent = source("ios/Wisconsin/Views/EventDetailSheet.swift");

    expect(webSlot).toContain("Claim this shift");
    expect(nativeEvent).toContain('Label("Claim this shift"');
    expect(webCrew).toContain("legacy request");
    expect(nativeCrew).toContain("legacy request");
  });
});
