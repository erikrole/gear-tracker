import Foundation

struct DashboardStats: Codable {
    let checkedOut: Int
    let overdue: Int
    let reserved: Int
    let dueToday: Int
}

struct BookingSummary: Codable, Identifiable, Hashable {
    let id: String
    let kind: BookingKind
    let title: String
    let refNumber: String?
    let sportCode: String?
    let requesterName: String
    let requesterInitials: String
    let requesterAvatarUrl: String?
    let locationName: String?
    let startsAt: Date
    let endsAt: Date
    let itemCount: Int
    let status: BookingStatus
    let isOverdue: Bool

    static func == (lhs: BookingSummary, rhs: BookingSummary) -> Bool { lhs.id == rhs.id }
    func hash(into hasher: inout Hasher) { hasher.combine(id) }
}

struct CheckoutGroup: Codable {
    let total: Int
    let overdue: Int
    let items: [BookingSummary]
}

struct ReservationGroup: Codable {
    let total: Int
    let items: [BookingSummary]
}

struct DashboardShiftEvent: Codable {
    let id: String
    let summary: String
    let startsAt: Date
    let sportCode: String?
    let locationName: String?
}

struct DashboardShift: Codable, Identifiable {
    let id: String
    let area: String
    let workerType: String
    let startsAt: Date
    let endsAt: Date
    let event: DashboardShiftEvent
    let gearStatus: String
    let gearItemCount: Int

    var gearLabel: String {
        switch gearStatus {
        case "checked_out": return "Gear out"
        case "reserved":    return "Gear reserved"
        case "draft":       return "Gear draft"
        default:            return ""
        }
    }
    var hasGear: Bool { gearStatus != "none" }
}

struct DashboardUpcomingEvent: Codable, Identifiable {
    let id: String
    let title: String
    let sportCode: String?
    let startsAt: Date
    let endsAt: Date
    let allDay: Bool
    let location: String?
    let locationId: String?
    let opponent: String?
    let isHome: Bool?
    let totalShiftSlots: Int
    let filledShiftSlots: Int

    var coverageLabel: String { "\(filledShiftSlots)/\(totalShiftSlots)" }
    var coveragePct: Int { totalShiftSlots > 0 ? (filledShiftSlots * 100 / totalShiftSlots) : 0 }
}

struct DashboardOverdueItem: Codable, Identifiable, Hashable {
    let bookingId: String
    let bookingTitle: String
    let requesterName: String
    let requesterInitials: String
    let requesterAvatarUrl: String?
    let endsAt: Date

    var id: String { bookingId }
}

struct DashboardData: Codable {
    let role: String
    let stats: DashboardStats
    let myCheckouts: CheckoutGroup
    let teamCheckouts: CheckoutGroup
    let teamReservations: ReservationGroup
    let overdueCount: Int
    let overdueItems: [DashboardOverdueItem]
    let myShifts: [DashboardShift]
    let upcomingEvents: [DashboardUpcomingEvent]
}

// MARK: - Schedule bridges

extension DashboardUpcomingEvent {
    /// Convert to ScheduleEvent so EventDetailSheet can be presented from the dashboard.
    var asScheduleEvent: ScheduleEvent {
        ScheduleEvent(
            id: id,
            summary: title,
            startsAt: startsAt,
            endsAt: endsAt,
            allDay: allDay,
            status: "CONFIRMED",
            sportCode: sportCode,
            opponent: opponent,
            isHome: isHome,
            location: locationId.map { EventLocation(id: $0, name: location ?? "") }
        )
    }
}

extension DashboardShift {
    /// Convert the shift's event to ScheduleEvent so EventDetailSheet can be presented.
    /// Uses shift.endsAt as a proxy for event end time (close enough for the detail view to load).
    var asScheduleEvent: ScheduleEvent {
        ScheduleEvent(
            id: event.id,
            summary: event.summary,
            startsAt: event.startsAt,
            endsAt: endsAt,
            allDay: false,
            status: "CONFIRMED",
            sportCode: event.sportCode,
            opponent: nil,
            isHome: nil,
            location: nil
        )
    }
}

/// Lightweight payload from `/api/dashboard/stats`. Used by AppState to refresh
/// badges without re-running the heavy `/api/dashboard` query.
struct DashboardStatsPayload: Codable {
    let role: String
    let stats: DashboardStats
    let overdueCount: Int
    let myShiftsCount: Int
}
