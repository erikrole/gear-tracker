import Foundation

struct SearchResults {
    var items: [Asset] = []
    var itemFamilies: [AssetFamilySearchResult] = []
    var reservations: [Booking] = []
    var checkouts: [Booking] = []
    var users: [AppUser] = []

    var isEmpty: Bool {
        items.isEmpty && itemFamilies.isEmpty && reservations.isEmpty && checkouts.isEmpty && users.isEmpty
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
        async let itemsTask = api.assets(search: q, qr: rawScan, limit: 10)
        async let reservationsTask = api.reservations(activeOnly: false, search: q, limit: 10)
        async let checkoutsTask = api.checkouts(activeOnly: false, search: q, limit: 10)
        async let usersTask = api.users(search: q, limit: 10)

        let (itemsResp, reservationsResp, checkoutsResp, usersResp) = try await (
            itemsTask, reservationsTask, checkoutsTask, usersTask
        )
        let isDirectScan = rawScan?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false
        let visibleItems = isDirectScan ? itemsResp.data : itemsResp.data.filter(Self.isSearchVisibleAsset)
        let visibleFamilies = isDirectScan ? itemsResp.bulkItems : itemsResp.bulkItems.filter(Self.isSearchVisibleFamily)

        return SearchResults(
            items: visibleItems,
            itemFamilies: visibleFamilies,
            reservations: reservationsResp.data,
            checkouts: checkoutsResp.data,
            users: usersResp.data
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
