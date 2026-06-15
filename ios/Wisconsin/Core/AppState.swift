import Foundation
import AppIntents

// Used by AppDelegate to post push destinations without importing SwiftUI
nonisolated(unsafe) var sharedAppState: AppState?

enum GearTrackerAppIntentDestination: String {
    case myGear
    case scan
    case schedule

    var tabIndex: Int {
        switch self {
        case .myGear:
            1
        case .scan:
            3
        case .schedule:
            4
        }
    }

    var bookingsTab: String? {
        switch self {
        case .myGear:
            "Checkouts"
        case .scan, .schedule:
            nil
        }
    }
}

@MainActor
enum GearTrackerAppIntentHandoff {
    private static let defaultsKey = "WisconsinPendingAppIntentDestination"

    static func request(_ destination: GearTrackerAppIntentDestination) {
        UserDefaults.standard.set(destination.rawValue, forKey: defaultsKey)
        sharedAppState?.pendingAppIntentDestination = destination
    }

    static func consumePendingDestination() -> GearTrackerAppIntentDestination? {
        guard let raw = UserDefaults.standard.string(forKey: defaultsKey),
              let destination = GearTrackerAppIntentDestination(rawValue: raw) else {
            return nil
        }
        UserDefaults.standard.removeObject(forKey: defaultsKey)
        return destination
    }
}

struct OpenScanIntent: AppIntent {
    static let title: LocalizedStringResource = "Open Scan"
    static let description = IntentDescription("Open Gear Tracker to the scan lookup.")
    static let openAppWhenRun = true

    func perform() async throws -> some IntentResult {
        await GearTrackerAppIntentHandoff.request(.scan)
        return .result()
    }
}

struct ShowMyGearIntent: AppIntent {
    static let title: LocalizedStringResource = "Show My Gear"
    static let description = IntentDescription("Open Gear Tracker to active gear and bookings.")
    static let openAppWhenRun = true

    func perform() async throws -> some IntentResult {
        await GearTrackerAppIntentHandoff.request(.myGear)
        return .result()
    }
}

struct ShowTodayShiftIntent: AppIntent {
    static let title: LocalizedStringResource = "Show Today's Shift"
    static let description = IntentDescription("Open Gear Tracker to the schedule.")
    static let openAppWhenRun = true

    func perform() async throws -> some IntentResult {
        await GearTrackerAppIntentHandoff.request(.schedule)
        return .result()
    }
}

struct GearTrackerShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: OpenScanIntent(),
            phrases: [
                "Open Scan in \(.applicationName)",
                "Scan gear with \(.applicationName)",
            ],
            shortTitle: "Open Scan",
            systemImageName: "barcode.viewfinder"
        )

        AppShortcut(
            intent: ShowMyGearIntent(),
            phrases: [
                "Show My Gear in \(.applicationName)",
                "Open My Gear in \(.applicationName)",
            ],
            shortTitle: "My Gear",
            systemImageName: "calendar.badge.checkmark"
        )

        AppShortcut(
            intent: ShowTodayShiftIntent(),
            phrases: [
                "Show Today's Shift in \(.applicationName)",
                "Open Schedule in \(.applicationName)",
            ],
            shortTitle: "Today's Shift",
            systemImageName: "calendar"
        )
    }
}

@MainActor
@Observable
final class AppState {
    var overdueCount = 0
    var myShiftCount = 0
    var unreadNotifCount = 0
    var openTradeCount = 0
    var pendingPushBookingId: String?
    var pendingPushEventId: String?
    var selectedTab: Int = 0
    var resetTab: Int?
    var tabResetToken = 0
    var pendingAppIntentDestination: GearTrackerAppIntentDestination?
    /// Requests the Bookings tab open on a specific sub-tab (e.g. the dashboard
    /// "Overdue" tile deep-links into Checkouts). BookingsView consumes and
    /// clears it. Raw value matches `BookingTab` ("Reservations"/"Checkouts").
    var pendingBookingsTab: String?
    private var isRefreshing = false
    private var lastRefreshAttemptAt: Date?
    private let minimumRefreshInterval: TimeInterval = 60

    func selectTab(_ tab: Int) {
        if selectedTab == tab {
            resetTab = tab
            tabResetToken += 1
        } else {
            selectedTab = tab
        }
    }

    func refresh(forceRefresh: Bool = false) async {
        guard !isRefreshing else { return }
        if !forceRefresh,
           let lastRefreshAttemptAt,
           Date().timeIntervalSince(lastRefreshAttemptAt) < minimumRefreshInterval {
            return
        }
        isRefreshing = true
        lastRefreshAttemptAt = Date()
        defer { isRefreshing = false }
        do {
            // Use the lightweight stats endpoint instead of the full dashboard payload —
            // we only need overdueCount and myShiftsCount here.
            async let statsTask = APIClient.shared.dashboardStats()
            async let countTask = APIClient.shared.notificationUnreadCount()
            async let tradesTask = APIClient.shared.shiftTrades(status: "OPEN", limit: 1)
            let (stats, count, trades) = try await (statsTask, countTask, tradesTask)
            overdueCount = stats.overdueCount
            myShiftCount = stats.myShiftsCount
            unreadNotifCount = count
            openTradeCount = min(trades.total, 9)
        } catch {
            // Non-critical
        }
    }

    func refreshUnread() async {
        do {
            unreadNotifCount = try await APIClient.shared.notificationUnreadCount()
        } catch {}
    }

    func consumePendingAppIntentDestination() {
        if let destination = GearTrackerAppIntentHandoff.consumePendingDestination() {
            pendingAppIntentDestination = destination
        }
    }
}
