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
