import Foundation

@MainActor
@Observable
final class AppState {
    var overdueCount = 0
    var myShiftCount = 0
    var unreadNotifCount = 0
    var openTradeCount = 0
    private var isRefreshing = false

    func refresh() async {
        guard !isRefreshing else { return }
        isRefreshing = true
        defer { isRefreshing = false }
        do {
            async let dashTask = APIClient.shared.dashboard()
            async let notifTask = APIClient.shared.notifications(limit: 1)
            async let tradesTask = APIClient.shared.shiftTrades(status: "OPEN", limit: 1)
            let (dash, notif, trades) = try await (dashTask, notifTask, tradesTask)
            overdueCount = dash.overdueCount
            myShiftCount = dash.myShifts.count
            unreadNotifCount = notif.unreadCount
            openTradeCount = min(trades.total, 9)
        } catch {
            // Non-critical
        }
    }
}
