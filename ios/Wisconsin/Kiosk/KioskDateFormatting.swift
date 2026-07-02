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
