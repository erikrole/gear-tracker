import Foundation

// Used by AppDelegate to post push destinations without importing SwiftUI
nonisolated(unsafe) var sharedAppState: AppState?

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
}
