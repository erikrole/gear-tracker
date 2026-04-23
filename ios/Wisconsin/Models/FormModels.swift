import Foundation

struct FormOption: Codable, Identifiable, Hashable, Equatable {
    let id: String
    let name: String
}

struct FormUser: Codable, Identifiable, Hashable, Equatable {
    let id: String
    let name: String
    let email: String
}

struct FormOptions: Codable, Equatable {
    let locations: [FormOption]
    let users: [FormUser]
}
