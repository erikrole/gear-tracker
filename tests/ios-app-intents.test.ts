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
    expect(intents.match(/static let supportedModes: IntentModes = \.foreground\(\.immediate\)/g)).toHaveLength(4);
    expect(intents).not.toContain("openAppWhenRun");
    expect(intents).toContain("struct GearTrackerShortcutsProvider: AppShortcutsProvider");
    expect(intents).toContain('shortTitle: "Scan Code"');
    expect(intents).toContain('shortTitle: "My Gear"');
    expect(intents).toContain('shortTitle: "Schedule"');
    expect(intents).toContain('shortTitle: "Reserve Gear"');
    expect(intents).toContain('shortTitle: "Checked-Out Gear"');
    expect(intents).toContain('shortTitle: "Open Booking"');
    expect(intents).toContain('"Open a booking in \\(.applicationName)"');
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
    expect(appTab).toContain('case .scan: hasCapability("GEAR_CATALOG_VIEW")');
    expect(appTab).toContain("case .createReservation:");
    expect(appTab).toContain('case .createReservation: hasCapability("RESERVATION_CREATE")');
    expect(appTab).toContain("guard isAllowed else {");
    expect(appTab).toContain("appState.pendingAppIntentDestination = nil");
    expect(search).toContain("if appState.consumeAppIntentDestination(.scan)");
    expect(search).toContain("showScanner = true");
    expect(bookings).toContain("if appState.consumeAppIntentDestination(.createReservation)");
    expect(bookings).toContain("if canCreate { showCreate = true }");
  });

  it("protects private data and exposes a structured booking entity", () => {
    const dataIntents = source("ios/Wisconsin/App/AppIntentsData.swift");
    const bookingEntity = source("ios/Wisconsin/App/BookingEntity.swift");

    expect(dataIntents.match(/static let authenticationPolicy: IntentAuthenticationPolicy = \.requiresAuthentication/g)).toHaveLength(2);
    expect(dataIntents).toContain('static let title: LocalizedStringResource = "My Checked-Out Gear"');
    expect(bookingEntity).toContain("struct OpenBookingIntent: OpenIntent");
    expect(bookingEntity).toContain('requestValueDialog: "Which booking?"');
    expect(bookingEntity).toContain("static let authenticationPolicy: IntentAuthenticationPolicy = .requiresAuthentication");
    expect(bookingEntity.match(/@Property\(title:/g)).toHaveLength(4);
    expect(bookingEntity).toContain("catch APIError.notFound");
    expect(bookingEntity).toContain("throw mapIntentError(error)");
  });
});
