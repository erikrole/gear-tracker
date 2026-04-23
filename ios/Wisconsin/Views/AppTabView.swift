import SwiftUI

struct AppTabView: View {
    @Environment(SessionStore.self) private var session
    @Environment(AppState.self) private var appState

    var body: some View {
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
        // Badge counts are fed by HomeView.load() — no separate refresh needed here
    }
}

struct ProfileView: View {
    @Environment(SessionStore.self) private var session

    var body: some View {
        NavigationStack {
            List {
                if let user = session.currentUser {
                    Section {
                        LabeledContent("Name", value: user.name)
                        LabeledContent("Email", value: user.email)
                        LabeledContent("Role", value: user.role)
                    }
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
}
