import AppKit
import Foundation

enum CompanionPushEvent: Sendable {
    case deviceToken(String)
    case projectionChanged
}

final class CompanionPushBridge: Sendable {
    static let shared = CompanionPushBridge()

    let events: AsyncStream<CompanionPushEvent>
    private let continuation: AsyncStream<CompanionPushEvent>.Continuation

    private init() {
        let pair = AsyncStream<CompanionPushEvent>.makeStream(bufferingPolicy: .bufferingNewest(8))
        events = pair.stream
        continuation = pair.continuation
    }

    func send(_ event: CompanionPushEvent) {
        continuation.yield(event)
    }
}

@MainActor
final class GearOpsAppDelegate: NSObject, NSApplicationDelegate {
    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApplication.shared.registerForRemoteNotifications()
    }

    func application(
        _ application: NSApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        let token = deviceToken.map { String(format: "%02x", $0) }.joined()
        CompanionPushBridge.shared.send(.deviceToken(token))
    }

    func application(
        _ application: NSApplication,
        didFailToRegisterForRemoteNotificationsWithError error: Error
    ) {
        // Projection delivery remains cached and manual-refreshable when APNs
        // registration is temporarily unavailable.
    }

    func application(
        _ application: NSApplication,
        didReceiveRemoteNotification userInfo: [String: Any]
    ) {
        guard userInfo["companionProjectionVersion"] != nil else { return }
        CompanionPushBridge.shared.send(.projectionChanged)
    }
}
