import Foundation

struct FormOption: Codable, Identifiable, Hashable, Equatable {
    let id: String
    let name: String
}

// Matches /api/form-options users payload. `email` was removed from the
// server response in the May 2026 API hardening pass -- a non-optional
// field here breaks decoding of the whole form-options response.
struct FormUser: Codable, Identifiable, Hashable, Equatable {
    let id: String
    let name: String
    let avatarUrl: String?
}

struct FormBulkSku: Codable, Identifiable, Hashable, Equatable {
    let id: String
    let name: String
    let category: String?
    let unit: String?
    let locationId: String?
    let binQrCodeValue: String?
    let trackByNumber: Bool
    let categoryName: String?
    let imageUrl: String?
    let currentQuantity: Int
    let availableQuantity: Int
}

struct FormOptions: Codable, Equatable {
    let locations: [FormOption]
    let users: [FormUser]
    let bulkSkus: [FormBulkSku]

    enum CodingKeys: String, CodingKey {
        case locations, users, bulkSkus
    }

    init(locations: [FormOption], users: [FormUser], bulkSkus: [FormBulkSku] = []) {
        self.locations = locations
        self.users = users
        self.bulkSkus = bulkSkus
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        locations = try container.decode([FormOption].self, forKey: .locations)
        users = try container.decode([FormUser].self, forKey: .users)
        bulkSkus = try container.decodeIfPresent([FormBulkSku].self, forKey: .bulkSkus) ?? []
    }
}
