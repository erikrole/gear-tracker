import Foundation
import XCTest
@testable import GearOps

final class BookingNotificationTests: XCTestCase {
    func testStatusTransitionsUseOperationalLanguage() {
        let booked = snapshot(status: .booked)

        XCTAssertEqual(
            BookingChangeDetector.change(from: nil, to: booked)?.title,
            "Booking reserved"
        )
        XCTAssertEqual(
            BookingChangeDetector.change(from: booked, to: snapshot(status: .open))?.title,
            "Booking checked out"
        )
        XCTAssertEqual(
            BookingChangeDetector.change(from: snapshot(status: .open), to: snapshot(status: .completed))?.title,
            "Booking checked in"
        )
        XCTAssertEqual(
            BookingChangeDetector.change(from: booked, to: snapshot(status: .cancelled))?.title,
            "Booking cancelled"
        )
        XCTAssertFalse(
            BookingChangeDetector.change(
                from: snapshot(status: .open),
                to: snapshot(status: .completed)
            )?.body.contains("Due") ?? true
        )
    }

    func testLaterDueDateIsAnExtension() {
        let previous = snapshot(endsAt: Date(timeIntervalSince1970: 1_800_000_000))
        let current = snapshot(endsAt: Date(timeIntervalSince1970: 1_800_086_400))

        XCTAssertEqual(
            BookingChangeDetector.change(from: previous, to: current)?.title,
            "Booking extended"
        )
    }

    func testSameStatusAndDueDateIsGenericUpdate() {
        let previous = snapshot(title: "Camera")
        let current = snapshot(title: "Camera and audio")

        XCTAssertEqual(
            BookingChangeDetector.change(from: previous, to: current)?.title,
            "Booking updated"
        )
    }

    func testAvatarOnlyProjectionChangeDoesNotNotify() {
        let previous = snapshot(avatarURL: nil)
        let current = snapshot(avatarURL: "https://example.com/avatar.jpg")

        XCTAssertNil(BookingChangeDetector.change(from: previous, to: current))
    }

    func testDeepLinksPreserveBookingKind() {
        XCTAssertEqual(
            BookingDeepLink.bookingURL(id: "checkout-1", kind: .checkout)?.absoluteString,
            "https://wisconsincreative.com/bookings?tab=checkouts&highlight=checkout-1"
        )
        XCTAssertEqual(
            BookingDeepLink.bookingURL(id: "reservation-1", kind: .reservation)?.absoluteString,
            "https://wisconsincreative.com/bookings?tab=reservations&highlight=reservation-1"
        )
        XCTAssertEqual(
            BookingDeepLink.pendingPickupsURL?.absoluteString,
            "https://wisconsincreative.com/bookings?tab=all"
        )
        XCTAssertEqual(
            BookingDeepLink.notificationURL(bookingID: "legacy-1", rawKind: nil)?.absoluteString,
            "https://wisconsincreative.com/bookings?tab=all&highlight=legacy-1"
        )
    }

    private func snapshot(
        title: String = "Camera checkout",
        status: BookingStatus = .booked,
        endsAt: Date = Date(timeIntervalSince1970: 1_800_000_000),
        avatarURL: String? = nil
    ) -> BookingActivitySnapshot {
        BookingActivitySnapshot(
            id: "booking-1",
            title: title,
            kind: .reservation,
            status: status,
            startsAt: Date(timeIntervalSince1970: 1_799_000_000),
            endsAt: endsAt,
            updatedAt: Date(timeIntervalSince1970: 1_700_000_000),
            requester: .init(id: "user-1", name: "Erik Role", avatarUrl: avatarURL),
            location: .init(id: "location-1", name: "Kohl Center")
        )
    }
}
