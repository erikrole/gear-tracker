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

    expect(gearUp).toContain("const pushPayload = scheduleNotificationPayload({");
    expect(gearUp).toContain("assignmentId: assignment.id");
    expect(gearUp).toContain("shiftId: assignment.shiftId");
    expect(gearUp).toContain("eventId: event.id");
    expect(gearUp).toContain('category: categoryForScheduleNotificationType("shift_gear_up")');
  });

  it("sends shift schedule APNs payloads with event routing context", () => {
    const notifications = source("src/lib/services/notifications.ts");
    const schedule = slice(
      notifications,
      "export async function createShiftScheduleNotification",
      "type ReservationLifecycleEvent",
    );

    expect(schedule).toContain("const pushPayload = scheduleNotificationPayload({");
    expect(schedule).toContain("assignmentId: assignment.id");
    expect(schedule).toContain("shiftId: assignment.shiftId");
    expect(schedule).toContain("eventId: calendarEvent.id");
    expect(schedule).toContain("category,");
  });

  it("routes allowed event pushes into Schedule and drops inaccessible collaborator targets", () => {
    const appDelegate = source("ios/Wisconsin/App/AppDelegate.swift");
    const appTab = source("ios/Wisconsin/Views/AppTabView.swift").split("// MARK: - Profile")[0];
    const schedule = source("ios/Wisconsin/Views/ScheduleView.swift");
    const notifications = source("ios/Wisconsin/Views/NotificationsSheet.swift");
    const notificationModels = source("ios/Wisconsin/Models/NotificationModels.swift");

    // The payload key read moved into PushRoute so the banner and the inbox
    // resolve destinations through one ordered router; AppDelegate now only
    // maps the resolved route onto AppState.
    const routing = source("ios/Wisconsin/Core/PushRouting.swift");
    expect(routing).toContain("value(\"eventId\")");
    expect(appDelegate).toContain("sharedAppState?.pendingPushEventId = eventId");

    expect(appTab).toContain(".onChange(of: appState.pendingPushEventId)");
    expect(appTab).toContain("private func routePendingEventPush()");
    expect(appTab).toContain('guard hasCapability("PUBLISHED_SCHEDULE_VIEW") else {');
    expect(appTab).toContain("appState.selectedTab = 4");
    expect(appTab).toContain("appState.pendingPushEventId = nil");

    expect(schedule).toContain(".onChange(of: appState.pendingPushEventId)");
    expect(schedule).toContain("appState.pendingPushEventId = nil");
    expect(schedule).toContain("navigationPath.append(ScheduleEventRoute(id: event.id))");
    expect(schedule).toContain("APIClient.shared.publishedScheduleEvent(eventId: eventId)");
    expect(schedule).toContain("navigationPath.append(PublishedScheduleRoute(id: eventId))");

    expect(notificationModels).toContain("let eventId: String?");
    expect(notifications).toContain("if isShiftTargetedType(notif.type), let eventId = notif.payload?.eventId");
    expect(notifications).toContain("onSelectEvent?(eventId)");
  });

  it("resolves every banner tap through one router, ordered to match the inbox", () => {
    const routing = source("ios/Wisconsin/Core/PushRouting.swift");
    const appDelegate = source("ios/Wisconsin/App/AppDelegate.swift");

    // The tap handler must not read payload keys directly any more; drift
    // between it and the inbox is exactly what PushRoute exists to prevent.
    expect(appDelegate).toContain("PushRoute.resolve(userInfo: userInfo)");
    expect(appDelegate).not.toContain('userInfo["bookingId"] as? String');

    for (const destination of [
      "case booking(String)",
      "case trade(String)",
      "case event(String)",
      "case browse(BrowseRouteDestination)",
    ]) {
      expect(routing).toContain(destination);
    }

    // Trade payloads carry eventId too, so tradeId has to win or every trade
    // alert lands in Schedule instead of the Trade Board.
    const bookingAt = routing.indexOf('value("bookingId")');
    const tradeAt = routing.indexOf('value("tradeId")');
    const eventAt = routing.indexOf('value("eventId")');
    const hrefAt = routing.indexOf('value("href")');
    expect(bookingAt).toBeGreaterThan(0);
    expect(tradeAt).toBeGreaterThan(bookingAt);
    expect(eventAt).toBeGreaterThan(tradeAt);
    expect(hrefAt).toBeGreaterThan(eventAt);

    // The checkoutId alias the model defines and the inbox honors.
    expect(routing).toContain('value("bookingId") ?? value("checkoutId")');
  });

  it("routes trade pushes to the Trade Board, matching the inbox destination", () => {
    const appTab = source("ios/Wisconsin/Views/AppTabView.swift");
    const home = source("ios/Wisconsin/Views/HomeView.swift");

    expect(appTab).toContain("private func routePendingTradePush()");
    expect(appTab).toContain('guard hasCapability("PUBLISHED_SCHEDULE_VIEW") else {');

    expect(home).toContain("private func consumePendingTradePush()");
    expect(home).toContain("appState.pendingPushTradeId = nil");
    expect(home).toContain("showTrades = true");
  });

  it("gives href-only pushes a destination instead of dropping the tap", () => {
    const routing = source("ios/Wisconsin/Core/PushRouting.swift");
    const appTab = source("ios/Wisconsin/Views/AppTabView.swift");
    const browse = source("ios/Wisconsin/Views/BrowseView.swift");
    const licenses = source("src/lib/services/licenses.ts");
    const firmware = source("src/lib/services/firmware-watch.ts");

    // Server has to actually send an href for the fallback to have anything
    // to resolve; license pushes previously carried no routable key at all.
    expect(licenses).toContain('href: "/licenses"');
    expect(firmware).toContain("href: `/items?search=");

    // Parsed, not prefix-matched, so "/items?search=…" resolves.
    expect(routing).toContain("URLComponents(string: href)?.path");
    expect(routing).toContain("return .browse(.licenses)");
    expect(routing).toContain("return .browse(.items)");

    expect(appTab).toContain("private func routePendingBrowsePush()");
    // Licenses is a real tab on sidebar layouts and a Browse row otherwise.
    expect(appTab).toContain("destination == .licenses && showsSidebarDestinations");
    expect(browse).toContain("private func consumePendingBrowseDestination()");
    // Never deep-link past the gating that hides the row in the first place.
    expect(browse).toContain("guard destinations.contains(destination) else {");
    expect(appTab).toContain("case .licenses: !isCollaborator");
  });
});
