import SwiftUI

struct AppTabView: View {
    @Environment(SessionStore.self) private var session
    @Environment(AppState.self) private var appState
    @Environment(NetworkMonitor.self) private var network

    var body: some View {
        ZStack(alignment: .top) {
            TabView {
                HomeView()
                    .tabItem { Label("Home", systemImage: "house") }

                BookingsView()
                    .tabItem { Label("Bookings", systemImage: "calendar.badge.checkmark") }
                    .badge(appState.overdueCount)

                ItemsView()
                    .tabItem { Label("Items", systemImage: "archivebox") }

                ScanView()
                    .tabItem { Label("Scan", systemImage: "barcode.viewfinder") }

                ScheduleView()
                    .tabItem { Label("Schedule", systemImage: "calendar") }
                    .badge(appState.myShiftCount)
            }

            if !network.isConnected {
                BannerView(
                    severity: .warning,
                    message: "No connection — some actions may fail",
                    systemImage: "wifi.slash"
                )
                .padding(.top, 12)
                .zIndex(1)
            }
        }
        .animation(.easeInOut, value: network.isConnected)
    }
}

// MARK: - Profile

struct ProfileView: View {
    @Environment(SessionStore.self) private var session
    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss
    @State private var showSignOutConfirm = false
    @State private var showLinkStickerWizard = false

    private static let manageAccountURL = URL(string: "https://gear.erikrole.com")!

    private var isDevRole: Bool {
        let role = session.currentUser?.role ?? ""
        return role == "ADMIN" || role == "STAFF"
    }

    var body: some View {
        NavigationStack {
            List {
                // Avatar + name header
                Section {
                    HStack(spacing: 14) {
                        AccountAvatar(size: 52)
                        VStack(alignment: .leading, spacing: 3) {
                            Text(session.currentUser?.name ?? "")
                                .font(.headline)
                            Text(session.currentUser?.email ?? "")
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                        }
                    }
                    .padding(.vertical, 4)
                }

                Section("Account") {
                    LabeledContent("Role", value: session.currentUser?.role ?? "")
                    Link(destination: Self.manageAccountURL) {
                        HStack {
                            Text("Manage account on web")
                            Spacer()
                            Image(systemName: "arrow.up.right.square")
                                .foregroundStyle(.tertiary)
                        }
                    }
                }

                Section("Stats") {
                    NavigationLink(value: ProfileDestination.upcomingShifts) {
                        LabeledContent("Upcoming Shifts") {
                            Text("\(appState.myShiftCount)")
                                .foregroundStyle(appState.myShiftCount > 0 ? .primary : .secondary)
                        }
                    }
                    NavigationLink(value: ProfileDestination.overdueBookings) {
                        LabeledContent("Overdue Bookings") {
                            Text("\(appState.overdueCount)")
                                .foregroundStyle(appState.overdueCount > 0 ? .red : .secondary)
                        }
                    }
                }

                if isDevRole {
                    Section("Dev Tools") {
                        Button {
                            showLinkStickerWizard = true
                        } label: {
                            Label("Link Sticker Codes", systemImage: "qrcode.viewfinder")
                        }
                    }
                }

                Section("App") {
                    LabeledContent("Version", value: appVersion)
                }

                Section {
                    Button("Sign Out", role: .destructive) {
                        showSignOutConfirm = true
                    }
                }
            }
            .navigationTitle("Profile")
            .navigationBarTitleDisplayMode(.inline)
            .sheet(isPresented: $showLinkStickerWizard) {
                LinkStickerWizard()
            }
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
            .navigationDestination(for: ProfileDestination.self) { dest in
                ProfileDestinationView(destination: dest)
            }
            .confirmationDialog(
                "Sign out?",
                isPresented: $showSignOutConfirm,
                titleVisibility: .visible
            ) {
                Button("Sign Out", role: .destructive) {
                    Task { await session.logout() }
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("You'll need to sign in again to come back.")
            }
        }
    }

    private var appVersion: String {
        let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "—"
        let build = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "—"
        return "\(version) (\(build))"
    }
}

// MARK: - Profile destinations

enum ProfileDestination: Hashable {
    case upcomingShifts
    case overdueBookings
}

private struct ProfileDestinationView: View {
    let destination: ProfileDestination

    var body: some View {
        // Per-destination jumps stay simple: dismiss profile and let the
        // tab destination take over. The actual filtered views live on the
        // Schedule and Bookings tabs.
        VStack(spacing: 12) {
            Image(systemName: destination == .upcomingShifts ? "calendar" : "calendar.badge.exclamationmark")
                .font(.largeTitle)
                .foregroundStyle(.secondary)
            Text(destination == .upcomingShifts
                ? "Open the Schedule tab to see your shifts."
                : "Open the Bookings tab to see overdue items.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(.systemGroupedBackground))
        .navigationTitle(destination == .upcomingShifts ? "My Shifts" : "Overdue")
        .navigationBarTitleDisplayMode(.inline)
    }
}

// MARK: - Reusable avatar

struct AccountAvatar: View {
    @Environment(SessionStore.self) private var session
    let size: CGFloat

    var body: some View {
        let name = session.currentUser?.name ?? ""
        let parts = name.split(separator: " ")
        let initials = parts.prefix(2).compactMap { $0.first }.map { String($0) }.joined()
        let avatarUrl = session.currentUser?.avatarUrl.flatMap { URL(string: $0) }

        Group {
            if let url = avatarUrl {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let image):
                        image.resizable().scaledToFill()
                    default:
                        initialsCircle(initials)
                    }
                }
                .frame(width: size, height: size)
                .clipShape(Circle())
            } else {
                initialsCircle(initials)
            }
        }
    }

    @ViewBuilder
    private func initialsCircle(_ initials: String) -> some View {
        ZStack {
            Circle()
                .fill(.tint.opacity(0.15))
                .frame(width: size, height: size)
            Text(initials.isEmpty ? "?" : initials)
                .font(size > 40 ? .title3.weight(.semibold) : .footnote.weight(.semibold))
                .foregroundStyle(.tint)
        }
    }
}
