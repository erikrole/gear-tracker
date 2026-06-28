import Foundation

// MARK: - Auth

struct CurrentUser: Codable, Identifiable, Equatable {
    let id: String
    let name: String
    let email: String
    let role: String
    let avatarUrl: String?
    let forcePasswordChange: Bool

    enum CodingKeys: String, CodingKey {
        case id
        case name
        case email
        case role
        case avatarUrl
        case forcePasswordChange
    }

    init(
        id: String,
        name: String,
        email: String,
        role: String,
        avatarUrl: String?,
        forcePasswordChange: Bool = false
    ) {
        self.id = id
        self.name = name
        self.email = email
        self.role = role
        self.avatarUrl = avatarUrl
        self.forcePasswordChange = forcePasswordChange
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        name = try container.decode(String.self, forKey: .name)
        email = try container.decode(String.self, forKey: .email)
        role = try container.decode(String.self, forKey: .role)
        avatarUrl = try container.decodeIfPresent(String.self, forKey: .avatarUrl)
        forcePasswordChange = try container.decodeIfPresent(Bool.self, forKey: .forcePasswordChange) ?? false
    }
}

// MARK: - Notification preferences

/// Mirrors `/api/me/notification-preferences`. `pausedUntil` is an ISO-8601
/// string (server validates `z.string().datetime({ offset: true })`); `nil`
/// means not paused.
///
/// The PUT schema requires the `pausedUntil` KEY to be present (nullable, not
/// optional), so `encode(to:)` writes an explicit `null` instead of the
/// synthesized encodeIfPresent omission — omitting the key 400s every save.
/// `badges`/`categories` are round-tripped untouched so a save from iOS
/// doesn't reset preferences the user customized on web (the server defaults
/// any missing field to true).
struct NotificationPreferences: Codable, Equatable {
    var pausedUntil: String?
    var channels: Channels
    var badges: Bool? = nil
    var categories: Categories? = nil

    struct Channels: Codable, Equatable {
        var email: Bool
        var push: Bool
    }

    struct Categories: Codable, Equatable {
        var checkoutDue: Bool
        var checkoutOverdue: Bool
        var reservation: Bool
        var licenseExpiry: Bool
        var schedule: Bool
        var trade: Bool
        var gearPrep: Bool
    }

    enum CodingKeys: String, CodingKey {
        case pausedUntil, channels, badges, categories
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(pausedUntil, forKey: .pausedUntil) // explicit null when nil
        try container.encode(channels, forKey: .channels)
        try container.encodeIfPresent(badges, forKey: .badges)
        try container.encodeIfPresent(categories, forKey: .categories)
    }
}

// MARK: - Bookings

enum BookingStatus: String, Codable {
    case draft = "DRAFT"
    case booked = "BOOKED"
    case pendingPickup = "PENDING_PICKUP"
    case open = "OPEN"
    case completed = "COMPLETED"
    case cancelled = "CANCELLED"
    case unknown = "UNKNOWN"

    init(from decoder: Decoder) throws {
        let val = try decoder.singleValueContainer().decode(String.self)
        self = BookingStatus(rawValue: val) ?? .unknown
    }

    var label: String {
        switch self {
        case .draft: "Draft"
        case .booked: "Booked"
        case .pendingPickup: "Awaiting Pickup"
        case .open: "Checked Out"
        case .completed: "Completed"
        case .cancelled: "Cancelled"
        case .unknown: "Unknown"
        }
    }

}

enum BookingKind: String, Codable {
    case reservation = "RESERVATION"
    case checkout = "CHECKOUT"
    case unknown = "UNKNOWN"

    init(from decoder: Decoder) throws {
        let val = try decoder.singleValueContainer().decode(String.self)
        self = BookingKind(rawValue: val) ?? .unknown
    }
}

struct BookingUser: Codable, Identifiable {
    let id: String
    let name: String
    let email: String
    let avatarUrl: String?
}

struct BookingLocation: Codable, Identifiable {
    let id: String
    let name: String
}

struct BookingAsset: Codable, Identifiable {
    let id: String
    let assetTag: String?
    let brand: String?
    let model: String?
    let serialNumber: String?
    let imageUrl: String?
}

struct BookingSerializedItem: Codable, Identifiable {
    let id: String
    let assetId: String
    let allocationStatus: String?
    let asset: BookingAsset
}

struct BulkSku: Codable, Identifiable {
    let id: String
    let name: String
    let unit: String?
    let imageUrl: String?
    let trackByNumber: Bool?
}

/// One numbered unit (e.g. battery #19) allocated to a bulk line item. Present
/// only for unit-tracked SKUs; mirrors the web `unitAllocations[].bulkSkuUnit`.
struct BookingBulkUnitAllocation: Codable {
    let bulkSkuUnit: BulkSkuUnitRef

    struct BulkSkuUnitRef: Codable {
        let unitNumber: Int
    }
}

struct BookingBulkItem: Codable, Identifiable {
    let id: String
    let plannedQuantity: Int
    let checkedOutQuantity: Int
    let checkedInQuantity: Int
    let bulkSku: BulkSku
    let unitAllocations: [BookingBulkUnitAllocation]?

    /// Sorted unit numbers when this is a unit-tracked SKU with allocations.
    var assignedUnitNumbers: [Int] {
        guard bulkSku.trackByNumber == true else { return [] }
        return (unitAllocations ?? []).map(\.bulkSkuUnit.unitNumber).sorted()
    }
}

struct BookingEvent: Codable, Identifiable {
    let id: String
    let summary: String?
    let sportCode: String?
    let opponent: String?
    let isHome: Bool?
}

/// The kiosk device that handled pickup. Captured at kiosk custody transitions;
/// its location is the context for future return-to-location suggestions.
struct PickupKioskDevice: Codable, Identifiable {
    let id: String
    let name: String
    let location: BookingLocation
}

struct Booking: Codable, Identifiable, Hashable {
    static func == (lhs: Booking, rhs: Booking) -> Bool { lhs.id == rhs.id }
    func hash(into hasher: inout Hasher) { hasher.combine(id) }

    let id: String
    let kind: BookingKind
    let title: String
    let status: BookingStatus
    let startsAt: Date
    let endsAt: Date
    let notes: String?
    let refNumber: String?
    let requester: BookingUser
    let location: BookingLocation
    let serializedItems: [BookingSerializedItem]
    let bulkItems: [BookingBulkItem]
    let event: BookingEvent?
    let updatedAt: Date?
    let pickupKioskDevice: PickupKioskDevice?
}

struct BookingStub: Codable { let id: String }

/// A scheduling conflict surfaced by `/api/availability/check`: another booking
/// holds `assetId` during the requested window. Server enforcement at
/// create/checkout is authoritative — this is a non-blocking preflight hint.
struct AssetConflict: Decodable {
    let assetId: String
    let conflictingBookingTitle: String?
}

// MARK: - Users

struct AppUser: Codable, Identifiable {
    let id: String
    let name: String
    let email: String
    let role: String
    let location: String?
    let avatarUrl: String?
    let primaryArea: String?
    let title: String?
    let active: Bool?
    let gradYear: Int?
    let studentYearOverride: String?
}

struct AppUserDetail: Codable, Identifiable {
    let id: String
    let name: String
    let email: String
    let role: String
    let locationId: String?
    let location: String?
    let phone: String?
    let primaryArea: String?
    let avatarUrl: String?
    let active: Bool
    let createdAt: String?
}

struct BadgeProfile: Codable {
    let userId: String
    let peerVisible: Bool
    let earnedCount: Int
    let totalCount: Int
    let badges: [UserBadge]
    let disabled: Bool?

    var earnedBadges: [UserBadge] {
        badges.filter(\.earned)
    }
}

struct UserBadge: Codable, Identifiable {
    let id: String
    let key: String
    let name: String
    let description: String
    let icon: String
    let category: String
    let kind: String
    let trigger: String
    let threshold: Int?
    let ruleKey: String?
    let active: Bool
    let sortOrder: Int
    let earned: Bool
    let awardedAt: String?
    let source: String?
    let note: String?
    let progressCurrent: Int?
    let progressTarget: Int?
}

// MARK: - Reports

struct OverdueBookingSummary: Codable, Identifiable {
    let id: String
    let title: String
    let endsAt: String
    let overdueHours: Int
    let location: String
    let itemCount: Int
    let items: [String]
}

struct OverdueLeaderboardEntry: Codable, Identifiable {
    let userId: String
    let name: String
    let overdueCount: Int
    let totalOverdueHours: Int
    let bookings: [OverdueBookingSummary]?
    var id: String { userId }
}

struct OverdueReport: Codable {
    let totalOverdueBookings: Int
    let leaderboard: [OverdueLeaderboardEntry]
}

// MARK: - API Responses

struct PaginatedResponse<T: Codable>: Codable {
    let data: [T]
    let total: Int
    let limit: Int
    let offset: Int
}

struct APIResponse<T: Codable>: Codable {
    let data: T?
    let error: String?
}
