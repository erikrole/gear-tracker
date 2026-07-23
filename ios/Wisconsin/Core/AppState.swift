import Foundation
import os
import UIKit
import UserNotifications

private let appStatePerformanceLog = Logger(subsystem: "com.erikrole.Wisconsin", category: "Launch")

private func elapsedMilliseconds(since start: Date) -> Int {
    Int(Date().timeIntervalSince(start) * 1_000)
}

// Used by AppDelegate to post push destinations without importing SwiftUI
nonisolated(unsafe) var sharedAppState: AppState?

enum PushRegistrationState: Equatable {
    case unknown
    case registering
    case registered
    case failed
}

@MainActor
@Observable
final class AppState {
    var overdueCount = 0
    var myShiftCount = 0
    var myShiftTodayCount = 0
    var unreadNotifCount = 0
    var openTradeCount = 0
    /// Gear the signed-in user currently has out. Drives the app icon badge.
    var activeCheckoutCount = 0
    var pendingPushBookingId: String?
    var pendingExtendBookingId: String?
    var pendingPushEventId: String?
    /// Set when a trade push is tapped. Routed to Home, which owns the Trade
    /// Board sheet. The id itself is unused for now — the board has no
    /// per-trade detail route — but it is carried so a future one can use it.
    var pendingPushTradeId: String?
    /// Browse sub-destination requested by a push whose payload only carries an
    /// `href` (license expiry, firmware releases).
    var pendingBrowseDestination: BrowseRouteDestination?
    /// Server-registration truth, kept separate from iOS authorization state.
    /// `.registered` means the APNs token was accepted by `/api/devices`; it
    /// does not claim that a later push reached the device.
    var pushRegistrationState: PushRegistrationState = .unknown
    var pendingAppIntentDestination: GearTrackerAppIntentDestination?
    var selectedTab: Int = 0
    var resetTab: Int?
    var tabResetToken = 0
    /// Dashboard hint for landing Bookings on a specific scope (raw
    /// `BookingScope` value). Set by stat-tile taps (Overdue / Due Today land
    /// on All); consumed and cleared by BookingsView.
    var pendingBookingsScope: String?
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

    func presentSearch() {
        selectTab(3)
    }

    func presentScanLookup() {
        presentSearch()
    }

    func requestRemoteNotificationRegistration() {
        pushRegistrationState = .registering
        UIApplication.shared.registerForRemoteNotifications()
    }

    func consumeAppIntentDestination(_ destination: GearTrackerAppIntentDestination) -> Bool {
        guard pendingAppIntentDestination == destination else { return false }
        pendingAppIntentDestination = nil
        return true
    }

    func refresh(forceRefresh: Bool = false) async {
        let startedAt = Date()
        guard !isRefreshing else {
            appStatePerformanceLog.debug("launch.appState.refresh result=skipped reason=inFlight durationMs=\(elapsedMilliseconds(since: startedAt), privacy: .public)")
            return
        }
        if !forceRefresh,
           let lastRefreshAttemptAt,
           Date().timeIntervalSince(lastRefreshAttemptAt) < minimumRefreshInterval {
            let ageSeconds = Int(Date().timeIntervalSince(lastRefreshAttemptAt))
            appStatePerformanceLog.debug("launch.appState.refresh result=skipped reason=fresh ageSeconds=\(ageSeconds, privacy: .public) durationMs=\(elapsedMilliseconds(since: startedAt), privacy: .public)")
            return
        }
        isRefreshing = true
        lastRefreshAttemptAt = Date()
        defer { isRefreshing = false }
        async let shiftGlanceRefresh: Void = ShiftGlanceSnapshotCoordinator.shared.refresh()
        do {
            // Use the lightweight stats endpoint instead of the full dashboard payload.
            async let statsTask = APIClient.shared.dashboardStats()
            async let countTask = APIClient.shared.notificationUnreadCount()
            async let tradesTask = APIClient.shared.shiftTrades(status: "OPEN", limit: 1)
            let (stats, count, trades) = try await (statsTask, countTask, tradesTask)
            overdueCount = stats.overdueCount
            myShiftCount = stats.myShiftsCount
            myShiftTodayCount = stats.myShiftsTodayCount ?? 0
            unreadNotifCount = count
            activeCheckoutCount = stats.myCheckoutsTotal ?? 0
            syncApplicationBadge()
            openTradeCount = min(trades.total, 9)
            appStatePerformanceLog.info("launch.appState.refresh result=success durationMs=\(elapsedMilliseconds(since: startedAt), privacy: .public) overdue=\(self.overdueCount, privacy: .public) shifts=\(self.myShiftCount, privacy: .public) shiftsToday=\(self.myShiftTodayCount, privacy: .public) unread=\(self.unreadNotifCount, privacy: .public) openTrades=\(self.openTradeCount, privacy: .public)")
        } catch {
            // Non-critical
            appStatePerformanceLog.error("launch.appState.refresh result=failure durationMs=\(elapsedMilliseconds(since: startedAt), privacy: .public)")
        }
        await shiftGlanceRefresh
    }

    func refreshUnread() async {
        do {
            unreadNotifCount = try await APIClient.shared.notificationUnreadCount()
        } catch {}
    }

    /// Mirrors the user's open checkout count onto the app icon.
    ///
    /// The server stamps the same count on every push, which keeps the icon
    /// correct while the app is closed. This is the other half: once gear comes
    /// back, the icon has to come down on its own. Check-in and checkout both
    /// run through the kiosk rather than this app, so the number is re-read on
    /// every foreground rather than driven by a local mutation.
    func syncApplicationBadge() {
        let count = max(0, activeCheckoutCount)
        Task {
            do {
                try await UNUserNotificationCenter.current().setBadgeCount(count)
            } catch {
                // Badge updates are cosmetic; a failure must not surface to the user.
                appStatePerformanceLog.error("appState.badge.sync result=failure count=\(count, privacy: .public)")
            }
        }
    }

    /// Zeroes the icon badge and the counters behind it. Called on sign-out so
    /// the next user does not inherit the previous one's checked-out gear.
    func clearNotificationState() {
        unreadNotifCount = 0
        activeCheckoutCount = 0
        pendingPushBookingId = nil
        pendingExtendBookingId = nil
        pendingPushEventId = nil
        pendingPushTradeId = nil
        pendingBrowseDestination = nil
        pushRegistrationState = .unknown
        syncApplicationBadge()
    }
}
