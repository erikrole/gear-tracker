import UIKit
import UserNotifications

enum PushTokenStorage {
    static let currentTokenKey = "WisconsinCurrentAPNsToken"
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
        let hex = deviceToken.map { String(format: "%02x", $0) }.joined()
        UserDefaults.standard.set(hex, forKey: PushTokenStorage.currentTokenKey)
        Task { @MainActor in
            do {
                try await APIClient.shared.registerDeviceToken(hex)
                sharedAppState?.pushRegistrationState = .registered
            } catch {
                sharedAppState?.pushRegistrationState = .failed
                print("[APNS] Device token registration failed: \(error.localizedDescription)")
            }
        }
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
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
        completionHandler([.banner, .sound, .badge])
    }

    // User tapped notification (foreground or background)
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        let userInfo = response.notification.request.content.userInfo
        if let route = PushRoute.resolve(userInfo: userInfo) {
            Task { @MainActor in
                switch route {
                case .booking(let bookingId):
                    sharedAppState?.pendingPushBookingId = bookingId
                case .trade(let tradeId):
                    sharedAppState?.pendingPushTradeId = tradeId
                case .event(let eventId):
                    sharedAppState?.pendingPushEventId = eventId
                case .browse(let destination):
                    sharedAppState?.pendingBrowseDestination = destination
                }
            }
        }
        completionHandler()
    }
}
