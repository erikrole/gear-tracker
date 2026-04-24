import Foundation
import SwiftData

// MARK: - Cached Models

@Model
final class CachedAsset {
    @Attribute(.unique) var id: String
    var assetTag: String?
    var name: String?
    var brand: String
    var model: String
    var serialNumber: String?
    var imageUrl: String?
    var computedStatus: String
    var locationId: String
    var locationName: String
    var categoryId: String?
    var categoryName: String?
    var isFavorited: Bool
    var cachedAt: Date

    init(
        id: String, assetTag: String?, name: String?, brand: String, model: String,
        serialNumber: String?, imageUrl: String?, computedStatus: String,
        locationId: String, locationName: String,
        categoryId: String?, categoryName: String?,
        isFavorited: Bool, cachedAt: Date = .now
    ) {
        self.id = id
        self.assetTag = assetTag
        self.name = name
        self.brand = brand
        self.model = model
        self.serialNumber = serialNumber
        self.imageUrl = imageUrl
        self.computedStatus = computedStatus
        self.locationId = locationId
        self.locationName = locationName
        self.categoryId = categoryId
        self.categoryName = categoryName
        self.isFavorited = isFavorited
        self.cachedAt = cachedAt
    }
}

@Model
final class CachedBooking {
    @Attribute(.unique) var id: String
    var kind: String
    var title: String
    var status: String
    var startsAt: Date
    var endsAt: Date
    var requesterName: String
    var locationName: String
    var cachedAt: Date

    init(
        id: String, kind: String, title: String, status: String,
        startsAt: Date, endsAt: Date,
        requesterName: String, locationName: String,
        cachedAt: Date = .now
    ) {
        self.id = id
        self.kind = kind
        self.title = title
        self.status = status
        self.startsAt = startsAt
        self.endsAt = endsAt
        self.requesterName = requesterName
        self.locationName = locationName
        self.cachedAt = cachedAt
    }
}

@Model
final class CachedScheduleEvent {
    @Attribute(.unique) var id: String
    var summary: String
    var startsAt: Date
    var endsAt: Date
    var allDay: Bool
    var sportCode: String?
    var opponent: String?
    var isHome: Bool?
    var locationName: String?
    var cachedAt: Date

    init(
        id: String, summary: String, startsAt: Date, endsAt: Date,
        allDay: Bool, sportCode: String?, opponent: String?,
        isHome: Bool?, locationName: String?,
        cachedAt: Date = .now
    ) {
        self.id = id
        self.summary = summary
        self.startsAt = startsAt
        self.endsAt = endsAt
        self.allDay = allDay
        self.sportCode = sportCode
        self.opponent = opponent
        self.isHome = isHome
        self.locationName = locationName
        self.cachedAt = cachedAt
    }
}

// MARK: - Conversion helpers

extension CachedAsset {
    var asAsset: Asset {
        Asset(
            id: id, assetTag: assetTag, name: name, brand: brand, model: model,
            serialNumber: serialNumber, imageUrl: imageUrl,
            computedStatus: AssetComputedStatus(rawValue: computedStatus) ?? .unknown,
            location: AssetLocation(id: locationId, name: locationName),
            category: categoryId.map { AssetCategory(id: $0, name: categoryName ?? "") },
            department: nil,
            activeBooking: nil,
            purchaseDate: nil, purchasePrice: nil, residualValue: nil,
            isFavorited: isFavorited
        )
    }
}

extension CachedBooking {
    var asBooking: Booking {
        Booking(
            id: id,
            kind: BookingKind(rawValue: kind) ?? .unknown,
            title: title,
            status: BookingStatus(rawValue: status) ?? .unknown,
            startsAt: startsAt,
            endsAt: endsAt,
            notes: nil,
            refNumber: nil,
            requester: BookingUser(id: "", name: requesterName, email: "", avatarUrl: nil),
            location: BookingLocation(id: "", name: locationName),
            serializedItems: [],
            bulkItems: [],
            event: nil
        )
    }
}

extension CachedScheduleEvent {
    var asScheduleEvent: ScheduleEvent {
        ScheduleEvent(
            id: id, summary: summary,
            startsAt: startsAt, endsAt: endsAt,
            allDay: allDay, status: "confirmed",
            sportCode: sportCode, opponent: opponent, isHome: isHome,
            location: locationName.map { EventLocation(id: "", name: $0) }
        )
    }
}

// MARK: - GearStore

@MainActor
final class GearStore {
    static let shared = GearStore()

    static let schema = Schema([CachedAsset.self, CachedBooking.self, CachedScheduleEvent.self])

    let container: ModelContainer
    private let context: ModelContext

    private init() {
        let config = ModelConfiguration("GearCache", schema: Self.schema)
        container = try! ModelContainer(for: Self.schema, configurations: config)
        context = ModelContext(container)
    }

    private static let maxAge: TimeInterval = 86_400 // 24 h

    // MARK: Assets

    func seedAssets(_ assets: [Asset]) {
        for asset in assets {
            if let existing = try? context.fetch(
                FetchDescriptor<CachedAsset>(predicate: #Predicate { $0.id == asset.id })
            ).first {
                existing.assetTag = asset.assetTag
                existing.name = asset.name
                existing.brand = asset.brand
                existing.model = asset.model
                existing.serialNumber = asset.serialNumber
                existing.imageUrl = asset.imageUrl
                existing.computedStatus = asset.computedStatus.rawValue
                existing.locationId = asset.location.id
                existing.locationName = asset.location.name
                existing.categoryId = asset.category?.id
                existing.categoryName = asset.category?.name
                existing.isFavorited = asset.isFavorited
                existing.cachedAt = .now
            } else {
                let cached = CachedAsset(
                    id: asset.id, assetTag: asset.assetTag, name: asset.name,
                    brand: asset.brand, model: asset.model,
                    serialNumber: asset.serialNumber, imageUrl: asset.imageUrl,
                    computedStatus: asset.computedStatus.rawValue,
                    locationId: asset.location.id, locationName: asset.location.name,
                    categoryId: asset.category?.id, categoryName: asset.category?.name,
                    isFavorited: asset.isFavorited
                )
                context.insert(cached)
            }
        }
        try? context.save()
    }

    func cachedAssets() -> [CachedAsset] {
        let cutoff = Date.now.addingTimeInterval(-Self.maxAge)
        var descriptor = FetchDescriptor<CachedAsset>(
            predicate: #Predicate { $0.cachedAt > cutoff },
            sortBy: [SortDescriptor(\.cachedAt, order: .reverse)]
        )
        descriptor.fetchLimit = 30
        return (try? context.fetch(descriptor)) ?? []
    }

    // MARK: Bookings

    func seedBookings(_ bookings: [Booking]) {
        for booking in bookings {
            if let existing = try? context.fetch(
                FetchDescriptor<CachedBooking>(predicate: #Predicate { $0.id == booking.id })
            ).first {
                existing.kind = booking.kind.rawValue
                existing.title = booking.title
                existing.status = booking.status.rawValue
                existing.startsAt = booking.startsAt
                existing.endsAt = booking.endsAt
                existing.requesterName = booking.requester.name
                existing.locationName = booking.location.name
                existing.cachedAt = .now
            } else {
                context.insert(CachedBooking(
                    id: booking.id, kind: booking.kind.rawValue, title: booking.title,
                    status: booking.status.rawValue, startsAt: booking.startsAt, endsAt: booking.endsAt,
                    requesterName: booking.requester.name, locationName: booking.location.name
                ))
            }
        }
        try? context.save()
    }

    func cachedBookings(kind: String) -> [CachedBooking] {
        let cutoff = Date.now.addingTimeInterval(-Self.maxAge)
        var descriptor = FetchDescriptor<CachedBooking>(
            predicate: #Predicate { $0.cachedAt > cutoff && $0.kind == kind },
            sortBy: [SortDescriptor(\.startsAt)]
        )
        descriptor.fetchLimit = 30
        return (try? context.fetch(descriptor)) ?? []
    }

    // MARK: Schedule Events

    func seedScheduleEvents(_ events: [ScheduleEvent]) {
        for event in events {
            if let existing = try? context.fetch(
                FetchDescriptor<CachedScheduleEvent>(predicate: #Predicate { $0.id == event.id })
            ).first {
                existing.summary = event.summary
                existing.startsAt = event.startsAt
                existing.endsAt = event.endsAt
                existing.allDay = event.allDay
                existing.sportCode = event.sportCode
                existing.opponent = event.opponent
                existing.isHome = event.isHome
                existing.locationName = event.location?.name
                existing.cachedAt = .now
            } else {
                context.insert(CachedScheduleEvent(
                    id: event.id, summary: event.summary,
                    startsAt: event.startsAt, endsAt: event.endsAt,
                    allDay: event.allDay, sportCode: event.sportCode,
                    opponent: event.opponent, isHome: event.isHome,
                    locationName: event.location?.name
                ))
            }
        }
        try? context.save()
    }

    func cachedScheduleEvents() -> [CachedScheduleEvent] {
        let cutoff = Date.now.addingTimeInterval(-Self.maxAge)
        var descriptor = FetchDescriptor<CachedScheduleEvent>(
            predicate: #Predicate { $0.cachedAt > cutoff },
            sortBy: [SortDescriptor(\.startsAt)]
        )
        descriptor.fetchLimit = 50
        return (try? context.fetch(descriptor)) ?? []
    }

    // MARK: Clear

    func clearAll() {
        try? context.delete(model: CachedAsset.self)
        try? context.delete(model: CachedBooking.self)
        try? context.delete(model: CachedScheduleEvent.self)
        try? context.save()
    }
}
