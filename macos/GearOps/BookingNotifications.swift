import AppKit
import Foundation
import UserNotifications

struct BookingChange: Equatable, Sendable {
    let bookingID: String
    let bookingKind: BookingKind
    let bookingTitle: String
    let statusLabel: String
    let category: BookingChangeCategory
    let requesterName: String
    let timestamp: Date

    var summary: String {
        "\(statusLabel) • \(requesterName) • \(timestamp.formatted(date: .abbreviated, time: .shortened))"
    }
}

enum BookingDeepLink {
    static func bookingURL(id: String, kind: BookingKind) -> URL? {
        bookingURL(id: id, tab: kind == .reservation ? "reservations" : "checkouts")
    }

    static func notificationURL(bookingID: String, rawKind: String?) -> URL? {
        if let rawKind, let kind = BookingKind(rawValue: rawKind) {
            return bookingURL(id: bookingID, kind: kind)
        }
        return bookingURL(id: bookingID, tab: "all")
    }

    private static func bookingURL(id: String, tab: String) -> URL? {
        var components = URLComponents(
            url: GearOpsClient.canonicalBaseURL.appendingPathComponent("bookings"),
            resolvingAgainstBaseURL: false
        )
        components?.queryItems = [
            URLQueryItem(name: "tab", value: tab),
            URLQueryItem(name: "highlight", value: id),
        ]
        return components?.url
    }

    static var pendingPickupsURL: URL? {
        var components = URLComponents(
            url: GearOpsClient.canonicalBaseURL.appendingPathComponent("bookings"),
            resolvingAgainstBaseURL: false
        )
        components?.queryItems = [URLQueryItem(name: "tab", value: "all")]
        return components?.url
    }
}

enum BookingChangeDetector {
    static func change(
        from previous: BookingActivitySnapshot?,
        to current: BookingActivitySnapshot
    ) -> BookingChange? {
        let statusLabel: String
        let category: BookingChangeCategory

        if previous?.status != current.status {
            statusLabel = switch current.status {
            case .draft: "Updated"
            case .booked: "Reserved"
            case .pendingPickup: "Ready for Pickup"
            case .open: "Checked Out"
            case .completed: "Checked In"
            case .cancelled: "Cancelled"
            }
            category = switch current.status {
            case .draft: .other
            case .booked: .reservation
            case .pendingPickup: .pickupReady
            case .open: .checkout
            case .completed: .checkIn
            case .cancelled: .cancellation
            }
        } else if let previous, current.endsAt > previous.endsAt {
            statusLabel = "Extended"
            category = .timeChange
        } else if let previous, current.endsAt != previous.endsAt {
            statusLabel = "Updated"
            category = .timeChange
        } else if let previous,
                  previous.title == current.title,
                  previous.kind == current.kind,
                  previous.startsAt == current.startsAt,
                  previous.requester.id == current.requester.id,
                  previous.location.id == current.location.id {
            return nil
        } else {
            statusLabel = "Updated"
            category = .other
        }

        return BookingChange(
            bookingID: current.id,
            bookingKind: current.kind,
            bookingTitle: current.title,
            statusLabel: statusLabel,
            category: category,
            requesterName: current.requester.name,
            timestamp: current.updatedAt
        )
    }
}

enum BookingNotificationAuthorization: Equatable, Sendable {
    case notDetermined
    case denied
    case authorized
    case provisional
    case unknown

    /// Only a hard denial needs a call to action; the rest either already work
    /// or resolve themselves on the next authorization prompt.
    var needsSystemSettings: Bool { self == .denied }

    var label: String {
        switch self {
        case .notDetermined: "Not requested yet"
        case .denied: "Turned off in System Settings"
        case .authorized: "Allowed"
        case .provisional: "Delivering quietly"
        case .unknown: "Unavailable"
        }
    }
}

protocol BookingNotificationDelivering: Sendable {
    func requestAuthorization() async
    func authorization() async -> BookingNotificationAuthorization
    func deliver(_ change: BookingChange, playsSound: Bool) async
}

private final class BookingNotificationPresenter: NSObject, UNUserNotificationCenterDelegate, @unchecked Sendable {
    static let shared = BookingNotificationPresenter()

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification
    ) async -> UNNotificationPresentationOptions {
        [.banner, .list]
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse
    ) async {
        guard let bookingID = response.notification.request.content.userInfo["bookingID"] as? String,
              let url = BookingDeepLink.notificationURL(
                bookingID: bookingID,
                rawKind: response.notification.request.content.userInfo["bookingKind"] as? String
              ) else { return }
        _ = await MainActor.run { NSWorkspace.shared.open(url) }
    }
}

actor BookingNotificationCenter: BookingNotificationDelivering {
    private let center: UNUserNotificationCenter

    init(center: UNUserNotificationCenter = .current()) {
        self.center = center
        center.delegate = BookingNotificationPresenter.shared
    }

    func requestAuthorization() async {
        _ = try? await center.requestAuthorization(options: [.alert])
    }

    func authorization() async -> BookingNotificationAuthorization {
        switch await center.notificationSettings().authorizationStatus {
        case .notDetermined: .notDetermined
        case .denied: .denied
        case .authorized: .authorized
        case .provisional: .provisional
        @unknown default: .unknown
        }
    }

    func deliver(_ change: BookingChange, playsSound: Bool) async {
        let content = UNMutableNotificationContent()
        content.title = change.bookingTitle
        content.body = change.summary
        content.sound = playsSound ? .default : nil
        content.interruptionLevel = .active
        content.threadIdentifier = "booking-\(change.bookingID)"
        content.userInfo = [
            "bookingID": change.bookingID,
            "bookingKind": change.bookingKind.rawValue,
        ]

        let request = UNNotificationRequest(
            identifier: "booking-change-\(UUID().uuidString)",
            content: content,
            trigger: nil
        )
        try? await center.add(request)
    }
}
