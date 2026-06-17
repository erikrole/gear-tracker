import Foundation

// MARK: - Calendar Events

struct ScheduleEvent: Codable, Identifiable {
    let id: String
    let summary: String
    let startsAt: Date
    let endsAt: Date
    let allDay: Bool
    let status: String
    let sportCode: String?
    let opponent: String?
    let isHome: Bool?
    let location: EventLocation?
    /// Crew coverage from `/api/calendar-events`. nil when the event has no
    /// (non-archived) shift group; lets the list show fill without drilling in.
    /// `var` (not `let = nil`) so it actually decodes — an immutable property with
    /// an initial value is skipped by synthesized Decodable. Optional `var` still
    /// defaults to nil in the memberwise init, so dashboard event seeds that don't
    /// supply coverage keep compiling.
    var coverage: ShiftCoverage?
}

struct EventLocation: Codable, Identifiable {
    let id: String
    let name: String
}

// MARK: - Multi-day spans

extension ScheduleEvent {
    /// All-day events are stored as UTC-midnight boundaries (calendar *dates*,
    /// not instants), so their covered days must be read in UTC — matching the
    /// web (`calendar-event-dates.ts`). Reading them with the device's local
    /// calendar shifts them by the timezone offset and produces off-by-one day
    /// counts and wrong date-header placement on any non-UTC device.
    private var dayComponentsCalendar: Calendar {
        guard allDay else { return .current }
        var cal = Calendar(identifier: .gregorian)
        if let utc = TimeZone(identifier: "UTC") { cal.timeZone = utc }
        return cal
    }

    var displayAllDay: Bool {
        allDay || hasLocalMidnightSpan
    }

    /// Heuristic for *timed* events whose start and end land exactly on local
    /// midnight (so they should display like all-day). True all-day events take
    /// the `allDay` flag path above and are handled in UTC.
    private var hasLocalMidnightSpan: Bool {
        guard !allDay, endsAt > startsAt else { return false }
        let calendar = Calendar.current
        let startOfStartDay = calendar.startOfDay(for: startsAt)
        let startOfEndDay = calendar.startOfDay(for: endsAt)
        guard startOfEndDay > startOfStartDay else { return false }
        return abs(startsAt.timeIntervalSince(startOfStartDay)) < 60 &&
            abs(endsAt.timeIntervalSince(startOfEndDay)) < 60
    }

    /// The reference end instant for span math. All-day / midnight-span events
    /// carry an *exclusive* end (next-midnight), so step back a second to land
    /// on the true last day.
    private var spanEndDate: Date {
        displayAllDay ? endsAt.addingTimeInterval(-1) : endsAt
    }

    /// The local-midnight `Date` for a given instant's calendar day — read in
    /// UTC for all-day events, locally otherwise. Returning local-midnight keeps
    /// grouping keys and the (locally-formatted) date headers consistent across
    /// all-day and timed events that fall on the same day.
    private func displayDay(for instant: Date) -> Date {
        let comps = dayComponentsCalendar.dateComponents([.year, .month, .day], from: instant)
        return Calendar.current.date(from: DateComponents(
            year: comps.year, month: comps.month, day: comps.day
        )) ?? Calendar.current.startOfDay(for: instant)
    }

    /// True when the event covers more than one calendar day.
    var isMultiDay: Bool {
        displayDay(for: startsAt) != displayDay(for: spanEndDate)
    }

    /// Local start-of-day for every calendar day the event covers, inclusive.
    /// Single-day events return just their start day.
    var spannedDays: [Date] {
        let cal = Calendar.current
        let start = displayDay(for: startsAt)
        let end = displayDay(for: spanEndDate)
        guard end > start else { return [start] }
        var days: [Date] = []
        var cursor = start
        while cursor <= end {
            days.append(cursor)
            guard let next = cal.date(byAdding: .day, value: 1, to: cursor) else { break }
            cursor = next
        }
        return days
    }

    var dayCount: Int { spannedDays.count }

    /// 1-based position of `day` within the span (for "Day n of m"); nil if the
    /// day isn't part of the span.
    func dayIndex(for day: Date) -> Int? {
        let cal = Calendar.current
        return spannedDays.firstIndex { cal.isDate($0, inSameDayAs: day) }.map { $0 + 1 }
    }
}

// MARK: - My Shifts

struct MyShift: Codable, Identifiable {
    let id: String
    let area: String
    let workerType: String
    let startsAt: Date
    let endsAt: Date
    let status: String
    let event: MyShiftEvent
    let gear: ShiftGear
}

struct MyShiftEvent: Codable {
    let id: String
    let summary: String
    let startsAt: Date
    let endsAt: Date
    let sportCode: String?
    let isHome: Bool?
    let opponent: String?
    let locationName: String?
}

struct ShiftGear: Codable {
    let status: String
    let bookings: [ShiftGearBooking]

    var hasGear: Bool { status != "none" }
    var gearLabel: String {
        switch status {
        case "checked_out": return "Gear out"
        case "pickup_ready": return "Gear ready"
        case "reserved":    return "Gear reserved"
        case "draft":       return "Gear draft"
        default:            return "No gear"
        }
    }
}

struct ShiftGearBooking: Codable, Identifiable {
    let id: String
    let status: String
    let kind: String
    let itemCount: Int
}

// MARK: - Shift Group Detail (for event detail sheet)

struct EventShiftGroup: Codable, Identifiable {
    let id: String
    let eventId: String
    let isPremier: Bool
    let notes: String?
    let event: ShiftGroupEvent
    let shifts: [EventShift]
    let coverage: ShiftCoverage
}

struct ShiftGroupEvent: Codable, Identifiable {
    let id: String
    let summary: String
    let startsAt: Date
    let endsAt: Date
    let sportCode: String?
    let isHome: Bool?
    let opponent: String?
    let locationId: String?
}

struct EventShift: Codable, Identifiable {
    let id: String
    let area: String
    let workerType: String
    let startsAt: Date
    let endsAt: Date
    let notes: String?
    let assignments: [ShiftAssignmentRecord]

    var isOpen: Bool { assignments.isEmpty }
}

struct ShiftAssignmentRecord: Codable, Identifiable {
    let id: String
    let status: String
    let user: ShiftWorker
}

struct ShiftWorker: Codable, Identifiable {
    let id: String
    let name: String
    let primaryArea: String?
    let avatarUrl: String?
}

// MARK: - Sport Roster

struct RosterEntry: Codable, Identifiable {
    let id: String
    let userId: String
    let sportCode: String
    let user: RosterUser
}

struct RosterUser: Codable, Identifiable {
    let id: String
    let name: String
    let email: String
    let role: String
    let primaryArea: String?
}

struct ShiftCoverage: Codable {
    let total: Int
    let filled: Int
    let percentage: Int
}

// MARK: - Response Wrappers

struct ScheduleEventsResponse: Decodable {
    let data: [ScheduleEvent]
    let total: Int
}

struct MyShiftsResponse: Decodable {
    let data: [MyShift]
}

// MARK: - Availability blocks

/// An unavailability window (usually a class) that warns staff during shift
/// assignment. `startsAt`/`endsAt` are local wall-clock "HH:mm"; `dayOfWeek`
/// is 0 = Sunday … 6 = Saturday and is nil for AD_HOC (single-date) blocks,
/// which the web profile can create — a required Int here would fail the
/// whole availability decode the moment one exists.
struct AvailabilityBlock: Codable, Identifiable {
    let id: String
    let kind: String?
    let dayOfWeek: Int?
    let startsAt: String
    let endsAt: String
    let label: String?
    let semesterLabel: String?
}

struct AvailabilityBlocksResponse: Decodable {
    let data: [AvailabilityBlock]
}

struct ShiftGroupsResponse: Decodable {
    let data: [EventShiftGroup]
    let total: Int
}

// MARK: - Helpers

let SPORT_LABELS: [String: String] = [
    "MBB": "Men's Basketball",
    "MXC": "Men's Cross Country",
    "FB":  "Football",
    "MGOLF": "Men's Golf",
    "MHKY": "Men's Hockey",
    "MROW": "Men's Rowing",
    "MSOC": "Men's Soccer",
    "MSWIM": "Men's Swimming & Diving",
    "MTEN": "Men's Tennis",
    "MTRACK": "Men's Track & Field",
    "WRES": "Wrestling",
    "WBB": "Women's Basketball",
    "WXC": "Women's Cross Country",
    "WGOLF": "Women's Golf",
    "WHKY": "Women's Hockey",
    "LROW": "Lightweight Rowing",
    "WROW": "Women's Rowing",
    "WSOC": "Women's Soccer",
    "SB":  "Softball",
    "WSWIM": "Women's Swimming & Diving",
    "WTEN": "Women's Tennis",
    "WTRACK": "Women's Track & Field",
    "VB":  "Volleyball",
]

func sportLabel(_ code: String?) -> String? {
    guard let code else { return nil }
    return SPORT_LABELS[code] ?? code
}

func scheduleEventDisplayTitle(_ event: ScheduleEvent) -> String {
    if let opponent = event.opponent, !opponent.isEmpty {
        var parts: [String] = []
        if let code = event.sportCode {
            parts.append(sportLabel(code) ?? code)
        }
        switch event.isHome {
        case true:  parts.append("vs \(opponent)")
        case false: parts.append("at \(opponent)")
        case nil:   parts.append("- \(opponent)")
        }
        return parts.joined(separator: " ")
    }

    let title = cleanScheduleEventSummary(event.summary)
    if !title.isEmpty { return title }
    if let code = event.sportCode { return sportLabel(code) ?? code }
    return "Event"
}

func cleanScheduleEventSummary(_ raw: String) -> String {
    var s = raw
    // Strip leading home/away bracket: [W], [L], [H], [A], [N], etc.
    s = s.replacingOccurrences(of: #"^\[[A-Za-z]\]\s*"#, with: "", options: .regularExpression)
    // Strip "Wisconsin Badgers " or "Wisconsin " team prefix.
    s = s.replacingOccurrences(of: #"^Wisconsin Badgers\s+"#, with: "", options: .regularExpression)
    s = s.replacingOccurrences(of: #"^Wisconsin\s+"#, with: "", options: .regularExpression)
    // Strip trailing annotation like " (VIDEO)".
    s = s.replacingOccurrences(of: #"\s+\([A-Z]+\)$"#, with: "", options: .regularExpression)
    // Collapse extra whitespace.
    return s.components(separatedBy: .whitespaces).filter { !$0.isEmpty }.joined(separator: " ")
}

// MARK: - Shift area label

extension String {
    /// Title-cased label for a server-typed shift area code.
    /// `"VIDEO"` → `"Video"`, `"GRAPHICS"` → `"Graphics"`. Mirrors the labels
    /// in `ShiftAreaOption` (the picker enum in `AddShiftSheet.swift`) so
    /// every user-visible surface speaks the same name. Falls back to
    /// `.capitalized` for any future server-side area codes.
    var shiftAreaLabel: String {
        switch self {
        case "VIDEO":    return "Video"
        case "PHOTO":    return "Photo"
        case "GRAPHICS": return "Graphics"
        case "COMMS":    return "Comms"
        default:         return capitalized
        }
    }
}
