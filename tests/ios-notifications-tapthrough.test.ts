import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function source(relativeFile: string) {
  return readFileSync(path.join(process.cwd(), relativeFile), "utf8");
}

function slice(text: string, start: string, end: string) {
  const startIndex = text.indexOf(start);
  const endIndex = text.indexOf(end, startIndex);
  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);
  return text.slice(startIndex, endIndex);
}

describe("iOS notification tap-through contracts", () => {
  it("sends shift gear-up APNs payloads with event routing context", () => {
    const notifications = source("src/lib/services/notifications.ts");
    const gearUp = slice(
      notifications,
      "export async function createShiftGearUpNotification",
      "type ShiftScheduleEvent",
    );

    expect(gearUp).toContain("const pushPayload = {");
    expect(gearUp).toContain("assignmentId: assignment.id");
    expect(gearUp).toContain("shiftId: assignment.shiftId");
    expect(gearUp).toContain("eventId: event.id");
    expect(gearUp).toContain("void sendPushToUser(assignment.userId, { title, body, payload: pushPayload });");
  });

  it("sends shift schedule APNs payloads with event routing context", () => {
    const notifications = source("src/lib/services/notifications.ts");
    const schedule = slice(
      notifications,
      "export async function createShiftScheduleNotification",
      "type ReservationLifecycleEvent",
    );

    expect(schedule).toContain("const pushPayload = {");
    expect(schedule).toContain("assignmentId: assignment.id");
    expect(schedule).toContain("shiftId: assignment.shiftId");
    expect(schedule).toContain("eventId: calendarEvent.id");
    expect(schedule).toContain("void sendPushToUser(assignment.userId, { title: copy.title, body: copy.body, payload: pushPayload });");
  });

  it("routes tapped event pushes into Schedule without consuming the event id in the tab shell", () => {
    const appDelegate = source("ios/Wisconsin/App/AppDelegate.swift");
    const appTab = source("ios/Wisconsin/Views/AppTabView.swift").split("// MARK: - Profile")[0];
    const schedule = source("ios/Wisconsin/Views/ScheduleView.swift");

    expect(appDelegate).toContain("userInfo[\"eventId\"] as? String");
    expect(appDelegate).toContain("sharedAppState?.pendingPushEventId = eventId");

    expect(appTab).toContain(".onChange(of: appState.pendingPushEventId)");
    expect(appTab).toContain("private func routePendingEventPush()");
    expect(appTab).toContain("appState.selectedTab = 4");
    expect(appTab).not.toContain("appState.pendingPushEventId = nil");

    expect(schedule).toContain(".onChange(of: appState.pendingPushEventId)");
    expect(schedule).toContain("appState.pendingPushEventId = nil");
    expect(schedule).toContain("selectedEvent = event");
  });
});
