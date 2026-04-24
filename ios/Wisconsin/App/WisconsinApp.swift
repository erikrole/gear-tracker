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
                .tint(Color(UIColor(dynamicProvider: { trait in
                    // Light: #A00000 (dark maroon — readable on white)
                    // Dark: #FF3B30 (system-red luminance — meets 4.5:1 on dark bg per Apple HIG)
                    trait.userInterfaceStyle == .dark
                        ? UIColor(red: 1.0, green: 0.231, blue: 0.188, alpha: 1)
                        : UIColor(red: 0.627, green: 0, blue: 0, alpha: 1)
                })))
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
