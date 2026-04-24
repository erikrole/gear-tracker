import Foundation

enum AssetComputedStatus: String, Codable {
    case available = "AVAILABLE"
    case checkedOut = "CHECKED_OUT"
    case reserved = "RESERVED"
    case maintenance = "MAINTENANCE"
    case retired = "RETIRED"
    case unknown = "UNKNOWN"

    init(from decoder: Decoder) throws {
        let val = try decoder.singleValueContainer().decode(String.self)
        self = AssetComputedStatus(rawValue: val) ?? .unknown
    }

    var label: String {
        switch self {
        case .available: "Available"
        case .checkedOut: "Checked Out"
        case .reserved: "Reserved"
        case .maintenance: "Maintenance"
        case .retired: "Retired"
        case .unknown: "Unknown"
        }
    }
}

struct AssetCategory: Codable, Identifiable {
    let id: String
    let name: String
}

struct AssetLocation: Codable, Identifiable {
    let id: String
    let name: String
}

struct AssetDepartment: Codable, Identifiable {
    let id: String
    let name: String
}

struct AssetActiveBooking: Codable {
    let id: String
    let kind: String
    let title: String
    let requesterName: String
    let isOverdue: Bool
    let endsAt: Date
}

struct Asset: Codable, Identifiable, Hashable {
    let id: String
    let assetTag: String?
    let name: String?
    let brand: String
    let model: String
    let serialNumber: String?
    let imageUrl: String?
    let computedStatus: AssetComputedStatus
    let location: AssetLocation
    let category: AssetCategory?
    let department: AssetDepartment?
    let activeBooking: AssetActiveBooking?
    let purchaseDate: String?
    let purchasePrice: String?   // Prisma Decimal serializes as string
    let residualValue: String?
    let isFavorited: Bool

    var purchasePriceDecimal: Double? { purchasePrice.flatMap(Double.init) }

    var displayName: String {
        [brand, model].joined(separator: " ")
    }

    static func == (lhs: Asset, rhs: Asset) -> Bool { lhs.id == rhs.id }
    func hash(into hasher: inout Hasher) { hasher.combine(id) }
}

struct AssetsResponse: Codable {
    let data: [Asset]
    let total: Int
    let limit: Int
    let offset: Int
}

// Asset detail — superset of Asset with history
struct UpcomingReservation: Codable, Identifiable {
    let bookingId: String
    let title: String
    let status: BookingStatus
    let startsAt: Date
    let endsAt: Date
    let requesterName: String

    var id: String { bookingId }
}

struct AssetDetail: Codable, Identifiable, Hashable {
    let id: String
    let assetTag: String?
    let name: String?
    let brand: String
    let model: String
    let serialNumber: String?
    let imageUrl: String?
    let computedStatus: AssetComputedStatus
    let location: AssetLocation
    let category: AssetCategory?
    let department: AssetDepartment?
    let activeBooking: AssetActiveBooking?
    let upcomingReservations: [UpcomingReservation]
    let purchaseDate: String?
    let purchasePrice: String?   // Prisma Decimal serializes as string
    let residualValue: String?
    let notes: String?
    let isFavorited: Bool

    var displayName: String { [brand, model].joined(separator: " ") }

    static func == (lhs: AssetDetail, rhs: AssetDetail) -> Bool { lhs.id == rhs.id }
    func hash(into hasher: inout Hasher) { hasher.combine(id) }
}
