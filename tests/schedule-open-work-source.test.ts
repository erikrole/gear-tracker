import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(path, "utf8");
}

describe("schedule open work source contracts", () => {
  it("keeps Open Work separate from trade listing while preserving trade actions", () => {
    const tradeBoard = source("src/components/TradeBoard.tsx");

    expect(tradeBoard).toContain("Open Work");
    expect(tradeBoard).toContain("/api/schedule/open-work");
    expect(tradeBoard).toContain("/api/shift-assignments/pickup");
    expect(tradeBoard).toContain("/api/shift-trades/${tradeId}/claim");
    expect(tradeBoard).toContain("/api/shift-trades/${tradeId}/approve");
    expect(tradeBoard).toContain("/api/shift-trades/${tradeId}/decline");
    expect(tradeBoard).toContain("/api/shift-trades/${tradeId}/cancel");
    expect(tradeBoard).toContain("Request shift");
    expect(tradeBoard).toContain("Claim shift");
    expect(tradeBoard).toContain("Pickup request approved");
  });

  it("keeps the Open Work read model published, student-slot, and permission scoped", () => {
    const service = source("src/lib/services/schedule-open-work.ts");
    const route = source("src/app/api/schedule/open-work/route.ts");

    expect(route).toContain('requirePermission(user.role, "shift_trade", "view")');
    expect(service).toContain("workerType: \"ST\"");
    expect(service).toContain("publishedAt: { not: null }");
    expect(service).toContain("assignments: {\n        none: { status: { in: ACTIVE_STATUSES } },");
    expect(service).toContain("scoreCandidatesForShift");
  });

  it("keeps pickup mutation audited, publication-safe, and notification-policy wired", () => {
    const service = source("src/lib/services/schedule-open-work.ts");
    const route = source("src/app/api/shift-assignments/pickup/route.ts");

    expect(route).toContain('requirePermission(user.role, "shift_assignment", "request")');
    expect(route).toContain("pickupOpenShift(body.shiftId, user.id)");
    expect(route).toContain("shift_pickup_requested");
    expect(route).toContain("shift_pickup_claimed");
    expect(route).toContain("dispatchScheduleAssignmentNotifications(assignment.id, \"assigned\")");
    expect(service).toContain("Draft shifts are not open for pickup");
    expect(service).toContain("Open pickup is available for Student slots only");
    expect(service).toContain("TransactionIsolationLevel.Serializable");
  });
});
