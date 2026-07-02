import Foundation
import os

private let appStatePerformanceLog = Logger(subsystem: "com.erikrole.Wisconsin", category: "Launch")

private func elapsedMilliseconds(since start: Date) -> Int {
    Int(Date().timeIntervalSince(start) * 1_000)
}

// Used by AppDelegate to post push destinations without importing SwiftUI
nonisolated(unsafe) var sharedAppState: AppState?

@MainActor
@Observable
final class AppState {
    var overdueCount = 0
    var myShiftCount = 0
    var myShiftTodayCount = 0
    var unreadNotifCount = 0
    var openTradeCount = 0
    var pendingPushBookingId: String?
    var pendingExtendBookingId: String?
    var pendingPushEventId: String?
    var selectedTab: Int = 0
    var resetTab: Int?
    var tabResetToken = 0
    /// Dashboard hint for landing Bookings on a specific scope (raw
    /// `BookingScope` value). Set by stat-tile taps (Overdue / Due Today land
    /// on Attention); consumed and cleared by BookingsView.
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
            openTradeCount = min(trades.total, 9)
            appStatePerformanceLog.info("launch.appState.refresh result=success durationMs=\(elapsedMilliseconds(since: startedAt), privacy: .public) overdue=\(self.overdueCount, privacy: .public) shifts=\(self.myShiftCount, privacy: .public) shiftsToday=\(self.myShiftTodayCount, privacy: .public) unread=\(self.unreadNotifCount, privacy: .public) openTrades=\(self.openTradeCount, privacy: .public)")
        } catch {
            // Non-critical
            appStatePerformanceLog.error("launch.appState.refresh result=failure durationMs=\(elapsedMilliseconds(since: startedAt), privacy: .public)")
        }
    }

    func refreshUnread() async {
        do {
            unreadNotifCount = try await APIClient.shared.notificationUnreadCount()
        } catch {}
    }
}
