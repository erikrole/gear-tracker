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
        horizontalSizeClass == .regular && !isCollaborator
    }

    private var isCollaborator: Bool {
        session.currentUser?.role == "COLLABORATOR"
    }

    private func hasCapability(_ capability: String) -> Bool {
        !isCollaborator || (session.currentUser?.capabilities ?? []).contains(capability)
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

            if hasCapability("PUBLISHED_SCHEDULE_VIEW") {
                Tab("Schedule", systemImage: "calendar", value: 4) {
                    ScheduleView()
                }
                    .badge(appState.myShiftTodayCount)
                    .accessibilityLabel(appState.myShiftTodayCount > 0 ? "Schedule, \(appState.myShiftTodayCount) shifts today" : "Schedule")
            }

            if hasCapability("MY_GEAR_VIEW") {
                Tab(gearTabLabel, systemImage: "calendar.badge.checkmark", value: 1) {
                    BookingsView()
                }
                    .badge(appState.overdueCount)
                    .accessibilityLabel(appState.overdueCount > 0 ? "\(gearTabLabel), \(appState.overdueCount) overdue" : gearTabLabel)
            }

            if hasCapability("GEAR_CATALOG_VIEW") || hasCapability("PEOPLE_DIRECTORY_VIEW") {
                Tab("Browse", systemImage: "square.grid.2x2", value: 2) {
                    BrowseView()
                }

            }

            if hasCapability("GEAR_CATALOG_VIEW") {
                Tab("Search", systemImage: "magnifyingglass", value: 3, role: .search) {
                    GlobalSearchSheet(showsCancelButton: false)
                }
                .tabPlacement(.pinned)
            }

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
            routePendingTradePush()
            routePendingBrowsePush()
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
        .onChange(of: appState.pendingPushTradeId) { _, _ in
            routePendingTradePush()
        }
        .onChange(of: appState.pendingBrowseDestination) { _, _ in
            routePendingBrowsePush()
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
        guard hasCapability("PUBLISHED_SCHEDULE_VIEW") else {
            appState.pendingPushEventId = nil
            return
        }
        if appState.selectedTab != 4 {
            appState.selectedTab = 4
        }
    }

    private func routePendingBookingPush() {
        guard appState.pendingPushBookingId != nil else { return }
        guard hasCapability("MY_GEAR_VIEW") else {
            appState.pendingPushBookingId = nil
            return
        }
        if appState.selectedTab != 0 {
            appState.selectedTab = 0
        }
    }

    /// The Trade Board is a sheet owned by Home, so this only has to land the
    /// user on Home; `HomeView` presents the sheet once it sees the pending id.
    private func routePendingTradePush() {
        guard appState.pendingPushTradeId != nil else { return }
        guard hasCapability("PUBLISHED_SCHEDULE_VIEW") else {
            appState.pendingPushTradeId = nil
            return
        }
        if appState.selectedTab != 0 {
            appState.selectedTab = 0
        }
    }

    /// Licenses is its own tab on sidebar layouts but lives inside Browse on
    /// compact ones, so the destination is resolved against the current layout
    /// rather than hard-coded to a tab index.
    private func routePendingBrowsePush() {
        guard let destination = appState.pendingBrowseDestination else { return }
        // Mirror BrowseView's own row gating: collaborators get Items (with the
        // catalog capability) and Users, never Licenses. Routing past that would
        // deep-link a screen the app otherwise hides from them.
        let allowed: Bool = switch destination {
        case .items: hasCapability("GEAR_CATALOG_VIEW")
        case .licenses: !isCollaborator
        }
        guard allowed else {
            appState.pendingBrowseDestination = nil
            return
        }
        if destination == .licenses && showsSidebarDestinations {
            appState.pendingBrowseDestination = nil
            appState.selectedTab = 7
            return
        }
        // Browse consumes `pendingBrowseDestination` and appends the row.
        if appState.selectedTab != 2 {
            appState.selectedTab = 2
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
        let isAllowed: Bool = switch destination {
        case .scan: hasCapability("GEAR_CATALOG_VIEW")
        case .myGear: hasCapability("MY_GEAR_VIEW")
        case .todaySchedule: hasCapability("PUBLISHED_SCHEDULE_VIEW")
        case .createReservation: hasCapability("RESERVATION_CREATE")
        }
        guard isAllowed else {
            appState.pendingAppIntentDestination = nil
            return
        }

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
