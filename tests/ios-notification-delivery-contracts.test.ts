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

describe("APNs delivery semantics", () => {
  it("badges the count of gear the user has out, not unread notifications", () => {
    const apns = source("src/lib/push/apns.ts");
    const notifications = source("src/lib/services/notifications.ts");

    // An explicit 0 clears the badge, so an unknown count must omit the key
    // rather than default to zero and wipe a legitimate count.
    expect(apns).toContain('...(typeof opts.badge === "number" ? { badge: Math.max(0, opts.badge) } : {})');

    expect(notifications).toContain("async function activeCheckoutBadgeCount(userId: string)");
    expect(notifications).toContain(
      'where: { kind: "CHECKOUT", status: "OPEN", requesterUserId: userId },',
    );
    // An unread count clears itself by being looked at; open custody does not.
    expect(notifications).not.toContain("db.notification.count({ where: { userId, readAt: null } })");
    // A failed count must cost the badge, never the notification.
    expect(notifications).toContain("return undefined;");
    expect(notifications).toContain("badge,");
  });

  it("collapses the escalation ladder onto one banner per checkout", () => {
    const apns = source("src/lib/push/apns.ts");
    const notifications = source("src/lib/services/notifications.ts");

    expect(apns).toContain('"apns-collapse-id"');
    expect(apns).toContain("MAX_COLLAPSE_ID_BYTES = 64");
    // Over-long ids are dropped, not sent — APNs rejects the whole request.
    expect(apns).toContain('Buffer.byteLength(collapseId, "utf8") > MAX_COLLAPSE_ID_BYTES');

    expect(notifications).toContain("export function checkoutCollapseId(bookingId: string)");
    expect(notifications).toContain("export function checkoutThreadId(bookingId: string)");

    const escalation = slice(notifications, "const escalationCategory =", "if (checkout.requester.email)");
    expect(escalation).toContain("collapseId: checkoutCollapseId(checkout.id)");
    expect(escalation).toContain("threadId: checkoutThreadId(checkout.id)");
  });

  it("reserves Focus breakthrough for past-due alerts and staff nudges", () => {
    const apns = source("src/lib/push/apns.ts");
    const notifications = source("src/lib/services/notifications.ts");
    const nudge = source("src/app/api/bookings/[id]/nudge/route.ts");
    const projectYml = source("ios/project.yml");
    const entitlements = source("ios/Wisconsin/Wisconsin.entitlements");

    expect(apns).toContain('"interruption-level": opts.interruptionLevel');

    // A "due in 1 hour" heads-up must NOT break Focus; only hoursFromDue >= 0.
    const escalation = slice(notifications, "const escalationCategory =", "if (checkout.requester.email)");
    expect(escalation).toContain('interruptionLevel: rule.hoursFromDue >= 0 ? "time-sensitive" : undefined');

    expect(nudge).toContain('interruptionLevel: "time-sensitive"');

    // The level is inert without the entitlement, and the entitlement file is
    // generated — both have to be in step.
    expect(projectYml).toContain("com.apple.developer.usernotifications.time-sensitive: true");
    expect(entitlements).toContain("com.apple.developer.usernotifications.time-sensitive");
  });

  it("does not let a personal toggle mute org-wide overdue oversight", () => {
    const notifications = source("src/lib/services/notifications.ts");
    const adminEscalation = slice(
      notifications,
      "deferPush(sendPushToUser(admin.id, {",
      "if (admin.email)",
    );
    // Admin-side overdue escalation is custody oversight, not a personal
    // reminder, so it stays outside the checkoutOverdue category gate.
    expect(adminEscalation).not.toContain("category:");
    expect(adminEscalation).toContain('interruptionLevel: "time-sensitive"');
  });

  it("keeps reservation lifecycle alerts threaded but never collapsed", () => {
    const notifications = source("src/lib/services/notifications.ts");
    const reservation = slice(
      notifications,
      "deferPush(sendPushToUser(requesterUserId, {",
      "} catch (err) {",
    );
    expect(reservation).toContain("threadId: checkoutThreadId(bookingId)");
    // "Cancelled" must never silently overwrite an unread "ready for pickup".
    expect(reservation).not.toContain("collapseId");
  });
});

describe("iOS notification lifecycle", () => {
  it("walks the icon badge down as gear comes back", () => {
    const appState = source("ios/Wisconsin/Core/AppState.swift");
    const dashboardModels = source("ios/Wisconsin/Models/DashboardModels.swift");

    expect(appState).toContain("func syncApplicationBadge()");
    expect(appState).toContain("UNUserNotificationCenter.current().setBadgeCount(count)");
    // Server-sent badges only cover the app-closed case; refresh covers the rest.
    expect(appState).toContain("let count = max(0, activeCheckoutCount)");
    expect(appState).toContain("activeCheckoutCount = stats.myCheckoutsTotal ?? 0");

    // `stats.checkedOut` reports the whole org outside the ios-home scope, so
    // the badge has to read the always-personal field instead.
    expect(dashboardModels).toContain("let myCheckoutsTotal: Int?");
  });

  it("leaves no notification state behind for the next user on a shared device", () => {
    const appState = source("ios/Wisconsin/Core/AppState.swift");
    const app = source("ios/Wisconsin/App/WisconsinApp.swift");

    expect(appState).toContain("func clearNotificationState()");
    expect(appState).toContain("pushRegistrationState = .unknown");
    // Or the next user's icon claims they have the previous user's gear out.
    expect(appState).toContain("activeCheckoutCount = 0");

    const signOut = slice(app, "if user == nil, oldUser != nil {", "// Push permission is now requested");
    // Server-side revoke already happens in SessionStore.logout; the local
    // copy has to go too or Settings offers a test push against a dead token.
    expect(signOut).toContain("UserDefaults.standard.removeObject(forKey: PushTokenStorage.currentTokenKey)");
    expect(signOut).toContain("appState.clearNotificationState()");
    // Delivered banners name gear and bookings the next user shouldn't see.
    expect(signOut).toContain("removeAllDeliveredNotifications()");
  });

  it("asks each user for push once, not each device once", () => {
    const app = source("ios/Wisconsin/App/WisconsinApp.swift");

    expect(app).toContain("private func maybeShowPushPrompt(for userId: String) async");
    expect(app).toContain('let key = "WisconsinPushSoftPromptShown.\\(userId)"');
    // The old device-wide flag meant the second person to sign in never saw it.
    expect(app).not.toContain('let key = "WisconsinPushSoftPromptShown"');
    expect(app).toContain("maybeShowPushPrompt(for: userId)");
  });
});
