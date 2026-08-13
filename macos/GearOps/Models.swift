import Foundation

struct GearOpsUser: Codable, Equatable, Identifiable, Sendable {
    let id: String
    let name: String
    let email: String
    let role: String
    let forcePasswordChange: Bool

    enum CodingKeys: String, CodingKey {
        case id
        case name
        case email
        case role
        case forcePasswordChange
    }

    init(
        id: String,
        name: String,
        email: String,
        role: String,
        forcePasswordChange: Bool = false
    ) {
        self.id = id
        self.name = name
        self.email = email
        self.role = role
        self.forcePasswordChange = forcePasswordChange
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        name = try container.decode(String.self, forKey: .name)
        email = try container.decode(String.self, forKey: .email)
        role = try container.decode(String.self, forKey: .role)
        forcePasswordChange = try container.decodeIfPresent(Bool.self, forKey: .forcePasswordChange) ?? false
    }
}

struct GearOpsStats: Codable, Equatable, Sendable {
    let checkedOut: Int
    let overdue: Int
    let reserved: Int
    let dueToday: Int
}

struct DashboardStatsPayload: Codable, Equatable, Sendable {
    let role: String
    let stats: GearOpsStats
    let overdueCount: Int
    let pendingPickupTotal: Int

    enum CodingKeys: String, CodingKey {
        case role
        case stats
        case overdueCount
        case pendingPickupTotal
    }

    init(role: String, stats: GearOpsStats, overdueCount: Int, pendingPickupTotal: Int) {
        self.role = role
        self.stats = stats
        self.overdueCount = overdueCount
        self.pendingPickupTotal = pendingPickupTotal
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        role = try container.decode(String.self, forKey: .role)
        stats = try container.decode(GearOpsStats.self, forKey: .stats)
        overdueCount = try container.decodeIfPresent(Int.self, forKey: .overdueCount) ?? stats.overdue
        pendingPickupTotal = try container.decodeIfPresent(Int.self, forKey: .pendingPickupTotal) ?? 0
    }
}

struct DashboardStatsEnvelope: Codable, Equatable, Sendable {
    let data: DashboardStatsPayload
    let partialFailures: [String]

    enum CodingKeys: String, CodingKey {
        case data
        case partialFailures
    }

    init(data: DashboardStatsPayload, partialFailures: [String] = []) {
        self.data = data
        self.partialFailures = partialFailures
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        data = try container.decode(DashboardStatsPayload.self, forKey: .data)
        partialFailures = try container.decodeIfPresent([String].self, forKey: .partialFailures) ?? []
    }
}

struct KioskDevice: Codable, Equatable, Identifiable, Sendable {
    struct Location: Codable, Equatable, Sendable {
        let id: String
        let name: String
    }

    let id: String
    let name: String
    let location: Location
    let active: Bool
    let activated: Bool
    let lastSeenAt: Date?
    let appVersion: String?
    let appBuild: String?
    let osVersion: String?
    let deviceModel: String?
    let pendingPickupCount: Int
    let openCheckoutCount: Int
}

struct GearOpsSnapshot: Codable, Equatable, Sendable {
    let stats: GearOpsStats
    let pendingPickupTotal: Int
    let receivedAt: Date
    let partialFailures: [String]

    func freshnessLabel(at now: Date = .now) -> String {
        let age = max(0, now.timeIntervalSince(receivedAt))
        if age < 60 { return "Updated just now" }
        if age < 60 * 60 { return "Updated \(Int(age / 60))m ago" }
        if age < 24 * 60 * 60 { return "Updated \(Int(age / (60 * 60)))h ago" }
        return "Updated \(Int(age / (24 * 60 * 60)))d ago"
    }
}

struct OpenBooking: Codable, Equatable, Identifiable, Sendable {
    struct Person: Codable, Equatable, Sendable {
        let id: String
        let name: String
        let avatarUrl: String?
    }

    struct Location: Codable, Equatable, Sendable {
        let id: String
        let name: String
    }

    struct ItemReference: Codable, Equatable, Identifiable, Sendable {
        let id: String
    }

    let id: String
    let title: String
    let endsAt: Date
    let refNumber: String?
    let requester: Person
    let location: Location
    let serializedItems: [ItemReference]
    let bulkItems: [ItemReference]

    var itemCount: Int { serializedItems.count + bulkItems.count }
    func isOverdue(at now: Date = .now) -> Bool { endsAt < now }
}

struct OpenBookingsPage: Decodable, Sendable {
    let data: [OpenBooking]
    let total: Int
    let limit: Int
    let offset: Int
}

struct OpenBookingsResult: Equatable, Sendable {
    let bookings: [OpenBooking]
    let total: Int
}

enum BookingKind: String, Codable, Equatable, Sendable {
    case checkout = "CHECKOUT"
    case reservation = "RESERVATION"
}

enum BookingStatus: String, Codable, Equatable, Sendable {
    case draft = "DRAFT"
    case booked = "BOOKED"
    case pendingPickup = "PENDING_PICKUP"
    case open = "OPEN"
    case completed = "COMPLETED"
    case cancelled = "CANCELLED"
}

struct BookingActivitySnapshot: Codable, Equatable, Identifiable, Sendable {
    let id: String
    let title: String
    let kind: BookingKind
    let status: BookingStatus
    let startsAt: Date
    let endsAt: Date
    let updatedAt: Date
    let requester: OpenBooking.Person
    let location: OpenBooking.Location

    func isWaitingForPickup(at now: Date = .now) -> Bool {
        status == .pendingPickup || (kind == .reservation && status == .booked && startsAt <= now)
    }
}

struct BookingActivityPage: Decodable, Sendable {
    let data: [BookingActivitySnapshot]
    let total: Int
    let limit: Int
    let offset: Int
}

struct BookingActivityEnvelope: Decodable, Sendable {
    let data: BookingActivitySnapshot
}

struct BookingChanges: Codable, Equatable, Sendable {
    let cursor: String
    let changedBookingIds: [String]
}

struct BookingChangesEnvelope: Decodable, Sendable {
    let data: BookingChanges
}

struct CompanionProjection: Codable, Equatable, Sendable {
    let version: Int
    let revision: Int?
    let generatedAt: Date
    let stats: GearOpsStats
    let pendingPickupTotal: Int
    let openBookings: [OpenBooking]
    let bookingActivity: [BookingActivitySnapshot]
    let kioskDevices: [KioskDevice]
    let kioskAccess: String
}

struct CompanionProjectionEnvelope: Decodable, Sendable {
    let data: CompanionProjection
}

struct LoginResponse: Decodable, Sendable {
    let user: GearOpsUser
    let companionToken: String
    let companionProjection: CompanionProjection
}

struct MeResponse: Decodable, Sendable {
    let user: GearOpsUser
}

struct KioskDevicesResponse: Decodable, Sendable {
    let data: [KioskDevice]
}

struct ServerErrorResponse: Decodable, Sendable {
    let error: String
}
