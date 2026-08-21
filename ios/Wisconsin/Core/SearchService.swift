import Foundation

/// The four places a query is answered from. Named so a partial result can say
/// which half of the answer is missing instead of quietly under-reporting.
enum SearchSource: String, CaseIterable {
    case items
    case reservations
    case checkouts
    case people

    var label: String {
        switch self {
        case .items: return "Items"
        case .reservations: return "Reservations"
        case .checkouts: return "Check-outs"
        case .people: return "People"
        }
    }
}

struct SearchResults {
    var items: [Asset] = []
    var itemFamilies: [AssetFamilySearchResult] = []
    var reservations: [Booking] = []
    var checkouts: [Booking] = []
    var users: [AppUser] = []
    /// Sources that failed while others answered. Empty on a clean search.
    var unavailableSources: Set<SearchSource> = []

    var isEmpty: Bool {
        items.isEmpty && itemFamilies.isEmpty && reservations.isEmpty && checkouts.isEmpty && users.isEmpty
    }

    /// Copy for the partial-result notice, or nil when everything answered.
    var partialResultNotice: String? {
        guard !unavailableSources.isEmpty else { return nil }
        let names = SearchSource.allCases
            .filter { unavailableSources.contains($0) }
            .map(\.label)
        let joined: String
        switch names.count {
        case 1: joined = names[0]
        case 2: joined = "\(names[0]) and \(names[1])"
        default: joined = names.dropLast().joined(separator: ", ") + ", and \(names[names.count - 1])"
        }
        return "\(joined) didn't load. Showing everything else."
    }

    /// The asset when the result set is a single serialized asset and nothing
    /// else — the canonical "scanned a sticker, got one item" case.
    var singleAssetMatch: Asset? {
        guard items.count == 1,
              itemFamilies.isEmpty,
              reservations.isEmpty,
              checkouts.isEmpty,
              users.isEmpty
        else { return nil }
        return items.first
    }

    /// The family when the result set is a single bulk-item family and nothing
    /// else — e.g. a scanned bulk-unit QR like "Sony Battery, Unit #1".
    var singleFamilyMatch: AssetFamilySearchResult? {
        guard itemFamilies.count == 1,
              items.isEmpty,
              reservations.isEmpty,
              checkouts.isEmpty,
              users.isEmpty
        else { return nil }
        return itemFamilies.first
    }
}

@MainActor
final class SearchService {
    static let shared = SearchService()
    private init() {}

    func search(query: String, rawScan: String? = nil, gearOnly: Bool = false) async throws -> SearchResults {
        let q = query.trimmingCharacters(in: .whitespaces)
        guard !q.isEmpty else { return SearchResults() }

        let api = APIClient.shared
        if gearOnly {
            let itemsResp = try await api.assets(search: q, limit: 10)
            return SearchResults(
                items: itemsResp.data.filter(Self.isSearchVisibleAsset),
                itemFamilies: itemsResp.bulkItems.filter(Self.isSearchVisibleFamily)
            )
        }
        // Each source is awaited independently. Search fans out to four
        // endpoints, and a single `try await (...)` tuple made any one failure
        // throw away the three that succeeded -- a flaky users call left the
        // student staring at an error instead of the item they scanned for.
        async let itemsTask = api.assets(search: q, qr: rawScan, limit: 10)
        async let reservationsTask = api.reservations(activeOnly: false, search: q, limit: 10)
        async let checkoutsTask = api.checkouts(activeOnly: false, search: q, limit: 10)
        async let usersTask = api.users(search: q, limit: 10)

        let itemsResp = try? await itemsTask
        let reservationsResp = try? await reservationsTask
        let checkoutsResp = try? await checkoutsTask
        let usersResp = try? await usersTask

        var unavailable: Set<SearchSource> = []
        if itemsResp == nil { unavailable.insert(.items) }
        if reservationsResp == nil { unavailable.insert(.reservations) }
        if checkoutsResp == nil { unavailable.insert(.checkouts) }
        if usersResp == nil { unavailable.insert(.people) }

        // Every source failing is not a partial result, it is an outage, and
        // it should read as one rather than as "no matches".
        if unavailable.count == SearchSource.allCases.count {
            throw APIError.serverError("Search is unavailable right now. Check your connection and try again.")
        }

        let isDirectScan = rawScan?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false
        let rawItems = itemsResp?.data ?? []
        let rawFamilies = itemsResp?.bulkItems ?? []
        let visibleItems = isDirectScan ? rawItems : rawItems.filter(Self.isSearchVisibleAsset)
        let visibleFamilies = isDirectScan ? rawFamilies : rawFamilies.filter(Self.isSearchVisibleFamily)

        return SearchResults(
            items: visibleItems,
            itemFamilies: visibleFamilies,
            reservations: reservationsResp?.data ?? [],
            checkouts: checkoutsResp?.data ?? [],
            users: usersResp?.data ?? [],
            unavailableSources: unavailable
        )
    }

    private static func isSearchVisibleAsset(_ asset: Asset) -> Bool {
        !isHiddenAttachmentCategory(asset.category?.name)
    }

    private static func isSearchVisibleFamily(_ family: AssetFamilySearchResult) -> Bool {
        !isHiddenAttachmentCategory(family.category)
    }

    private static func isHiddenAttachmentCategory(_ title: String?) -> Bool {
        let normalized = title?
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
        guard let normalized, !normalized.isEmpty else { return false }
        return normalized == "accessories"
            || normalized == "camera accessories"
            || normalized.hasSuffix("/accessories")
            || normalized.hasSuffix("/camera accessories")
    }
}
