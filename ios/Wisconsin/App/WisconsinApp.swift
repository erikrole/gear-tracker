import SwiftUI
import SwiftData
import UserNotifications

@main
struct WisconsinApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    @State private var session = SessionStore()
    @State private var appState = AppState()
    @State private var network = NetworkMonitor()
    @State private var kioskStore = KioskStore()
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(session)
                .environment(appState)
                .environment(network)
                .environment(kioskStore)
                .onAppear {
                    sharedAppState = appState
                    sharedKioskStore = kioskStore
                }
                .onChange(of: session.currentUser) { old, user in
                    if user != nil {
                        requestPushPermissions()
                    } else if old != nil {
                        GearStore.shared.clearAll()
                    }
                }
                .onChange(of: scenePhase) { _, phase in
                    if phase == .active && session.currentUser != nil {
                        Task { await appState.refreshUnread() }
                    }
                }
                .onOpenURL { url in
                    if url.scheme == "wisconsin", url.host == "kiosk" {
                        kioskStore.enterKiosk()
                    }
                }
                .tint(Color(UIColor(dynamicProvider: { trait in
                    // Light: #A00000 (dark maroon — readable on white)
                    // Dark: #FF3B30 (system-red luminance — meets 4.5:1 on dark bg per Apple HIG)
                    trait.userInterfaceStyle == .dark
                        ? UIColor(red: 1.0, green: 0.231, blue: 0.188, alpha: 1)
                        : UIColor(red: 0.627, green: 0, blue: 0, alpha: 1)
                })))
        }
        .modelContainer(GearStore.shared.container)
    }

    private func requestPushPermissions() {
        Task {
            let center = UNUserNotificationCenter.current()
            let settings = await center.notificationSettings()
            guard settings.authorizationStatus == .notDetermined else {
                // Already decided — still register so token stays fresh
                if settings.authorizationStatus == .authorized {
                    await MainActor.run { UIApplication.shared.registerForRemoteNotifications() }
                }
                return
            }
            let granted = (try? await center.requestAuthorization(options: [.alert, .badge, .sound])) ?? false
            if granted {
                await MainActor.run { UIApplication.shared.registerForRemoteNotifications() }
            }
        }
    }
}

struct RootView: View {
    @Environment(SessionStore.self) private var session
    @Environment(KioskStore.self) private var kiosk

    var body: some View {
        if kiosk.isKioskMode {
            KioskShellView()
        } else if session.currentUser != nil {
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
