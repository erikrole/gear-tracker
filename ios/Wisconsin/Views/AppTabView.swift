import SwiftUI

struct AppTabView: View {
    @Environment(SessionStore.self) private var session
    @Environment(AppState.self) private var appState
    @Environment(NetworkMonitor.self) private var network
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass

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

            Tab(gearTabLabel, systemImage: "calendar.badge.checkmark", value: 1) {
                BookingsView()
            }
                .badge(appState.overdueCount)
                .accessibilityLabel(appState.overdueCount > 0 ? "\(gearTabLabel), \(appState.overdueCount) overdue" : gearTabLabel)

            Tab("Items", systemImage: "archivebox", value: 2) {
                ItemsView()
            }

            Tab("Schedule", systemImage: "calendar", value: 4) {
                ScheduleView()
            }
                .badge(appState.myShiftCount)
                .accessibilityLabel(appState.myShiftCount > 0 ? "Schedule, \(appState.myShiftCount) upcoming shifts" : "Schedule")

            Tab("Scan", systemImage: "barcode.viewfinder", value: 3, role: .search) {
                ScanView()
            }
            .tabPlacement(.pinned)

            if showsSidebarDestinations {
                TabSection("Resources") {
                    Tab("Guides", systemImage: "book.closed", value: 6) {
                        SidebarWebDestinationView(
                            title: "Guides",
                            systemImage: "book.closed",
                            description: "Reference docs, checklists, contacts, venue notes, and team workflows.",
                            destination: URL(string: "https://gear.erikrole.com/resources")!
                        )
                    }
                    .tabPlacement(.sidebarOnly)
                }

                if isStaffOrAdmin {
                    TabSection("Admin") {
                        Tab("Users", systemImage: "person.2", value: 5) {
                            UsersView()
                        }
                        .tabPlacement(.sidebarOnly)

                        Tab("Licenses", systemImage: "key", value: 7) {
                            SidebarWebDestinationView(
                                title: "Licenses",
                                systemImage: "key",
                                description: "Manage software license codes, active claims, renewals, and open slots.",
                                destination: URL(string: "https://gear.erikrole.com/licenses")!
                            )
                        }
                        .tabPlacement(.sidebarOnly)
                    }
                }
            }
        }
        .onChange(of: isStaffOrAdmin) { _, canSeeUsers in
            if !canSeeUsers && appState.selectedTab == 5 {
                appState.selectedTab = 0
            }
        }
        .onChange(of: showsSidebarDestinations) { _, canShowSidebarDestinations in
            if !canShowSidebarDestinations && selectedTabIsSidebarOnly {
                appState.selectedTab = 0
            }
        }
        .onAppear {
            if !showsSidebarDestinations && selectedTabIsSidebarOnly {
                appState.selectedTab = 0
            }
            routePendingEventPush()
            routePendingBookingPush()
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
