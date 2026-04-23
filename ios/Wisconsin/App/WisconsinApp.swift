import SwiftUI

@main
struct WisconsinApp: App {
    @State private var session = SessionStore()
    @State private var appState = AppState()
    @State private var network = NetworkMonitor()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(session)
                .environment(appState)
                .environment(network)
                .tint(Color(red: 0.627, green: 0, blue: 0)) // Wisconsin #A00000
        }
    }
}

struct RootView: View {
    @Environment(SessionStore.self) private var session

    var body: some View {
        if session.currentUser != nil {
            AppTabView()
        } else {
            LoginView()
                .overlay(alignment: .top) {
                    if session.isOffline {
                        Label("No connection — check your network", systemImage: "wifi.slash")
                            .font(.caption.weight(.medium))
                            .foregroundStyle(.white)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 8)
                            .background(.orange, in: Capsule())
                            .padding(.top, 12)
                            .transition(.move(edge: .top).combined(with: .opacity))
                    }
                }
                .animation(.easeInOut, value: session.isOffline)
        }
    }
}
