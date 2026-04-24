import Foundation

// MARK: - Auth

struct CurrentUser: Codable, Identifiable, Equatable {
    let id: String
    let name: String
    let email: String
    let role: String
    let avatarUrl: String?
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
        case .pendingPickup: "Pending Pickup"
        case .open: "Open"
        case .completed: "Completed"
        case .cancelled: "Cancelled"
        case .unknown: "Unknown"
        }
    }

    var color: String {
        switch self {
        case .draft: "gray"
        case .booked: "blue"
        case .pendingPickup: "orange"
        case .open: "green"
        case .completed: "secondary"
        case .cancelled: "red"
        case .unknown: "gray"
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
}

struct BookingBulkItem: Codable, Identifiable {
    let id: String
    let plannedQuantity: Int
    let checkedOutQuantity: Int
    let checkedInQuantity: Int
    let bulkSku: BulkSku
}

struct BookingEvent: Codable, Identifiable {
    let id: String
    let summary: String?
    let sportCode: String?
    let opponent: String?
    let isHome: Bool?
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
}

struct BookingStub: Codable { let id: String }

// MARK: - Users

struct AppUser: Codable, Identifiable {
    let id: String
    let name: String
    let email: String
    let role: String
    let location: String?
    let avatarUrl: String?
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
