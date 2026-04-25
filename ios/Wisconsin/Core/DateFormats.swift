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
