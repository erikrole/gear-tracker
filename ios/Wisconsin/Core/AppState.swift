import Foundation

@MainActor
@Observable
final class AppState {
    var overdueCount = 0
    var myShiftCount = 0
    private var isRefreshing = false

    func refresh() async {
        guard !isRefreshing else { return }
        isRefreshing = true
        defer { isRefreshing = false }
        do {
            let dash = try await APIClient.shared.dashboard()
            overdueCount = dash.overdueCount
            myShiftCount = dash.myShifts.count
        } catch {
            // Non-critical — badges stay at last known value
        }
    }
}
