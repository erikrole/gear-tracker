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
