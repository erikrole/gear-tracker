import SwiftUI

struct AppTabView: View {
    @Environment(SessionStore.self) private var session
    @Environment(AppState.self) private var appState
    @Environment(NetworkMonitor.self) private var network
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @AppStorage("sidebarTabCustomization") private var tabCustomization: TabViewCustomization

    private var isStaffOrAdmin: Bool {
        let role = session.currentUser?.role ?? ""
        return role == "STAFF" || role == "ADMIN"
    }

    private var gearTabLabel: String {
        isStaffOrAdmin ? "Bookings" : "My Gear"
    }

    private var showsSidebarDestinations: Bool {
        horizontalSizeClass == .regular
    }

    private var selectedTabIsSidebarOnly: Bool {
        appState.selectedTab >= 5
    }

    var body: some View {
        TabView(selection: Binding(
            get: { appState.selectedTab },
            set: { appState.selectTab($0) }
        )) {
            Tab("Home", systemImage: "house", value: 0) {
                HomeView()
            }

            Tab("Schedule", systemImage: "calendar", value: 4) {
                ScheduleView()
            }
                .badge(appState.myShiftTodayCount)
                .accessibilityLabel(appState.myShiftTodayCount > 0 ? "Schedule, \(appState.myShiftTodayCount) shifts today" : "Schedule")

            Tab(gearTabLabel, systemImage: "calendar.badge.checkmark", value: 1) {
                BookingsView()
            }
                .badge(appState.overdueCount)
                .accessibilityLabel(appState.overdueCount > 0 ? "\(gearTabLabel), \(appState.overdueCount) overdue" : gearTabLabel)

            Tab("Browse", systemImage: "square.grid.2x2", value: 2) {
                BrowseView()
            }

            Tab("Search", systemImage: "magnifyingglass", value: 3, role: .search) {
                GlobalSearchSheet(showsCancelButton: false)
            }
            .tabPlacement(.pinned)

            if showsSidebarDestinations {
                TabSection("Resources") {
                    Tab("Guides", systemImage: "book.closed", value: 6) {
                        GuidesView()
                    }
                    .tabPlacement(.sidebarOnly)
                    .customizationID("resources.guides")

                    Tab("Licenses", systemImage: "key", value: 7) {
                        LicensesView()
                    }
                    .tabPlacement(.sidebarOnly)
                    .customizationID("resources.licenses")

                    Tab("Users", systemImage: "person.2", value: 5) {
                        UsersView()
                    }
                    .tabPlacement(.sidebarOnly)
                    .customizationID("resources.users")
                }
                .customizationID("resources")
            }
        }
        .tabViewCustomization($tabCustomization)
        .onChange(of: showsSidebarDestinations) { _, canShowSidebarDestinations in
            if !canShowSidebarDestinations && selectedTabIsSidebarOnly {
                appState.selectedTab = 0
            }
        }
        .onAppear {
            if !showsSidebarDestinations && selectedTabIsSidebarOnly {
                appState.selectedTab = 0
            }
            consumePendingAppIntentHandoff()
            routePendingAppIntent()
            routePendingEventPush()
            routePendingBookingPush()
        }
        .onChange(of: appState.pendingAppIntentDestination) { _, _ in
            routePendingAppIntent()
        }
        .onChange(of: appState.pendingPushEventId) { _, _ in
            routePendingEventPush()
        }
        .onChange(of: appState.pendingPushBookingId) { _, _ in
            routePendingBookingPush()
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
        .modifier(AppTabShellStyle(usesSidebarAdaptableStyle: showsSidebarDestinations))
        .animation(reduceMotion ? nil : .easeInOut, value: network.isConnected)
    }

    private func routePendingEventPush() {
        guard appState.pendingPushEventId != nil else { return }
        if appState.selectedTab != 4 {
            appState.selectedTab = 4
        }
    }

    private func routePendingBookingPush() {
        guard appState.pendingPushBookingId != nil else { return }
        if appState.selectedTab != 0 {
            appState.selectedTab = 0
        }
    }

    private func consumePendingAppIntentHandoff() {
        if let destination = GearTrackerAppIntentHandoff.shared.consumePendingDestination() {
            appState.pendingAppIntentDestination = destination
        }
        if let bookingId = GearTrackerAppIntentHandoff.shared.consumePendingBookingId() {
            appState.pendingPushBookingId = bookingId
        }
    }

    private func routePendingAppIntent() {
        guard let destination = appState.pendingAppIntentDestination else { return }
        switch destination {
        case .scan:
            if appState.selectedTab != 3 { appState.selectedTab = 3 }
        case .myGear:
            if appState.selectedTab != 1 { appState.selectedTab = 1 }
        case .todaySchedule:
            if appState.selectedTab != 4 { appState.selectedTab = 4 }
            appState.pendingAppIntentDestination = nil
        case .createReservation:
            if appState.selectedTab != 1 { appState.selectedTab = 1 }
        }
    }
}

private struct AppTabShellStyle: ViewModifier {
    let usesSidebarAdaptableStyle: Bool

    @ViewBuilder
    func body(content: Content) -> some View {
        if usesSidebarAdaptableStyle {
            content.tabViewStyle(.sidebarAdaptable)
        } else {
            content.tabViewStyle(.tabBarOnly)
        }
    }
}
