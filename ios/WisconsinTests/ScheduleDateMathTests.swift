import Testing
import Foundation
@testable import Wisconsin

/// Locks in the all-day / multi-day day math for `ScheduleEvent`.
///
/// All-day events are stored as UTC-midnight boundaries (calendar *dates*), so
/// their covered days must be read in UTC regardless of the device timezone —
/// otherwise a single-day event off-by-ones into "Day 1/2" and lands on the
/// wrong date header on non-UTC devices (the bug these tests guard against).
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
            // All-day July 7: stored UTC midnight Jul 7 → exclusive end Jul 8.
            let event = allDayEvent(start: utcMidnight(2026, 7, 7), end: utcMidnight(2026, 7, 8))
            #expect(event.isMultiDay == false)
            #expect(event.dayCount == 1)
            #expect(event.spannedDays == [localMidnight(2026, 7, 7)])
        }
    }

    // MARK: All-day, multi day

    @Test func twoDayAllDayEventSpansTwoCorrectDays_pacific() {
        withTimeZone("America/Los_Angeles") {
            // All-day Jul 7–8: stored UTC midnight Jul 7 → exclusive end Jul 9.
            let event = allDayEvent(start: utcMidnight(2026, 7, 7), end: utcMidnight(2026, 7, 9))
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
        let event = allDayEvent(start: utcMidnight(2026, 7, 7), end: utcMidnight(2026, 7, 8))
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
}
