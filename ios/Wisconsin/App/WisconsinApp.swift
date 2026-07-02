import SwiftUI
import SwiftData
import UserNotifications

@main
struct WisconsinApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    @State private var session = SessionStore()
    @State private var appState = AppState()
    @State private var network = NetworkMonitor()
    @Environment(\.scenePhase) private var scenePhase
    @AppStorage("WisconsinThemeChoice") private var themeChoice: ThemeChoice = .system

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(session)
                .environment(appState)
                .environment(network)
                .preferredColorScheme(themeChoice.colorScheme)
                .onAppear {
                    sharedAppState = appState
                }
                .onChange(of: session.currentUser) { old, user in
                    if user == nil, old != nil {
                        GearStore.shared.clearAll()
                        Task { await CheckoutReturnLiveActivityManager.shared.endAll() }
                    }
                    // Push permission is now requested via PushPrePromptView,
                    // not as a cold OS alert on login.
                    if user?.forcePasswordChange == false {
                        // If the user previously granted permission, keep the token fresh.
                        Task { await registerForPushIfAuthorized() }
                        Task {
                            await CheckoutReturnLiveActivityManager.shared.reconcileCurrentUserCheckouts(
                                requesterId: user?.id
                            )
                        }
                    }
                }
                .onChange(of: scenePhase) { _, phase in
                    if phase == .active && session.currentUser?.forcePasswordChange == false {
                        // Refresh tab badge state regardless of which tab the user is on.
                        Task {
                            await appState.refresh()
                            await CheckoutReturnLiveActivityManager.shared.reconcileCurrentUserCheckouts(
                                requesterId: session.currentUser?.id
                            )
                        }
                    }
                }
                .onReceive(NotificationCenter.default.publisher(for: UIApplication.didReceiveMemoryWarningNotification)) { _ in
                    Task { @MainActor in
                        ThumbnailCache.shared.evictAll()
                        URLCache.shared.removeAllCachedResponses()
                    }
                }
                .onOpenURL { url in
                    if url.scheme == "wisconsin", url.host == "booking" {
                        let bookingId = url.path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
                        guard !bookingId.isEmpty else { return }
                        appState.pendingPushBookingId = bookingId
                        if URLComponents(url: url, resolvingAgainstBaseURL: false)?
                            .queryItems?
                            .contains(where: { $0.name == "action" && $0.value == "extend" }) == true {
                            appState.pendingExtendBookingId = bookingId
                        }
                    }
                }
                .tint(.brandPrimary)
        }
        .modelContainer(GearStore.shared.container)
    }

    /// Registers for remote notifications if the user has already authorized.
    /// New authorization is collected by `PushPrePromptView` after login.
    private func registerForPushIfAuthorized() async {
        let settings = await UNUserNotificationCenter.current().notificationSettings()
        if settings.authorizationStatus == .authorized {
            await MainActor.run { UIApplication.shared.registerForRemoteNotifications() }
        }
    }
}

struct RootView: View {
    @Environment(SessionStore.self) private var session
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var showPushPrePrompt = false

    var body: some View {
        Group {
            if session.isRestoring {
                Color(.systemBackground).ignoresSafeArea()
            } else if let user = session.currentUser, user.forcePasswordChange {
                PasswordSetupView(email: user.email)
            } else if session.currentUser != nil {
                AppTabView()
            } else {
                LoginView()
                    .overlay(alignment: .top) {
                        if session.isOffline {
                            BannerView(
                                severity: .warning,
                                message: "No connection — check your network",
                                systemImage: "wifi.slash"
                            )
                            .padding(.top, 12)
                        }
                    }
                    .animation(reduceMotion ? nil : .easeInOut, value: session.isOffline)
            }
        }
        .onChange(of: session.currentUser) { old, user in
            // Show the soft push prompt the first time a user lands logged-in,
            // before the OS alert ever fires.
            if let user, !user.forcePasswordChange, old?.forcePasswordChange != false {
                Task { await maybeShowPushPrompt() }
            }
        }
        .sheet(isPresented: $showPushPrePrompt) {
            PushPrePromptView()
                .presentationDetents([.medium])
                .presentationDragIndicator(.visible)
        }
    }

    @MainActor
    private func maybeShowPushPrompt() async {
        // Only ever ask once — if the user dismissed the soft prompt without
        // tapping Enable, respect that decision until they toggle from settings.
        let key = "WisconsinPushSoftPromptShown"
        guard !UserDefaults.standard.bool(forKey: key) else { return }
        let settings = await UNUserNotificationCenter.current().notificationSettings()
        guard settings.authorizationStatus == .notDetermined else { return }
        UserDefaults.standard.set(true, forKey: key)
        // Small delay so it doesn't crash into the LoginView → AppTabView swap.
        try? await Task.sleep(for: .milliseconds(600))
        showPushPrePrompt = true
    }
}
