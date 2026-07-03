import AppIntents
import Foundation

enum GearTrackerAppIntentDestination: String, Sendable {
    case scan
    case myGear
    case todaySchedule
    case createReservation
}

@MainActor
final class GearTrackerAppIntentHandoff {
    static let shared = GearTrackerAppIntentHandoff()

    private var pendingDestination: GearTrackerAppIntentDestination?

    private init() {}

    func request(_ destination: GearTrackerAppIntentDestination) {
        pendingDestination = destination
        sharedAppState?.pendingAppIntentDestination = destination
    }

    func consumePendingDestination() -> GearTrackerAppIntentDestination? {
        let destination = pendingDestination
        pendingDestination = nil
        return destination
    }
}

struct ScanGearCodeIntent: AppIntent {
    static let title: LocalizedStringResource = "Scan Gear Code"
    static let description = IntentDescription("Open the scanner to look up gear, bookings, and item-family unit codes.")
    static let openAppWhenRun = true

    @MainActor
    func perform() async throws -> some IntentResult {
        GearTrackerAppIntentHandoff.shared.request(.scan)
        return .result()
    }
}

struct ShowMyGearIntent: AppIntent {
    static let title: LocalizedStringResource = "Show My Gear"
    static let description = IntentDescription("Open the active bookings and reservations list.")
    static let openAppWhenRun = true

    @MainActor
    func perform() async throws -> some IntentResult {
        GearTrackerAppIntentHandoff.shared.request(.myGear)
        return .result()
    }
}

struct ShowTodayScheduleIntent: AppIntent {
    static let title: LocalizedStringResource = "Show Today's Schedule"
    static let description = IntentDescription("Open the Schedule tab for today's event and shift work.")
    static let openAppWhenRun = true

    @MainActor
    func perform() async throws -> some IntentResult {
        GearTrackerAppIntentHandoff.shared.request(.todaySchedule)
        return .result()
    }
}

struct CreateReservationIntent: AppIntent {
    static let title: LocalizedStringResource = "Create Reservation"
    static let description = IntentDescription("Open the new reservation workflow.")
    static let openAppWhenRun = true

    @MainActor
    func perform() async throws -> some IntentResult {
        GearTrackerAppIntentHandoff.shared.request(.createReservation)
        return .result()
    }
}

struct GearTrackerShortcutsProvider: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: ScanGearCodeIntent(),
            phrases: [
                "Scan gear with \(.applicationName)",
                "Scan a code in \(.applicationName)",
            ],
            shortTitle: "Scan Code",
            systemImageName: "qrcode.viewfinder"
        )

        AppShortcut(
            intent: ShowMyGearIntent(),
            phrases: [
                "Show my gear in \(.applicationName)",
                "Open my gear in \(.applicationName)",
            ],
            shortTitle: "My Gear",
            systemImageName: "calendar.badge.checkmark"
        )

        AppShortcut(
            intent: ShowTodayScheduleIntent(),
            phrases: [
                "Show today's schedule in \(.applicationName)",
                "Open my schedule in \(.applicationName)",
            ],
            shortTitle: "Schedule",
            systemImageName: "calendar"
        )

        AppShortcut(
            intent: CreateReservationIntent(),
            phrases: [
                "Create a reservation in \(.applicationName)",
                "Reserve gear in \(.applicationName)",
            ],
            shortTitle: "Reserve Gear",
            systemImageName: "plus"
        )
    }
}
