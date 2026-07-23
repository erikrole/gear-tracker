import XCTest
@testable import Wisconsin

@MainActor
final class ShiftGlanceSnapshotTests: XCTestCase {
    private let now = Date(timeIntervalSince1970: 2_000_000_000)

    func testSnapshotFiltersPastShiftsSortsAndCapsResults() {
        let shifts = [
            makeShift(id: "past", startsOffset: -7_200, endsOffset: -3_600),
            makeShift(id: "fourth", startsOffset: 14_400, endsOffset: 18_000),
            makeShift(id: "second", startsOffset: 7_200, endsOffset: 10_800),
            makeShift(id: "fifth", startsOffset: 18_000, endsOffset: 21_600),
            makeShift(id: "first", startsOffset: 3_600, endsOffset: 7_200),
            makeShift(id: "third", startsOffset: 10_800, endsOffset: 14_400),
        ]

        let snapshot = ShiftGlanceSnapshot(myShifts: shifts, generatedAt: now)

        XCTAssertEqual(snapshot.shifts.map(\.id), ["first", "second", "third", "fourth"])
    }

    func testSnapshotStoresDisplayReadyPersonalShiftFacts() throws {
        let shift = makeShift(
            id: "assignment-1",
            startsOffset: 3_600,
            endsOffset: 10_800,
            gearStatus: "pickup_ready"
        )

        let item = try XCTUnwrap(
            ShiftGlanceSnapshot(myShifts: [shift], generatedAt: now).shifts.first
        )

        XCTAssertEqual(item.eventId, "event-assignment-1")
        XCTAssertEqual(item.title, "Football vs Notre Dame")
        XCTAssertEqual(item.area, "Photo")
        XCTAssertEqual(item.locationName, "Camp Randall Stadium")
        XCTAssertEqual(item.gearLabel, "Gear ready")
    }

    func testFreshnessAndActiveStateUseSnapshotTime() throws {
        let item = try XCTUnwrap(
            ShiftGlanceSnapshot(
                myShifts: [
                    makeShift(id: "active", startsOffset: -1_800, endsOffset: 1_800),
                ],
                generatedAt: now
            ).shifts.first
        )
        let snapshot = ShiftGlanceSnapshot(generatedAt: now, shifts: [item])

        XCTAssertTrue(item.isActive(at: now))
        XCTAssertFalse(snapshot.isStale(at: now.addingTimeInterval(11 * 60 * 60)))
        XCTAssertTrue(snapshot.isStale(at: now.addingTimeInterval(13 * 60 * 60)))
    }

    func testStoreRoundTripsAndClearsSnapshot() throws {
        let suiteName = "ShiftGlanceSnapshotTests.\(UUID().uuidString)"
        let defaults = try XCTUnwrap(UserDefaults(suiteName: suiteName))
        defer { defaults.removePersistentDomain(forName: suiteName) }
        let store = ShiftGlanceSnapshotStore(defaults: defaults)
        let snapshot = ShiftGlanceSnapshot(generatedAt: now, shifts: [])

        XCTAssertTrue(store.save(snapshot))
        XCTAssertEqual(store.load(), snapshot)

        store.clear()
        XCTAssertNil(store.load())
    }

    private func makeShift(
        id: String,
        startsOffset: TimeInterval,
        endsOffset: TimeInterval,
        gearStatus: String = "none"
    ) -> MyShift {
        MyShift(
            id: id,
            area: "PHOTO",
            workerType: "STUDENT",
            startsAt: now.addingTimeInterval(startsOffset),
            endsAt: now.addingTimeInterval(endsOffset),
            status: "ASSIGNED",
            event: MyShiftEvent(
                id: "event-\(id)",
                summary: "Wisconsin Football",
                startsAt: now.addingTimeInterval(startsOffset + 1_800),
                endsAt: now.addingTimeInterval(endsOffset),
                sportCode: "FB",
                isHome: true,
                opponent: "Notre Dame",
                locationName: "Camp Randall Stadium"
            ),
            gear: ShiftGear(status: gearStatus, bookings: [])
        )
    }
}
