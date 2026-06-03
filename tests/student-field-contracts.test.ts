import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

function source(relativeFile: string) {
  return readFileSync(path.join(process.cwd(), relativeFile), "utf8");
}

describe("student field mobile contracts", () => {
  it("keeps iOS active checkouts scoped to open and pending-pickup work", () => {
    const apiClient = source("ios/Wisconsin/Core/APIClient.swift");

    expect(apiClient).toContain("statusList: activeOnly ? [.open, .pendingPickup] : nil");
    expect(apiClient).toContain(".init(name: \"status_in\", value: statusList.map(\\.rawValue).joined(separator: \",\"))");
  });

  it("keeps my-shifts gear context aligned with dashboard event work", () => {
    const route = source("src/app/api/my-shifts/route.ts");

    expect(route).toContain("\"PENDING_PICKUP\"");
    expect(route).toContain("if (status === \"PENDING_PICKUP\") return \"pickup_ready\"");
    expect(route).toContain("{ events: { some: { eventId: { in: eventIds } } } }");
    expect(route).toContain("{ shiftAssignmentId: { in: assignmentIds } }");
    expect(route).toContain("{ shiftAssignment: { shift: { shiftGroup: { eventId: { in: eventIds } } } } }");
  });

  it("returns real dashboard event-work all-day state instead of a hardcoded value", () => {
    const route = source("src/app/api/dashboard/route.ts");

    expect(route).toContain("allDay: true");
    expect(route).toContain("allDay: ev.allDay");
    expect(route).not.toContain("allDay: false");
  });
});
