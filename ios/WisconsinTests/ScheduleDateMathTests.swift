import Testing
import Foundation
@testable import Wisconsin

/// Locks in the all-day / multi-day day math for `ScheduleEvent`.
///
/// All-day events carry encoded calendar dates. Imported ICS all-day events can
/// arrive as UTC midnight, while manual all-day events can arrive as Central
/// midnight (`05:00Z` during daylight saving). In both cases the UTC Y/M/D
/// components are the event dates and the clock time must not turn a single-day
/// event into "Day 1/2" on non-UTC devices.
///
/// Serialized because each test overrides the process-wide default time zone.
@Suite(.serialized)
struct ScheduleDateMathTests {

    // MARK: Helpers

    /// A UTC-midnight instant for the given calendar date.
    private func utcMidnight(_ year: Int, _ month: Int, _ day: Int) -> Date {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "UTC")!
        return cal.date(from: DateComponents(year: year, month: month, day: day))!
    }

    /// A Central-midnight all-day instant as it appears in the live API during
    /// daylight saving time, e.g. Lambeau Field Visit:
    /// `2026-06-17T05:00:00.000Z` → `2026-06-18T05:00:00.000Z`.
    private func centralDaylightMidnightEncoded(_ year: Int, _ month: Int, _ day: Int) -> Date {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "UTC")!
        return cal.date(from: DateComponents(year: year, month: month, day: day, hour: 5))!
    }

    /// Local midnight for the given calendar date (in the active default zone).
    private func localMidnight(_ year: Int, _ month: Int, _ day: Int) -> Date {
        Calendar.current.date(from: DateComponents(year: year, month: month, day: day))!
    }

    private func allDayEvent(start: Date, end: Date) -> ScheduleEvent {
        ScheduleEvent(
            id: "e", summary: "Test", startsAt: start, endsAt: end, allDay: true,
            status: "CONFIRMED", sportCode: nil, opponent: nil, isHome: nil, location: nil
        )
    }

    private func weatherEvent(
        sportCode: String? = nil,
        isHome: Bool? = true,
        locationName: String? = nil,
        rawLocationText: String? = nil
    ) -> ScheduleEvent {
        var event = ScheduleEvent(
            id: "weather",
            summary: "Weather test",
            startsAt: Date(),
            endsAt: Date().addingTimeInterval(3_600),
            allDay: false,
            status: "CONFIRMED",
            sportCode: sportCode,
            opponent: "Opponent",
            isHome: isHome,
            location: locationName.map { EventLocation(id: "venue", name: $0) }
        )
        event.rawLocationText = rawLocationText
        return event
    }

    /// Run `body` with the process default time zone pinned, then restore it.
    private func withTimeZone(_ identifier: String, _ body: () -> Void) {
        let previous = NSTimeZone.default
        NSTimeZone.default = TimeZone(identifier: identifier)!
        defer { NSTimeZone.default = previous }
        body()
    }

    // MARK: All-day, single day

    @Test func singleDayAllDayEventIsNotMultiDay_pacific() {
        withTimeZone("America/Los_Angeles") {
            // Lambeau-shaped one-day all-day event: Central midnight Jun 17
            // through exclusive Central midnight Jun 18.
            let event = allDayEvent(
                start: centralDaylightMidnightEncoded(2026, 6, 17),
                end: centralDaylightMidnightEncoded(2026, 6, 18)
            )
            #expect(event.isMultiDay == false)
            #expect(event.dayCount == 1)
            #expect(event.spannedDays == [localMidnight(2026, 6, 17)])
        }
    }

    // MARK: All-day, multi day

    @Test func twoDayAllDayEventSpansTwoCorrectDays_pacific() {
        withTimeZone("America/Los_Angeles") {
            // All-day Jul 7-8: Central midnight Jul 7 through exclusive
            // Central midnight Jul 9.
            let event = allDayEvent(
                start: centralDaylightMidnightEncoded(2026, 7, 7),
                end: centralDaylightMidnightEncoded(2026, 7, 9)
            )
            #expect(event.isMultiDay == true)
            #expect(event.dayCount == 2)

            let d7 = localMidnight(2026, 7, 7)
            let d8 = localMidnight(2026, 7, 8)
            #expect(event.spannedDays == [d7, d8])
            #expect(event.dayIndex(for: d7) == 1)
            #expect(event.dayIndex(for: d8) == 2)
        }
    }

    // MARK: Timezone independence

    @Test func allDayEventReadsIdenticallyAcrossTimeZones() {
        let event = allDayEvent(
            start: centralDaylightMidnightEncoded(2026, 6, 17),
            end: centralDaylightMidnightEncoded(2026, 6, 18)
        )
        var pacific = -1
        var utc = -1
        var tokyo = -1
        withTimeZone("America/Los_Angeles") { pacific = event.dayCount }
        withTimeZone("UTC") { utc = event.dayCount }
        withTimeZone("Asia/Tokyo") { tokyo = event.dayCount }
        #expect(pacific == 1)
        #expect(utc == 1)
        #expect(tokyo == 1)
    }

    // MARK: Timed events stay local

    @Test func timedEventUsesLocalCalendarDay_pacific() {
        withTimeZone("America/Los_Angeles") {
            let start = Calendar.current.date(from: DateComponents(year: 2026, month: 7, day: 7, hour: 14))!
            let end = Calendar.current.date(from: DateComponents(year: 2026, month: 7, day: 7, hour: 16))!
            let event = ScheduleEvent(
                id: "t", summary: "Game", startsAt: start, endsAt: end, allDay: false,
                status: "CONFIRMED", sportCode: "FB", opponent: nil, isHome: true, location: nil
            )
            #expect(event.isMultiDay == false)
            #expect(event.dayCount == 1)
            #expect(event.spannedDays == [localMidnight(2026, 7, 7)])
        }
    }

    // MARK: Outdoor home-event weather

    @Test func weatherUsesAnyNamedHomeVenueExceptCoveredFacilities() {
        #expect(weatherEvent(locationName: "Camp Randall Stadium").isOutdoorHomeEvent)
        #expect(weatherEvent(rawLocationText: "Madison, WI, McClimon Track/Soccer Complex").isOutdoorHomeEvent)
        #expect(weatherEvent(locationName: "Unknown Campus Venue").isOutdoorHomeEvent)
    }

    @Test func weatherRejectsCoveredAndAwayVenues() {
        #expect(!weatherEvent(locationName: "Kohl Center").isOutdoorHomeEvent)
        #expect(!weatherEvent(locationName: "UW Field House").isOutdoorHomeEvent)
        #expect(!weatherEvent(locationName: "LaBahn Arena").isOutdoorHomeEvent)
        #expect(!weatherEvent(isHome: false, locationName: "Camp Randall Stadium").isOutdoorHomeEvent)
        #expect(!weatherEvent(
            locationName: "Kohl Center",
            rawLocationText: "Madison, WI, Camp Randall Stadium"
        ).isOutdoorHomeEvent)
    }

    @Test func weatherUsesOutdoorSportOnlyWhenVenueEvidenceIsMissing() {
        #expect(weatherEvent(sportCode: "FB").isOutdoorHomeEvent)
        #expect(!weatherEvent(sportCode: "MBB").isOutdoorHomeEvent)
        #expect(!weatherEvent(sportCode: "FB", locationName: "Kohl Center").isOutdoorHomeEvent)
    }
}
