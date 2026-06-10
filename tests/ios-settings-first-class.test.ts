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
    const appTab = source("ios/Wisconsin/Views/AppTabView.swift");
    const profileBody = bodyBetween(appTab, "struct ProfileView: View", "// MARK: - Profile destinations");

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
    const appTab = source("ios/Wisconsin/Views/AppTabView.swift");

    expect(appTab).toContain("if isStaffOrAdmin { toolsSection }");
    expect(appTab).toContain("title: \"Link Sticker Codes\"");
    expect(appTab).toContain("systemImage: \"qrcode.viewfinder\"");

    const scheduleSection = bodyBetween(appTab, "private var scheduleSection", "private var toolsSection");
    expect(scheduleSection).toContain("Text(\"Schedule\")");
    expect(scheduleSection).toContain("title: \"Upcoming shifts\"");
    expect(scheduleSection).toContain("title: \"Overdue bookings\"");
    expect(scheduleSection).toContain("if isStudent");
    expect(scheduleSection).toContain("title: \"My Availability\"");
    expect(scheduleSection).toContain("Availability blocks are advisory");
  });

  it("keeps notification and app settings honest at the menu level", () => {
    const appTab = source("ios/Wisconsin/Views/AppTabView.swift");

    expect(appTab).toContain("title: \"Delivery status\"");
    expect(appTab).toContain("notificationSummaryText");
    expect(appTab).toContain("pushStatusText");
    expect(appTab).toContain("case .denied:");
    expect(appTab).toContain("\"iOS off\"");
    expect(appTab).toContain("Text(\"In-app notifications always show in your inbox, regardless of these settings.\")");

    expect(appTab).toContain("title: \"Theme\"");
    expect(appTab).toContain("Text(themeChoice.label)");
    expect(appTab).toContain("title: \"Open iOS Settings\"");
    expect(appTab).toContain("title: \"Sign Out\"");
  });
});
