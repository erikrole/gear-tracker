import Foundation
import XCTest
@testable import GearOps

@MainActor
final class GearOpsModelTests: XCTestCase {
    func testFailedRefreshPreservesLastTrustedCounts() async {
        let client = MockGearOpsClient()
        let defaults = isolatedDefaults()
        let model = GearOpsModel(client: client, defaults: defaults, bookingNotifications: NoopBookingNotifier(), credentialStore: InMemoryCredentialStore(), autoStart: false)

        await model.signIn(email: "admin@wisc.edu", password: "password")
        XCTAssertEqual(model.snapshot?.stats.checkedOut, 12)

        await client.setProjectionError(.network("offline"))
        await model.refresh()

        XCTAssertEqual(model.statusMessage, "Automatic updates are unavailable. Showing the last confirmed data.")
        XCTAssertEqual(model.healthSeverity, .attention)
    }

    func testRestoreRefreshesExternalProjectionImmediately() async {
        let client = MockGearOpsClient()
        let defaults = isolatedDefaults()
        let credentials = InMemoryCredentialStore()
        let original = GearOpsModel(
            client: client,
            defaults: defaults,
            bookingNotifications: NoopBookingNotifier(),
            credentialStore: credentials,
            autoStart: false
        )
        await original.signIn(email: "admin@wisc.edu", password: "password")
        XCTAssertEqual(original.snapshot?.stats.checkedOut, 12)

        await client.setCheckedOut(11)
        let restored = GearOpsModel(
            client: client,
            defaults: defaults,
            bookingNotifications: NoopBookingNotifier(),
            credentialStore: credentials,
            autoStart: false
        )
        await restored.restoreSession()

        XCTAssertEqual(restored.snapshot?.stats.checkedOut, 11)
    }

    func testCountPartialFailureDoesNotInstallFallbackZeroes() async {
        let client = MockGearOpsClient()
        let model = GearOpsModel(client: client, defaults: isolatedDefaults(), bookingNotifications: NoopBookingNotifier(), credentialStore: InMemoryCredentialStore(), autoStart: false)

        await model.signIn(email: "admin@wisc.edu", password: "password")
        XCTAssertEqual(model.snapshot?.stats.checkedOut, 12)

        await client.setProjectionError(.network("offline"))
        await model.refresh()

        XCTAssertEqual(model.snapshot?.stats.checkedOut, 12)
        XCTAssertEqual(model.snapshot?.stats.checkedOut, 12)
        XCTAssertEqual(model.statusMessage, "Automatic updates are unavailable. Showing the last confirmed data.")
    }

    func testForbiddenKioskReadIsRestrictedNotCritical() async {
        let client = MockGearOpsClient(kioskAccess: "restricted")
        let model = GearOpsModel(client: client, defaults: isolatedDefaults(), bookingNotifications: NoopBookingNotifier(), credentialStore: InMemoryCredentialStore(), autoStart: false)

        await model.signIn(email: "staff@wisc.edu", password: "password")

        XCTAssertEqual(model.kioskAccess, .restricted)
        XCTAssertEqual(model.healthSeverity, .attention)
    }

    func testDashboardEnvelopeDecodesOperationalLanes() throws {
        let json = """
        {
          "data": {
            "role": "ADMIN",
            "stats": { "checkedOut": 12, "overdue": 2, "reserved": 8, "dueToday": 4 },
            "overdueCount": 2,
            "pendingPickupTotal": 1
          },
          "partialFailures": []
        }
        """

        let decoded = try JSONDecoder().decode(DashboardStatsEnvelope.self, from: Data(json.utf8))
        XCTAssertEqual(decoded.data.stats.checkedOut, 12)
        XCTAssertEqual(decoded.data.pendingPickupTotal, 1)
    }

    func testCompanionProjectionDecodesServerDateShape() throws {
        let json = """
        {
          "data": {
            "version": 1,
            "generatedAt": "2026-08-09T18:00:00.000Z",
            "stats": { "checkedOut": 1, "overdue": 0, "reserved": 0, "dueToday": 0 },
            "pendingPickupTotal": 0,
            "openBookings": [],
            "bookingActivity": [],
            "kioskDevices": [],
            "kioskAccess": "available"
          }
        }
        """
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601

        let decoded = try decoder.decode(CompanionProjectionEnvelope.self, from: Data(json.utf8))

        XCTAssertEqual(decoded.data.version, 1)
        XCTAssertEqual(decoded.data.generatedAt.formatted(.iso8601), "2026-08-09T18:00:00Z")
    }

    func testFailedOpenBookingRefreshPreservesVisibleRows() async {
        let client = MockGearOpsClient()
        let model = GearOpsModel(client: client, defaults: isolatedDefaults(), bookingNotifications: NoopBookingNotifier(), credentialStore: InMemoryCredentialStore(), autoStart: false)

        await model.signIn(email: "admin@wisc.edu", password: "password")
        XCTAssertEqual(model.openBookings.map(\.title), ["Camera checkout"])

        await client.setProjectionError(.network("offline"))
        await model.refresh()

        XCTAssertEqual(model.openBookings.map(\.title), ["Camera checkout"])
        XCTAssertEqual(model.openBookingTotal, 1)
    }

    func testBookingNotificationBaselineIsQuietThenDeliversTransition() async {
        let client = MockGearOpsClient()
        let notifications = RecordingBookingNotifier()
        await client.setBookingActivity(makeBookingActivity(status: .booked), changed: false)
        let model = GearOpsModel(
            client: client,
            defaults: isolatedDefaults(),
            bookingNotifications: notifications,
            credentialStore: InMemoryCredentialStore(),
            autoStart: false
        )

        await model.signIn(email: "admin@wisc.edu", password: "password")
        let baselineChanges = await notifications.deliveredChanges()
        XCTAssertEqual(baselineChanges, [])

        await client.setBookingActivity(makeBookingActivity(status: .open), changed: true)
        await model.refresh()

        let deliveredTitles = await notifications.deliveredChanges().map(\.title)
        XCTAssertEqual(deliveredTitles, ["Booking checked out"])
    }

    func testPendingPickupLaneIncludesDueReservationsAndStagedCheckouts() async {
        let client = MockGearOpsClient()
        let now = Date(timeIntervalSince1970: 1_800_000_000)
        await client.setBookingActivities([
            makeBookingActivity(id: "future", status: .booked, kind: .reservation, startsAt: now.addingTimeInterval(60)),
            makeBookingActivity(id: "due", status: .booked, kind: .reservation, startsAt: now.addingTimeInterval(-60)),
            makeBookingActivity(id: "staged", status: .pendingPickup, kind: .checkout, startsAt: now.addingTimeInterval(-120)),
        ])
        let model = GearOpsModel(
            client: client,
            defaults: isolatedDefaults(),
            bookingNotifications: NoopBookingNotifier(),
            credentialStore: InMemoryCredentialStore(),
            autoStart: false
        )

        await model.signIn(email: "admin@wisc.edu", password: "password")

        XCTAssertEqual(model.pendingPickupBookings(at: now).map(\.id), ["staged", "due"])
    }

    func testSnapshotFreshnessUsesCompactElapsedTime() {
        let now = Date(timeIntervalSince1970: 2_000_000)
        let snapshot = GearOpsSnapshot(
            stats: GearOpsStats(checkedOut: 1, overdue: 0, reserved: 0, dueToday: 0),
            pendingPickupTotal: 0,
            receivedAt: now.addingTimeInterval(-125),
            partialFailures: []
        )

        XCTAssertEqual(snapshot.freshnessLabel(at: now), "Updated 2m ago")
    }

    private func isolatedDefaults() -> UserDefaults {
        let suite = "GearOpsTests.\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suite)!
        defaults.removePersistentDomain(forName: suite)
        return defaults
    }

}

private actor MockGearOpsClient: GearOpsServing {
    private var projectionError: GearOpsClientError?
    private var activities = [makeBookingActivity()]
    private var checkedOut = 12
    private let kioskAccess: String

    init(kioskAccess: String = "available") {
        self.kioskAccess = kioskAccess
    }

    func setProjectionError(_ error: GearOpsClientError?) {
        projectionError = error
    }

    func setBookingActivity(_ activity: BookingActivitySnapshot, changed: Bool) {
        activities = [activity]
    }

    func setBookingActivities(_ activities: [BookingActivitySnapshot]) {
        self.activities = activities
    }

    func setCheckedOut(_ checkedOut: Int) {
        self.checkedOut = checkedOut
    }

    func login(email: String, password: String) async throws -> LoginResponse {
        LoginResponse(
            user: GearOpsUser(
                id: "user-1",
                name: "Erik Role",
                email: email,
                role: kioskAccess == "restricted" ? "STAFF" : "ADMIN"
            ),
            companionToken: "credential",
            companionProjection: makeProjection(activities: activities, kioskAccess: kioskAccess, checkedOut: checkedOut)
        )
    }

    func companionProjection(token: String, refreshFromSource: Bool) async throws -> CompanionProjection {
        if let projectionError { throw projectionError }
        return makeProjection(activities: activities, kioskAccess: kioskAccess, checkedOut: checkedOut)
    }

    func registerCompanionDevice(_ deviceToken: String, credential: String) async throws {}
    func revokeCompanion(credential: String) async {}
}

private actor InMemoryCredentialStore: CompanionCredentialStoring {
    private var token: String?

    func loadToken() -> String? { token }
    func saveToken(_ token: String) { self.token = token }
    func deleteToken() { token = nil }
}

private actor NoopBookingNotifier: BookingNotificationDelivering {
    func requestAuthorization() async {}
    func deliver(_ change: BookingChange) async {}
}

private actor RecordingBookingNotifier: BookingNotificationDelivering {
    private var changes: [BookingChange] = []

    func requestAuthorization() async {}
    func deliver(_ change: BookingChange) async { changes.append(change) }
    func deliveredChanges() -> [BookingChange] { changes }
}

private func makeOpenBooking() -> OpenBooking {
    OpenBooking(
        id: "booking-1",
        title: "Camera checkout",
        endsAt: Date(timeIntervalSince1970: 1_800_000_000),
        refNumber: "C-001",
        requester: .init(id: "user-1", name: "Erik Role", avatarUrl: nil),
        location: .init(id: "location-1", name: "Kohl Center"),
        serializedItems: [.init(id: "allocation-1")],
        bulkItems: []
    )
}

private func makeBookingActivity(
    id: String = "booking-1",
    status: BookingStatus = .open,
    kind: BookingKind = .checkout,
    startsAt: Date = Date(timeIntervalSince1970: 1_799_000_000),
    endsAt: Date = Date(timeIntervalSince1970: 1_800_000_000),
    updatedAt: Date = Date(timeIntervalSince1970: 1_700_000_000)
) -> BookingActivitySnapshot {
    BookingActivitySnapshot(
        id: id,
        title: "Camera checkout",
        kind: kind,
        status: status,
        startsAt: startsAt,
        endsAt: endsAt,
        updatedAt: updatedAt,
        requester: .init(id: "user-1", name: "Erik Role", avatarUrl: nil),
        location: .init(id: "location-1", name: "Kohl Center")
    )
}

private func makeProjection(
    activities: [BookingActivitySnapshot] = [makeBookingActivity()],
    kioskAccess: String = "available",
    checkedOut: Int = 12
) -> CompanionProjection {
    CompanionProjection(
        version: 1,
        generatedAt: Date(timeIntervalSince1970: 1_800_000_000),
        stats: GearOpsStats(checkedOut: checkedOut, overdue: 2, reserved: 8, dueToday: 4),
        pendingPickupTotal: 1,
        openBookings: [makeOpenBooking()],
        bookingActivity: activities,
        kioskDevices: [],
        kioskAccess: kioskAccess
    )
}
