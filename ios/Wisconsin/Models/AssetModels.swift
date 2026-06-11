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

struct AssetFamilySearchResult: Codable, Identifiable, Hashable {
    let id: String
    let kind: String
    let name: String
    let category: String
    let unit: String
    let trackByNumber: Bool
    let onHandQuantity: Int
    let availableQuantity: Int
    let checkedOutQuantity: Int
    let lostQuantity: Int
    let retiredQuantity: Int
    let matchedUnitNumber: Int?
    let matchedUnitStatus: String?
    let matchedUnitHolder: String?
    let matchedUnitDueAt: Date?
    let matchedUnitBookingTitle: String?
    let imageUrl: String?
    let locationName: String
    let locationId: String
    let categoryId: String?
    let departmentId: String?
    let departmentName: String?
    let binQrCodeValue: String

    var availabilityLabel: String {
        trackByNumber
            ? "\(availableQuantity) of \(onHandQuantity) units available"
            : "\(availableQuantity) \(unit) available"
    }

    var scannedUnitLabel: String? {
        guard let matchedUnitNumber else { return nil }
        let status = matchedUnitStatus?
            .lowercased()
            .replacingOccurrences(of: "_", with: " ")
            .capitalized
        if let status {
            return "Unit #\(matchedUnitNumber) · \(status)"
        }
        return "Unit #\(matchedUnitNumber)"
    }
}

struct AssetsResponse: Codable {
    let data: [Asset]
    let bulkItems: [AssetFamilySearchResult]
    let total: Int
    let limit: Int
    let offset: Int

    init(data: [Asset], bulkItems: [AssetFamilySearchResult], total: Int, limit: Int, offset: Int) {
        self.data = data
        self.bulkItems = bulkItems
        self.total = total
        self.limit = limit
        self.offset = offset
    }

    enum CodingKeys: String, CodingKey {
        case data, bulkItems, total, limit, offset
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        data = try container.decode([Asset].self, forKey: .data)
        bulkItems = try container.decodeIfPresent([AssetFamilySearchResult].self, forKey: .bulkItems) ?? []
        total = try container.decode(Int.self, forKey: .total)
        limit = try container.decode(Int.self, forKey: .limit)
        offset = try container.decode(Int.self, forKey: .offset)
    }
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
    // Nullable on the server (Asset.serialNumber String?) — a required field
    // here would fail the whole /api/assets/[id] decode for any asset whose
    // accessory has no serial.
    let serialNumber: String?
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

    init(from decoder: Decoder) throws {
        // Legacy notes JSON is arbitrary user data: `metadata` may not be an
        // object and `uwAssetTag` may not be a string. A type mismatch here
        // must degrade to nil, not fail the whole asset-detail decode.
        let container = try? decoder.container(keyedBy: CodingKeys.self)
        uwAssetTag = (try? container?.decodeIfPresent(String.self, forKey: .uwAssetTag)) ?? nil
    }
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
