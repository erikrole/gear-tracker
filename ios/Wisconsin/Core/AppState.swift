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
    private var isRefreshing = false

    func refresh() async {
        guard !isRefreshing else { return }
        isRefreshing = true
        defer { isRefreshing = false }
        do {
            async let dashTask = APIClient.shared.dashboard()
            async let countTask = APIClient.shared.notificationUnreadCount()
            async let tradesTask = APIClient.shared.shiftTrades(status: "OPEN", limit: 1)
            let (dash, count, trades) = try await (dashTask, countTask, tradesTask)
            overdueCount = dash.overdueCount
            myShiftCount = dash.myShifts.count
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
