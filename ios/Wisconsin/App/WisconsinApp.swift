import SwiftUI
import SwiftData
import UserNotifications

@main
struct WisconsinApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    @State private var session = SessionStore()
    @State private var profileCompletion = ProfileCompletionStore()
    @State private var appState = AppState()
    @State private var network = NetworkMonitor()
    @Environment(\.scenePhase) private var scenePhase
    @AppStorage("WisconsinThemeChoice") private var themeChoice: ThemeChoice = .system

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(session)
                .environment(profileCompletion)
                .environment(appState)
                .environment(network)
                .preferredColorScheme(themeChoice.colorScheme)
                .onAppear {
                    sharedAppState = appState
                }
                .onChange(of: session.currentUser, initial: true) { old, user in
                    handleCurrentUserChange(from: old, to: user)
                }
                .onChange(of: scenePhase) { _, phase in
                    handleScenePhaseChange(phase)
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

    private func handleCurrentUserChange(from oldUser: CurrentUser?, to user: CurrentUser?) {
        if user == nil, oldUser != nil {
            GearStore.shared.clearAll()
            profileCompletion.resetSession()
            Task { await CheckoutReturnLiveActivityManager.shared.endAll() }

            // Sign-out already revokes the token server-side (SessionStore.logout).
            // Drop the local copy too, or Notification Settings offers "Send Test
            // Notification" against a token the server has marked revoked, and
            // reports this device as registered, until re-registration lands.
            UserDefaults.standard.removeObject(forKey: PushTokenStorage.currentTokenKey)
            // Clears the icon badge as well, so the next person to sign in on a
            // shared device doesn't inherit the previous user's unread count.
            appState.clearNotificationState()
            // Delivered banners can name gear and bookings the next user has no
            // business seeing on the lock screen.
            UNUserNotificationCenter.current().removeAllDeliveredNotifications()
        }

        // Push permission is now requested via PushPrePromptView, not as a
        // cold OS alert on login. Home owns the first checkout reconciliation
        // after its useful payload arrives.
        guard user?.forcePasswordChange == false else { return }
        Task { await registerForPushIfAuthorized() }
    }

    private func handleScenePhaseChange(_ phase: ScenePhase) {
        guard phase == .active else { return }
        Task { await AppDelegate.pruneStaleDeliveredNotifications() }

        guard session.currentUser?.forcePasswordChange == false,
              !session.isInitialSessionValidationInFlight else {
            return
        }
        Task { await refreshForegroundState() }
    }

    private func refreshForegroundState() async {
        await session.refreshCurrentUser()
        guard let user = session.currentUser, !user.forcePasswordChange else { return }

        async let badgeRefresh: Void = appState.refresh()
        async let profileRefresh: Void = profileCompletion.load(for: user, force: true)
        await CheckoutReturnLiveActivityManager.shared.prepareRemoteStartRegistration()
        await CheckoutReturnLiveActivityManager.shared.reconcileCurrentUserCheckouts(requesterId: user.id)
        await badgeRefresh
        await profileRefresh
    }

    /// Registers for remote notifications if the user has already authorized.
    /// New authorization is collected by `PushPrePromptView` after login.
    private func registerForPushIfAuthorized() async {
        let settings = await UNUserNotificationCenter.current().notificationSettings()
        switch settings.authorizationStatus {
        case .authorized, .provisional, .ephemeral:
            await MainActor.run { appState.requestRemoteNotificationRegistration() }
        default:
            await MainActor.run { appState.pushRegistrationState = .unknown }
        }
    }
}

struct RootView: View {
    @Environment(SessionStore.self) private var session
    @Environment(ProfileCompletionStore.self) private var profileCompletion
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var showPushPrePrompt = false

    var body: some View {
        Group {
            if session.isRestoring {
                LaunchView()
            } else if let user = session.currentUser, user.forcePasswordChange {
                PasswordSetupView(email: user.email)
            } else if let user = session.currentUser {
                switch profileCompletion.route(
                    for: user,
                    optimisticSession: session.usedOptimisticSessionSnapshot
                ) {
                case .welcome:
                    ProfileCompletionWelcomeView()
                case .app:
                    AppTabView()
                }
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
        .animation(reduceMotion ? nil : .easeInOut(duration: 0.25), value: session.isRestoring)
        .task(id: session.currentUser?.id) {
            guard let user = session.currentUser, !user.forcePasswordChange else { return }
            await profileCompletion.load(for: user)
        }
        .onChange(of: profileCompletion.pushPromptEligibleUserId, initial: true) { _, userId in
            guard let userId, session.currentUser?.id == userId else { return }
            Task { await maybeShowPushPrompt(for: userId) }
        }
        .sheet(isPresented: $showPushPrePrompt) {
            PushPrePromptView()
                .presentationDetents([.fraction(0.62), .large])
                .presentationDragIndicator(.visible)
        }
    }

    @MainActor
    private func maybeShowPushPrompt(for userId: String) async {
        // Only ever ask once — if the user dismissed the soft prompt without
        // tapping Enable, respect that decision until they toggle from settings.
        //
        // Keyed per user, not per device: these iPads get shared, and a
        // device-wide flag meant whoever signed in second never saw the prompt
        // and had no path to push except digging through iOS Settings.
        let key = "WisconsinPushSoftPromptShown.\(userId)"
        guard !UserDefaults.standard.bool(forKey: key) else { return }
        let settings = await UNUserNotificationCenter.current().notificationSettings()
        guard settings.authorizationStatus == .notDetermined else { return }
        UserDefaults.standard.set(true, forKey: key)
        // Small delay so it doesn't crash into the LoginView → AppTabView swap.
        try? await Task.sleep(for: .milliseconds(600))
        showPushPrePrompt = true
    }
}
