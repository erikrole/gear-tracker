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
                    .badge(appState.overdueCount > 0 ? appState.overdueCount : 0)

                ItemsView()
                    .tabItem { Label("Items", systemImage: "archivebox") }

                ScheduleView()
                    .tabItem { Label("Schedule", systemImage: "calendar") }
                    .badge(appState.myShiftCount > 0 ? appState.myShiftCount : 0)

                ProfileView()
                    .tabItem { Label("Profile", systemImage: "person.circle") }
            }

            if !network.isConnected {
                Label("No connection", systemImage: "wifi.slash")
                    .font(.caption.weight(.medium))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(.orange, in: Capsule())
                    .padding(.top, 12)
                    .transition(.move(edge: .top).combined(with: .opacity))
                    .zIndex(1)
            }
        }
        .animation(.easeInOut, value: network.isConnected)
    }
}

struct ProfileView: View {
    @Environment(SessionStore.self) private var session
    @Environment(AppState.self) private var appState

    var body: some View {
        NavigationStack {
            List {
                // Avatar + name header
                Section {
                    HStack(spacing: 14) {
                        initialsAvatar
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
                }

                Section("Stats") {
                    LabeledContent("Upcoming Shifts") {
                        Text("\(appState.myShiftCount)")
                            .foregroundStyle(appState.myShiftCount > 0 ? .primary : .secondary)
                    }
                    LabeledContent("Overdue Bookings") {
                        Text("\(appState.overdueCount)")
                            .foregroundStyle(appState.overdueCount > 0 ? .red : .secondary)
                    }
                }

                Section("App") {
                    LabeledContent("Version", value: appVersion)
                }

                Section {
                    Button("Sign Out", role: .destructive) {
                        Task { await session.logout() }
                    }
                }
            }
            .navigationTitle("Profile")
        }
    }

    private var initialsAvatar: some View {
        let name = session.currentUser?.name ?? ""
        let parts = name.split(separator: " ")
        let initials = parts.prefix(2).compactMap { $0.first }.map { String($0) }.joined()
        let avatarUrl = session.currentUser?.avatarUrl.flatMap { URL(string: $0) }

        return Group {
            if let url = avatarUrl {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let image):
                        image.resizable().scaledToFill()
                    default:
                        initialsCircle(initials)
                    }
                }
                .frame(width: 52, height: 52)
                .clipShape(Circle())
            } else {
                initialsCircle(initials)
            }
        }
    }

    private func initialsCircle(_ initials: String) -> some View {
        ZStack {
            Circle()
                .fill(.tint.opacity(0.15))
                .frame(width: 52, height: 52)
            Text(initials.isEmpty ? "?" : initials)
                .font(.title3.weight(.semibold))
                .foregroundStyle(.tint)
        }
    }

    private var appVersion: String {
        let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "—"
        let build = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "—"
        return "\(version) (\(build))"
    }
}
