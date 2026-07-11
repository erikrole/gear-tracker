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

describe("iOS Settings detail menus", () => {
  it("keeps root Settings as a navigation hub for account and notifications", () => {
    const profile = source("ios/Wisconsin/Views/ProfileView.swift");
    const settings = source("ios/Wisconsin/Views/SettingsView.swift");
    const profileBody = bodyBetween(profile, "struct ProfileView: View", "struct SettingsMenuRow");

    expect(profile).toContain("case notifications");
    expect(profile).toContain("case accountSecurity");
    expect(profileBody).toContain("destinationView(for: dest)");
    expect(profileBody).toContain("NotificationSettingsView(");
    expect(profileBody).toContain("AccountSecuritySettingsView(manageAccountURL: Self.manageAccountURL)");

    expect(settings).toContain("NavigationLink(value: ProfileDestination.accountSecurity)");
    expect(settings).toContain("SettingsRow(title: \"Account & Security\"");
    expect(settings).toContain("NavigationLink(value: ProfileDestination.notifications)");
    expect(settings).toContain("SettingsRow(title: \"Notifications\"");
    expect(settings).toContain("notificationStatusText");
    expect(settings).not.toContain("categoryToggle(");
    expect(settings).not.toContain("channelToggle(");
    expect(settings).not.toContain("pauseChip(");
  });

  it("moves delivery, channel, pause, and category controls into the native Notifications detail", () => {
    const detail = source("ios/Wisconsin/Views/NotificationSettingsView.swift");

    expect(detail).toContain(".navigationTitle(\"Notifications\")");
    expect(detail).toContain("title: \"Delivery status\"");
    expect(detail).toContain("pushPermissionRow");
    expect(detail).toContain("Text(\"In-app notifications always show in your inbox, regardless of these settings.\")");
    expect(detail).toContain("Text(\"Pause Alerts\")");
    expect(detail).toContain("title: \"Email alerts\"");
    expect(detail).toContain("title: \"Push alerts\"");
    expect(detail).toContain("Text(\"Notification Types\")");

    for (const category of [
      ".checkoutDue",
      ".checkoutOverdue",
      ".reservation",
      ".licenseExpiry",
      ".schedule",
      ".trade",
      ".gearPrep",
    ]) {
      expect(detail).toContain(`category: ${category}`);
    }

    expect(detail).toContain("await prefsVM.setChannel(.email, value: v)");
    expect(detail).toContain("await prefsVM.setChannel(.push, value: v)");
    expect(detail).toContain("await prefsVM.setCategory(category, value: value)");
  });

  it("adds a native Account & Security password workflow backed by the existing API", () => {
    const accountDetail = source("ios/Wisconsin/Views/AccountSecuritySettingsView.swift");
    const apiClient = source("ios/Wisconsin/Core/APIClient.swift");
    const route = source("src/app/api/me/change-password/route.ts");

    expect(accountDetail).toContain(".navigationTitle(\"Account & Security\")");
    expect(accountDetail).toContain("title: \"Manage profile on web\"");
    expect(accountDetail).toContain("Current password");
    expect(accountDetail).toContain("New password");
    expect(accountDetail).toContain("Confirm new password");
    expect(accountDetail).toContain("Toggle(\"Sign out other devices\", isOn: $revokeOtherSessions)");
    expect(accountDetail).toContain("showPasswords.toggle()");
    expect(accountDetail).toContain("newPassword.count >= 8");
    expect(accountDetail).toContain("currentPassword != newPassword");
    expect(accountDetail).toContain("APIClient.shared.changePassword(");
    expect(accountDetail).toContain("revokeOtherSessions: revokeOtherSessions");
    expect(accountDetail).toContain("Password changed. Other devices were signed out.");

    expect(apiClient).toContain("func changePassword(currentPassword: String, newPassword: String, revokeOtherSessions: Bool = true) async throws");
    expect(apiClient).toContain("request(path: \"/api/me/change-password\", method: \"POST\")");
    expect(apiClient).toContain("let revokeOtherSessions: Bool");
    expect(route).toContain("newPassword: z.string().min(8");
    expect(route).toContain("revokeOtherSessions: z.boolean().default(false)");
    expect(route).toContain("New password must be different from the current password.");
  });

  it("exposes App Review privacy, support, and self-service deletion controls", () => {
    const settings = source("ios/Wisconsin/Views/SettingsView.swift");
    const accountDetail = source("ios/Wisconsin/Views/AccountSecuritySettingsView.swift");
    const apiClient = source("ios/Wisconsin/Core/APIClient.swift");
    const route = source("src/app/api/me/account/route.ts");

    expect(settings).toContain("SettingsRow(title: \"Privacy Policy\"");
    expect(settings).toContain("SettingsRow(title: \"Contact Support\"");
    expect(accountDetail).toContain("Button(\"Delete Account\", role: .destructive)");
    expect(accountDetail).toContain("SecureField(\"Current password\"");
    expect(accountDetail).toContain("APIClient.shared.deleteAccount(currentPassword: currentPassword)");
    expect(apiClient).toContain("request(path: \"/api/me/account\", method: \"DELETE\")");
    expect(route).toContain("deactivateUserWithCleanup");
    expect(route).toContain('action: "account_self_deleted"');
  });
});
