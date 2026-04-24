import Foundation

struct SearchResults {
    var items: [Asset] = []
    var reservations: [Booking] = []
    var checkouts: [Booking] = []
    var users: [AppUser] = []

    var isEmpty: Bool {
        items.isEmpty && reservations.isEmpty && checkouts.isEmpty && users.isEmpty
    }
}

@MainActor
final class SearchService {
    static let shared = SearchService()
    private init() {}

    func search(query: String) async throws -> SearchResults {
        let q = query.trimmingCharacters(in: .whitespaces)
        guard !q.isEmpty else { return SearchResults() }

        let api = APIClient.shared
        async let itemsTask = api.assets(search: q, limit: 10)
        async let reservationsTask = api.reservations(activeOnly: false, search: q, limit: 10)
        async let checkoutsTask = api.checkouts(activeOnly: false, search: q, limit: 10)
        async let usersTask = api.users(search: q, limit: 10)

        let (itemsResp, reservationsResp, checkoutsResp, usersResp) = try await (
            itemsTask, reservationsTask, checkoutsTask, usersTask
        )
        return SearchResults(
            items: itemsResp.data,
            reservations: reservationsResp.data,
            checkouts: checkoutsResp.data,
            users: usersResp.data
        )
    }
}
