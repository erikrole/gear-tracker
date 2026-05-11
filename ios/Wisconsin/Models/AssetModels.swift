import Foundation

enum AssetComputedStatus: String, Codable {
    case available = "AVAILABLE"
    case checkedOut = "CHECKED_OUT"
    case pendingPickup = "PENDING_PICKUP"
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
        case .pendingPickup: "Awaiting Pickup"
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
    let status: String?
    let title: String
    let requesterName: String
    let startsAt: Date?
    let endsAt: Date

    var isOverdue: Bool { endsAt < Date.now }
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

    /// Returns a copy with `isFavorited` overridden. Asset is immutable; this is the
    /// single source of truth for partial mutation (used by optimistic favorite toggle).
    func withFavorited(_ value: Bool) -> Asset {
        Asset(
            id: id, assetTag: assetTag, name: name, brand: brand, model: model,
            serialNumber: serialNumber, imageUrl: imageUrl, computedStatus: computedStatus,
            location: location, category: category, department: department,
            activeBooking: activeBooking, purchaseDate: purchaseDate,
            purchasePrice: purchasePrice, residualValue: residualValue,
            isFavorited: value
        )
    }
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

/// Compact link to a parent asset — the gear this accessory is attached to
/// (e.g., the camera body that owns this charger). Mirrors the `parentAsset`
/// field on `/api/assets/[id]`.
struct AssetParentLink: Codable, Hashable {
    let id: String
    let assetTag: String
    let name: String?
    let brand: String
    let model: String

    var displayName: String { [brand, model].joined(separator: " ") }
}

/// One accessory hanging off this asset — same shape the web detail page reads
/// from `/api/assets/[id]`'s `accessories` array. The `type` is the catalog
/// type (CAMERA / LENS / CABLE / etc.) so we can label children semantically.
struct AssetAccessory: Codable, Identifiable, Hashable {
    let id: String
    let assetTag: String
    let name: String?
    let brand: String
    let model: String
    let serialNumber: String
    let status: String
    let type: String
    let imageUrl: String?

    var displayName: String { [brand, model].joined(separator: " ") }
}

/// Free-form asset metadata parsed out of the legacy `notes` JSON column on
/// the server. iOS only decodes the fields the floor surface uses; ignore the
/// rest so future server additions don't break the build.
struct AssetMetadata: Codable, Hashable {
    let uwAssetTag: String?
}

struct AssetDetail: Codable, Identifiable, Hashable {
    let id: String
    let assetTag: String?
    let name: String?
    let brand: String
    let model: String
    let serialNumber: String?
    let imageUrl: String?
    let qrCodeValue: String?
    let linkUrl: String?
    let computedStatus: AssetComputedStatus
    let location: AssetLocation
    let category: AssetCategory?
    let department: AssetDepartment?
    let activeBooking: AssetActiveBooking?
    let upcomingReservations: [UpcomingReservation]
    let parentAsset: AssetParentLink?
    let accessories: [AssetAccessory]?
    let metadata: AssetMetadata?
    let purchaseDate: String?
    let purchasePrice: String?   // Prisma Decimal serializes as string
    let residualValue: String?
    let notes: String?
    let isFavorited: Bool

    var displayName: String { [brand, model].joined(separator: " ") }

    static func == (lhs: AssetDetail, rhs: AssetDetail) -> Bool { lhs.id == rhs.id }
    func hash(into hasher: inout Hasher) { hasher.combine(id) }

    /// Project the detail back into a regular `Asset` for surfaces (like
    /// `CreateBookingViewModel.prefillReservation(for:)`) that take the
    /// list-shape struct.
    var asAsset: Asset {
        Asset(
            id: id, assetTag: assetTag, name: name, brand: brand, model: model,
            serialNumber: serialNumber, imageUrl: imageUrl, computedStatus: computedStatus,
            location: location, category: category, department: department,
            activeBooking: activeBooking, purchaseDate: purchaseDate,
            purchasePrice: purchasePrice, residualValue: residualValue,
            isFavorited: isFavorited
        )
    }
}
