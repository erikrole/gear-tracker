import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function source(relativeFile: string) {
  return readFileSync(path.join(process.cwd(), relativeFile), "utf8");
}

function bodyBetween(text: string, startNeedle: string, endNeedle: string) {
  const start = text.indexOf(startNeedle);
  const end = text.indexOf(endNeedle, start);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return text.slice(start, end);
}

describe("iOS Settings hub", () => {
  it("presents Profile as a first-class Settings surface", () => {
    const profile = source("ios/Wisconsin/Views/ProfileView.swift");
    const profileBody = bodyBetween(profile, "struct ProfileView: View", "private enum ProfileDestination");

    expect(profileBody).toContain(".navigationTitle(\"Settings\")");
    expect(profileBody).not.toContain(".navigationTitle(\"Profile\")");
    expect(profileBody).toContain(".listStyle(.insetGrouped)");

    for (const section of [
      "headerSection",
      "scheduleSection",
      "accountSection",
      "notificationsSection",
      "appearanceSection",
      "appSection",
      "signOutSection",
    ]) {
      expect(profileBody).toContain(section);
    }

    expect(profileBody).toContain("SettingsMenuRow(");
    expect(profileBody).toContain("SettingsRowIcon(systemImage: systemImage, tint: tint)");
    expect(profileBody).toContain("SettingsStatusMetric(");
    expect(profileBody).toContain("StatusPill.role(session.currentUser?.role ?? \"\")");
  });

  it("keeps role-gated settings menus reachable without exposing staff tools to students", () => {
    const profile = source("ios/Wisconsin/Views/ProfileView.swift");

    expect(profile).toContain("if isStaffOrAdmin { toolsSection }");
    expect(profile).toContain("title: \"Link Sticker Codes\"");
    expect(profile).toContain("systemImage: \"qrcode.viewfinder\"");

    const scheduleSection = bodyBetween(profile, "private var scheduleSection", "private var toolsSection");
    expect(scheduleSection).toContain("Text(\"Schedule\")");
    expect(scheduleSection).toContain("title: \"Upcoming shifts\"");
    expect(scheduleSection).toContain("title: \"Overdue bookings\"");
    expect(scheduleSection).toContain("if isStudent");
    expect(scheduleSection).toContain("title: \"My Availability\"");
    expect(scheduleSection).toContain("Availability blocks are advisory");
  });

  it("keeps notification and app settings honest at the menu level", () => {
    const profile = source("ios/Wisconsin/Views/ProfileView.swift");
    const notifications = source("ios/Wisconsin/Views/NotificationSettingsView.swift");

    expect(notifications).toContain("title: \"Delivery status\"");
    expect(profile).toContain("notificationSummaryText");
    expect(profile).toContain("pushStatusText");
    expect(profile).toContain("case .denied:");
    expect(profile).toContain("\"iOS off\"");
    expect(notifications).toContain("Text(\"In-app notifications always show in your inbox, regardless of these settings.\")");

    expect(profile).toContain("title: \"Theme\"");
    expect(profile).toContain("Text(themeChoice.label)");
    expect(profile).toContain("title: \"Open iOS Settings\"");
    expect(profile).toContain("title: \"Sign Out\"");
  });

  it("routes profile and assignment avatars through the shared component", () => {
    const profile = source("ios/Wisconsin/Views/ProfileView.swift");
    const userDetail = source("ios/Wisconsin/Views/UserDetailView.swift");
    const assignSheet = source("ios/Wisconsin/Views/Schedule/AssignStudentSheet.swift");

    const accountAvatar = bodyBetween(profile, "struct AccountAvatar: View", "\n}");

    expect(accountAvatar).toContain("UserAvatarView(");
    expect(accountAvatar).not.toContain("AsyncImage");
    expect(userDetail).toContain("UserAvatarView(");
    expect(userDetail).not.toContain("private func profileAvatar");
    expect(assignSheet).toContain("UserAvatarView(");
    expect(assignSheet).not.toContain("private var avatar");
  });
});
