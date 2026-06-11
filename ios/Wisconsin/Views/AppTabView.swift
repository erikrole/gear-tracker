import SwiftUI

struct AppTabView: View {
    @Environment(SessionStore.self) private var session
    @Environment(AppState.self) private var appState
    @Environment(NetworkMonitor.self) private var network
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private var isStaffOrAdmin: Bool {
        let role = session.currentUser?.role ?? ""
        return role == "STAFF" || role == "ADMIN"
    }

    private var gearTabLabel: String {
        isStaffOrAdmin ? "Bookings" : "My Gear"
    }

    var body: some View {
        TabView(selection: Binding(
            get: { appState.selectedTab },
            set: { appState.selectTab($0) }
        )) {
            HomeView()
                .tabItem { Label("Home", systemImage: "house") }
                .tag(0)

            BookingsView()
                .tabItem { Label(gearTabLabel, systemImage: "calendar.badge.checkmark") }
                .tag(1)
                .badge(appState.overdueCount)
                .accessibilityLabel(appState.overdueCount > 0 ? "\(gearTabLabel), \(appState.overdueCount) overdue" : gearTabLabel)

            ItemsView()
                .tabItem { Label("Items", systemImage: "archivebox") }
                .tag(2)

            ScanView()
                .tabItem { Label("Scan", systemImage: "barcode.viewfinder") }
                .tag(3)

            ScheduleView()
                .tabItem { Label("Schedule", systemImage: "calendar") }
                .tag(4)
                .badge(appState.myShiftCount)
                .accessibilityLabel(appState.myShiftCount > 0 ? "Schedule, \(appState.myShiftCount) upcoming shifts" : "Schedule")

            if isStaffOrAdmin {
                UsersView()
                    .tabItem { Label("Users", systemImage: "person.2") }
                    .tag(5)
            }
        }
        .onChange(of: isStaffOrAdmin) { _, canSeeUsers in
            if !canSeeUsers && appState.selectedTab == 5 {
                appState.selectedTab = 0
            }
        }
        .onAppear {
            routePendingEventPush()
        }
        .onChange(of: appState.pendingPushEventId) { _, _ in
            routePendingEventPush()
        }
        .safeAreaInset(edge: .top, spacing: 0) {
            if !network.isConnected {
                BannerView(
                    severity: .warning,
                    message: "No connection — some actions may fail",
                    systemImage: "wifi.slash"
                )
                .transition(.move(edge: .top).combined(with: .opacity))
            }
        }
        .animation(reduceMotion ? nil : .easeInOut, value: network.isConnected)
    }

    private func routePendingEventPush() {
        guard appState.pendingPushEventId != nil else { return }
        if appState.selectedTab != 4 {
            appState.selectedTab = 4
        }
    }
}
