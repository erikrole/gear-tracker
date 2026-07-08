import Foundation

// MARK: - Kiosk date formatting
//
// Shared by the idle clock, the sleep overlay, and the freshness stamp.
// Extracted verbatim from KioskIdleView.swift (2026-07-02 rework Slice 5a).

extension Date {
    func kioskClockParts() -> (time: String, seconds: String, meridiem: String) {
        let components = Calendar.current.dateComponents([.hour, .minute, .second], from: self)
        let rawHour = components.hour ?? 0
        let hour = rawHour % 12 == 0 ? 12 : rawHour % 12
        let minute = components.minute ?? 0
        let second = components.second ?? 0
        let meridiem = rawHour < 12 ? "AM" : "PM"
        return (
            time: "\(hour):\(String(format: "%02d", minute))",
            seconds: String(format: ":%02d", second),
            meridiem: meridiem
        )
    }

    /// Compact "Just now / Xs ago / Xm ago" string for the kiosk header
    /// freshness stamp. iOS's `RelativeDateTimeFormatter` is overkill for
    /// the sub-minute range; this matches the rest of the app's gear-shift
    /// vocabulary at small sizes.
    func kioskFreshnessLabel(now: Date) -> String {
        let seconds = max(0, now.timeIntervalSince(self))
        if seconds < 5 { return "just now" }
        if seconds < 60 { return "\(Int(seconds))s ago" }
        let minutes = Int(seconds / 60)
        if minutes < 60 { return "\(minutes)m ago" }
        let hours = minutes / 60
        return "\(hours)h ago"
    }
}

extension KioskEvent {
    /// Local display day for the event's encoded start date. All-day event
    /// timestamps are storage bounds, not clock times; read their UTC calendar
    /// date so Central iPads do not bucket tomorrow's all-day event as tonight.
    var kioskDisplayStartDay: Date {
        kioskDisplayDay(for: startsAt)
    }

    var kioskDisplayEndDay: Date {
        guard displayAllDay, let endsAt else { return kioskDisplayStartDay }

        if allDay {
            let start = kioskDisplayStartDay
            let rawEndExclusiveDay = kioskDisplayDay(for: endsAt)
            guard rawEndExclusiveDay > start else { return start }
            return Calendar.current.date(byAdding: .day, value: -1, to: rawEndExclusiveDay) ?? start
        }

        return kioskDisplayDay(for: endsAt.addingTimeInterval(-1))
    }

    func kioskOccurs(on day: Date, calendar: Calendar = .current) -> Bool {
        let targetDay = calendar.startOfDay(for: day)
        let startDay = calendar.startOfDay(for: kioskDisplayStartDay)

        guard displayAllDay else {
            return calendar.isDate(startDay, inSameDayAs: targetDay)
        }

        let endDay = calendar.startOfDay(for: kioskDisplayEndDay)
        return targetDay >= startDay && targetDay <= endDay
    }

    private var kioskDisplayDayCalendar: Calendar {
        guard allDay else { return .current }
        var calendar = Calendar(identifier: .gregorian)
        if let utc = TimeZone(identifier: "UTC") {
            calendar.timeZone = utc
        }
        return calendar
    }

    private func kioskDisplayDay(for instant: Date) -> Date {
        let components = kioskDisplayDayCalendar.dateComponents([.year, .month, .day], from: instant)
        return Calendar.current.date(from: DateComponents(
            year: components.year,
            month: components.month,
            day: components.day
        )) ?? Calendar.current.startOfDay(for: instant)
    }
}
