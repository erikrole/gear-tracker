import Testing
import Foundation
@testable import Wisconsin

/// Locks in the license expiry calendar-date contract.
///
/// `src/lib/license-dates.ts` documents the storage rule: an expiry is an annual
/// calendar date encoded at UTC midnight, and a reader must take its UTC date
/// parts rather than treat the encoded instant as a local moment.
///
/// iOS previously formatted the raw instant in the device timezone, so every
/// expiry rendered a day early anywhere west of UTC — a 31 Dec license read
/// "Expires Dec 30" in Central — and both the "Expired" copy and the urgency
/// tone flipped a full day before the license actually lapsed.
///
/// Serialized because each test overrides the process-wide default time zone.
@Suite(.serialized)
struct LicenseExpiryTests {

    // MARK: Helpers

    private func withTimeZone<T>(_ identifier: String, _ body: () throws -> T) rethrows -> T {
        let original = NSTimeZone.default
        NSTimeZone.default = TimeZone(identifier: identifier)!
        defer { NSTimeZone.default = original }
        return try body()
    }

    private func calendar(_ identifier: String) -> Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: identifier)!
        return calendar
    }

    private func localDate(_ year: Int, _ month: Int, _ day: Int, in zone: String) -> Date {
        calendar(zone).date(from: DateComponents(year: year, month: month, day: day))!
    }

    // MARK: Calendar day

    @Test func utcMidnightExpiryKeepsItsCalendarDayInCentral() {
        let day = LicenseExpiry.calendarDay(
            from: "2026-12-31T00:00:00.000Z",
            calendar: calendar("America/Chicago")
        )
        #expect(day == localDate(2026, 12, 31, in: "America/Chicago"))
    }

    @Test func expiryReadsIdenticallyAcrossTimeZones() {
        let raw = "2026-12-31T00:00:00.000Z"
        for zone in ["America/Chicago", "America/Los_Angeles", "UTC", "Asia/Tokyo"] {
            let day = LicenseExpiry.calendarDay(from: raw, calendar: calendar(zone))
            let components = calendar(zone).dateComponents([.year, .month, .day], from: day!)
            #expect(components.year == 2026, "year drifted in \(zone)")
            #expect(components.month == 12, "month drifted in \(zone)")
            #expect(components.day == 31, "day drifted in \(zone)")
        }
    }

    @Test func expiryWithoutFractionalSecondsStillParses() {
        let day = LicenseExpiry.calendarDay(
            from: "2026-12-31T00:00:00Z",
            calendar: calendar("America/Chicago")
        )
        #expect(day == localDate(2026, 12, 31, in: "America/Chicago"))
    }

    @Test func missingOrUnparseableExpiryHasNoCalendarDay() {
        #expect(LicenseExpiry.calendarDay(from: nil) == nil)
        #expect(LicenseExpiry.calendarDay(from: "") == nil)
        #expect(LicenseExpiry.calendarDay(from: "not a date") == nil)
    }

    // MARK: Days until

    @Test func licenseIsNotExpiredOnItsOwnLastDay() {
        // The bug: in Central, 31 Dec UTC-midnight sorted before local start of
        // day on 31 Dec, so the license read "Expired" while still valid.
        let central = calendar("America/Chicago")
        let now = central.date(from: DateComponents(year: 2026, month: 12, day: 31, hour: 9))!
        let daysLeft = LicenseExpiry.daysUntil("2026-12-31T00:00:00.000Z", now: now, calendar: central)
        #expect(daysLeft == 0)
    }

    @Test func expiredLicenseReportsNegativeDays() {
        let central = calendar("America/Chicago")
        let now = central.date(from: DateComponents(year: 2027, month: 1, day: 2, hour: 9))!
        let daysLeft = LicenseExpiry.daysUntil("2026-12-31T00:00:00.000Z", now: now, calendar: central)
        #expect(daysLeft == -2)
    }

    @Test func upcomingExpiryCountsWholeDays() {
        let central = calendar("America/Chicago")
        let now = central.date(from: DateComponents(year: 2026, month: 12, day: 1, hour: 23))!
        let daysLeft = LicenseExpiry.daysUntil("2026-12-31T00:00:00.000Z", now: now, calendar: central)
        #expect(daysLeft == 30)
    }

    @Test func dayCountIsStableRegardlessOfClockTime() {
        let central = calendar("America/Chicago")
        let raw = "2026-12-31T00:00:00.000Z"
        let earlyMorning = central.date(from: DateComponents(year: 2026, month: 12, day: 30, hour: 0, minute: 5))!
        let lateEvening = central.date(from: DateComponents(year: 2026, month: 12, day: 30, hour: 23, minute: 55))!
        #expect(LicenseExpiry.daysUntil(raw, now: earlyMorning, calendar: central) == 1)
        #expect(LicenseExpiry.daysUntil(raw, now: lateEvening, calendar: central) == 1)
    }

    @Test func defaultCalendarFollowsTheDeviceTimeZone() {
        withTimeZone("America/Los_Angeles") {
            let day = LicenseExpiry.calendarDay(from: "2026-12-31T00:00:00.000Z")
            let components = Calendar.current.dateComponents([.year, .month, .day], from: day!)
            #expect(components.day == 31)
            #expect(components.month == 12)
        }
    }
}
