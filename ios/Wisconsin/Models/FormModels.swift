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
}

struct FormOptions: Codable, Equatable {
    let locations: [FormOption]
    let users: [FormUser]
}
