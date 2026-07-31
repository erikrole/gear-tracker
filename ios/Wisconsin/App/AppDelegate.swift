import UIKit
import UserNotifications

enum PushTokenStorage {
    static let currentTokenKey = "WisconsinCurrentAPNsToken"
    private static let registrationAllowedKey = "WisconsinAPNsRegistrationAllowed"

    static var registrationAllowed: Bool {
        get { UserDefaults.standard.bool(forKey: registrationAllowedKey) }
        set { UserDefaults.standard.set(newValue, forKey: registrationAllowedKey) }
    }
}

@MainActor
class AppDelegate: NSObject, UIApplicationDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        return true
    }

    func application(_ application: UIApplication, supportedInterfaceOrientationsFor window: UIWindow?) -> UIInterfaceOrientationMask {
        return .all
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        guard PushTokenStorage.registrationAllowed else { return }
        let hex = deviceToken.map { String(format: "%02x", $0) }.joined()
        UserDefaults.standard.set(hex, forKey: PushTokenStorage.currentTokenKey)
        Task { @MainActor in
            let mutation = pushCredentialMutations.enqueue {
                guard PushTokenStorage.registrationAllowed else { return }
                do {
                    try await APIClient.shared.registerDeviceToken(hex)
                    guard PushTokenStorage.registrationAllowed else { return }
                    sharedAppState?.pushRegistrationState = .registered
                } catch {
                    guard PushTokenStorage.registrationAllowed else { return }
                    sharedAppState?.pushRegistrationState = .failed
                    print("[APNS] Device token registration failed: \(error.localizedDescription)")
                }
            }
            await mutation.value
        }
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        guard PushTokenStorage.registrationAllowed else { return }
        sharedAppState?.pushRegistrationState = .failed
        print("[APNS] Registration failed: \(error.localizedDescription)")
    }

    /// Delivered banners sit in the system Notification Center forever unless
    /// something removes them — APNs has no built-in expiry for already-shown
    /// notifications. Called on every foreground so stale booking/trade
    /// alerts don't pile up indefinitely once their content is no longer
    /// relevant.
    static let staleDeliveredNotificationAge: TimeInterval = 24 * 60 * 60

    static func pruneStaleDeliveredNotifications() async {
        let center = UNUserNotificationCenter.current()
        let delivered = await center.deliveredNotifications()
        let staleIds = delivered
            .filter { Date().timeIntervalSince($0.date) > staleDeliveredNotificationAge }
            .map(\.request.identifier)
        guard !staleIds.isEmpty else { return }
        center.removeDeliveredNotifications(withIdentifiers: staleIds)
    }

    /// Prevents a delayed APNs callback from re-registering a token after the
    /// authenticated session ends, and removes notification content that may
    /// identify the previous user.
    @MainActor
    static func clearRemoteNotificationsForSignedOutUser() {
        PushTokenStorage.registrationAllowed = false
        UserDefaults.standard.removeObject(forKey: PushTokenStorage.currentTokenKey)
        UIApplication.shared.unregisterForRemoteNotifications()

        let center = UNUserNotificationCenter.current()
        center.removeAllDeliveredNotifications()
        center.removeAllPendingNotificationRequests()
        Task { try? await center.setBadgeCount(0) }
        sharedAppState?.pushRegistrationState = .unknown
    }
}

// UNUserNotificationCenterDelegate's methods aren't @MainActor in their
// protocol declaration, but UNUserNotificationCenter always calls its
// delegate on the main thread in practice. @preconcurrency tells the
// compiler to trust that instead of requiring a nonisolated conformance.
extension AppDelegate: @preconcurrency UNUserNotificationCenterDelegate {
    // Show banner + sound when notification arrives in foreground
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        guard PushTokenStorage.registrationAllowed else {
            completionHandler([])
            return
        }
        completionHandler([.banner, .sound, .badge])
    }

    // User tapped notification (foreground or background)
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        guard PushTokenStorage.registrationAllowed else {
            completionHandler()
            return
        }
        let notificationBoundary = authSessionBoundary.capture()
        let userInfo = response.notification.request.content.userInfo
        if let blastId = userInfo["blastId"] as? String {
            Task { @MainActor in
                guard PushTokenStorage.registrationAllowed,
                      authSessionBoundary.owns(notificationBoundary) else { return }
                sharedAppState?.pendingPushBlastId = blastId
            }
        } else if let bookingId = userInfo["bookingId"] as? String {
            Task { @MainActor in
                guard PushTokenStorage.registrationAllowed,
                      authSessionBoundary.owns(notificationBoundary) else { return }
                sharedAppState?.pendingPushBookingId = bookingId
            }
        } else if let eventId = userInfo["eventId"] as? String {
            Task { @MainActor in
                guard PushTokenStorage.registrationAllowed,
                      authSessionBoundary.owns(notificationBoundary) else { return }
                sharedAppState?.pendingPushEventId = eventId
            }
        }
        completionHandler()
    }
}
