import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function source(relativeFile: string) {
  return readFileSync(path.join(process.cwd(), relativeFile), "utf8");
}

describe("iOS App Intents safe navigation", () => {
  it("exposes only safe open-app shortcuts for the first App Intents slice", () => {
    const appState = source("ios/Wisconsin/Core/AppState.swift");

    expect(appState).toContain("import AppIntents");
    expect(appState).toContain("struct OpenScanIntent: AppIntent");
    expect(appState).toContain("struct ShowMyGearIntent: AppIntent");
    expect(appState).toContain("struct ShowTodayShiftIntent: AppIntent");
    expect(appState).toContain("static let openAppWhenRun = true");
    expect(appState).toContain("struct GearTrackerShortcuts: AppShortcutsProvider");
    expect(appState).toContain("\"Open Scan in \\(.applicationName)\"");
    expect(appState).toContain("\"Show My Gear in \\(.applicationName)\"");
    expect(appState).toContain("\"Show Today's Shift in \\(.applicationName)\"");
  });

  it("routes intents through AppState without adding custody mutations", () => {
    const appState = source("ios/Wisconsin/Core/AppState.swift");
    const appTab = source("ios/Wisconsin/Views/AppTabView.swift").split("// MARK: - Profile")[0];

    expect(appState).toContain("pendingAppIntentDestination");
    expect(appState).toContain("WisconsinPendingAppIntentDestination");
    expect(appTab).toContain("routePendingAppIntent()");
    expect(appTab).toContain("appState.pendingBookingsTab = bookingsTab");
    expect(appTab).toContain("appState.selectedTab = destination.tabIndex");
    expect(appState).not.toContain("completeCheckout");
    expect(appState).not.toContain("completeCheckin");
    expect(appState).not.toContain("confirmKiosk");
  });

  it("links the AppIntents framework from the XcodeGen source of truth", () => {
    const project = source("ios/project.yml");

    expect(project).toContain("- sdk: AppIntents.framework");
    expect(project).toContain("embed: false");
  });
});
