import AppKit
import Foundation
import UserNotifications

struct BookingChange: Equatable, Sendable {
    let bookingID: String
    let title: String
    let body: String
}

enum BookingChangeDetector {
    static func change(
        from previous: BookingActivitySnapshot?,
        to current: BookingActivitySnapshot
    ) -> BookingChange {
        let title: String

        if previous?.status != current.status {
            title = switch current.status {
            case .draft: "Booking draft updated"
            case .booked: "Booking reserved"
            case .pendingPickup: "Booking ready for pickup"
            case .open: "Booking checked out"
            case .completed: "Booking checked in"
            case .cancelled: "Booking cancelled"
            }
        } else if let previous, current.endsAt > previous.endsAt {
            title = "Booking extended"
        } else if let previous, current.endsAt != previous.endsAt {
            title = "Booking time changed"
        } else {
            title = "Booking updated"
        }

        return BookingChange(
            bookingID: current.id,
            title: title,
            body: "\(current.title) · \(current.requester.name) · Due \(current.endsAt.formatted(date: .abbreviated, time: .shortened))"
        )
    }
}

protocol BookingNotificationDelivering: Sendable {
    func requestAuthorization() async
    func deliver(_ change: BookingChange) async
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
              var components = URLComponents(
                url: GearOpsClient.canonicalBaseURL.appendingPathComponent("/bookings"),
                resolvingAgainstBaseURL: false
              ) else { return }
        components.queryItems = [
            URLQueryItem(name: "tab", value: "checkouts"),
            URLQueryItem(name: "highlight", value: bookingID),
        ]
        guard let url = components.url else { return }
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

    func deliver(_ change: BookingChange) async {
        let content = UNMutableNotificationContent()
        content.title = change.title
        content.body = change.body
        content.sound = nil
        content.interruptionLevel = .passive
        content.threadIdentifier = "booking-\(change.bookingID)"
        content.userInfo = ["bookingID": change.bookingID]

        let request = UNNotificationRequest(
            identifier: "booking-change-\(UUID().uuidString)",
            content: content,
            trigger: nil
        )
        try? await center.add(request)
    }
}
