import Foundation

/// Centralized date formats so a copy change touches one file.
extension Date {
    /// "Apr 24, 4:30 PM" — list rows, headers.
    var gearShort: String {
        formatted(date: .abbreviated, time: .shortened)
    }

    /// "Friday, April 24, 2026 at 4:30 PM" — detail headers.
    var gearLong: String {
        formatted(date: .complete, time: .shortened)
    }

    /// "4:30 PM" — time-only.
    var gearTime: String {
        formatted(date: .omitted, time: .shortened)
    }

    /// "Apr 24" — calendar header chips.
    var gearDay: String {
        formatted(.dateTime.month(.abbreviated).day())
    }

    /// "Updated 5m ago" / "Updated just now" — freshness labels.
    var freshnessLabel: String {
        let interval = Date().timeIntervalSince(self)
        if interval < 30 { return "Updated just now" }
        let minutes = Int(interval / 60)
        if minutes < 1 { return "Updated \(Int(interval))s ago" }
        if minutes < 60 { return "Updated \(minutes)m ago" }
        let hours = minutes / 60
        if hours < 24 { return "Updated \(hours)h ago" }
        return "Updated \(hours / 24)d ago"
    }
}

// MARK: - Countdown urgency (mirrors src/lib/format.ts)

/// Same four-level urgency taxonomy the web uses on booking detail.
enum UrgencyLevel {
    case overdue, critical, warning, normal

    /// Maps urgency → status tone for the countdown badge.
    var tone: StatusTone {
        switch self {
        case .overdue:  return .red
        case .critical: return .red
        case .warning:  return .orange
        case .normal:   return .blue
        }
    }
}

extension Date {
    /// Web parity with `getUrgency` in src/lib/format.ts. Returns:
    /// - `.overdue` once `endsAt` is in the past
    /// - `.critical` when ≤ 10% of the booking window remains
    /// - `.warning` when ≤ 25% remains
    /// - `.normal` otherwise
    static func bookingUrgency(startsAt: Date, endsAt: Date, now: Date = Date()) -> UrgencyLevel {
        let remaining = endsAt.timeIntervalSince(now)
        if remaining <= 0 { return .overdue }
        let duration = endsAt.timeIntervalSince(startsAt)
        if duration <= 0 { return .critical }
        let pctRemaining = remaining / duration
        if pctRemaining <= 0.10 { return .critical }
        if pctRemaining <= 0.25 { return .warning }
        return .normal
    }

    /// "DUE BACK IN 3 hours 12 minutes" / "OVERDUE BY 2 days 4 hours" — matches
    /// the web's `formatCountdown` so the live badge reads the same on both
    /// platforms.
    static func countdownLabel(for endsAt: Date, now: Date = Date()) -> String {
        let diff = endsAt.timeIntervalSince(now)
        let body = explicitDuration(seconds: diff)
        return diff <= 0 ? "OVERDUE BY \(body)" : "DUE BACK IN \(body)"
    }

    /// Live countdown to a booking's pickup/start window. Mirrors the due-back
    /// countdown but for the gap before custody begins, so an Awaiting-Pickup
    /// booking gets the same first-class urgency treatment as an active one.
    /// Returns the explicit duration body plus whether the window has passed
    /// (late) and the matching badge tone (blue → orange within 2h → red late).
    static func startCountdown(for startsAt: Date, now: Date = Date()) -> (body: String, isLate: Bool, tone: StatusTone) {
        let diff = startsAt.timeIntervalSince(now)
        if diff <= 0 {
            return (explicitDuration(seconds: diff), true, .red)
        }
        return (explicitDuration(seconds: diff), false, diff <= 7_200 ? .orange : .blue)
    }

    /// "5h" / "2d" / "12m" / "<1m" — bare magnitude of the distance from `now`,
    /// for compact list-row labels like "Due in 5h" or "Pickup 12m late".
    func compactMagnitude(now: Date = Date()) -> String {
        let absSec = Swift.abs(Int(self.timeIntervalSince(now).rounded()))
        if absSec >= 86_400 { return "\(absSec / 86_400)d" }
        if absSec >= 3_600 { return "\(absSec / 3_600)h" }
        if absSec >= 60 { return "\(absSec / 60)m" }
        return "<1m"
    }

    /// "2 days 3 hours" / "5 hours 12 minutes" / "8 minutes" / "less than a minute"
    /// — matches `formatExplicitDuration` on the web.
    private static func explicitDuration(seconds: TimeInterval) -> String {
        let abs = Swift.abs(Int(seconds.rounded()))
        let days = abs / 86_400
        let hours = (abs % 86_400) / 3_600
        let minutes = (abs % 3_600) / 60

        if days > 0 {
            var parts = ["\(days) \(days == 1 ? "day" : "days")"]
            if hours > 0 { parts.append("\(hours) \(hours == 1 ? "hour" : "hours")") }
            return parts.joined(separator: " ")
        }
        if hours > 0 {
            var parts = ["\(hours) \(hours == 1 ? "hour" : "hours")"]
            if minutes > 0 { parts.append("\(minutes) \(minutes == 1 ? "minute" : "minutes")") }
            return parts.joined(separator: " ")
        }
        if minutes > 0 { return "\(minutes) \(minutes == 1 ? "minute" : "minutes")" }
        return "less than a minute"
    }
}
