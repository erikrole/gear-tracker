import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function source(relativeFile: string) {
  return readFileSync(path.join(process.cwd(), relativeFile), "utf8");
}

describe("iOS App Intents", () => {
  it("exposes a narrow open-app shortcut surface", () => {
    const intents = source("ios/Wisconsin/App/AppIntents.swift");

    expect(intents).toContain("import AppIntents");
    expect(intents).toContain("struct ScanGearCodeIntent: AppIntent");
    expect(intents).toContain("struct ShowMyGearIntent: AppIntent");
    expect(intents).toContain("struct ShowTodayScheduleIntent: AppIntent");
    expect(intents).toContain("struct CreateReservationIntent: AppIntent");
    expect(intents.match(/static let openAppWhenRun = true/g)).toHaveLength(4);
    expect(intents).toContain("struct GearTrackerShortcutsProvider: AppShortcutsProvider");
    expect(intents).toContain('shortTitle: "Scan Code"');
    expect(intents).toContain('shortTitle: "My Gear"');
    expect(intents).toContain('shortTitle: "Schedule"');
    expect(intents).toContain('shortTitle: "Reserve Gear"');
  });

  it("keeps intent execution as app-opening handoff, not background mutation", () => {
    const intents = source("ios/Wisconsin/App/AppIntents.swift");

    expect(intents).toContain("GearTrackerAppIntentHandoff.shared.request(.scan)");
    expect(intents).toContain("GearTrackerAppIntentHandoff.shared.request(.myGear)");
    expect(intents).toContain("GearTrackerAppIntentHandoff.shared.request(.todaySchedule)");
    expect(intents).toContain("GearTrackerAppIntentHandoff.shared.request(.createReservation)");
    expect(intents).not.toContain("APIClient.shared");
    expect(intents).not.toContain("checkouts(");
    expect(intents).not.toContain("reservations(");
    expect(intents).not.toContain("assignShift");
    expect(intents).not.toContain("complete");
  });

  it("routes intent destinations through one app-state handoff", () => {
    const appState = source("ios/Wisconsin/Core/AppState.swift");
    const appTab = source("ios/Wisconsin/Views/AppTabView.swift");
    const search = source("ios/Wisconsin/Views/Search/GlobalSearchSheet.swift");
    const bookings = source("ios/Wisconsin/Views/BookingsView.swift");

    expect(appState).toContain("var pendingAppIntentDestination: GearTrackerAppIntentDestination?");
    expect(appState).toContain("func consumeAppIntentDestination(_ destination: GearTrackerAppIntentDestination) -> Bool");
    expect(appTab).toContain("GearTrackerAppIntentHandoff.shared.consumePendingDestination()");
    expect(appTab).toContain("case .scan:");
    expect(appTab).toContain('if hasCapability("GEAR_CATALOG_VIEW"), appState.selectedTab != 3 { appState.selectedTab = 3 }');
    expect(appTab).toContain("case .createReservation:");
    expect(appTab).toContain('if hasCapability("RESERVATION_CREATE"), appState.selectedTab != 1 { appState.selectedTab = 1 }');
    expect(search).toContain("if appState.consumeAppIntentDestination(.scan)");
    expect(search).toContain("showScanner = true");
    expect(bookings).toContain("if appState.consumeAppIntentDestination(.createReservation)");
    expect(bookings).toContain("if canCreate { showCreate = true }");
  });
});
