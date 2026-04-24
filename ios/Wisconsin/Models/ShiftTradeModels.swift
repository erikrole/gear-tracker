import Foundation

enum ShiftTradeStatus: String, Codable {
    case open = "OPEN"
    case claimed = "CLAIMED"
    case completed = "COMPLETED"
    case cancelled = "CANCELLED"
    case expired = "EXPIRED"
    case unknown = "UNKNOWN"

    init(from decoder: Decoder) throws {
        let val = try decoder.singleValueContainer().decode(String.self)
        self = ShiftTradeStatus(rawValue: val) ?? .unknown
    }

    var label: String {
        switch self {
        case .open: "Open"
        case .claimed: "Claimed"
        case .completed: "Completed"
        case .cancelled: "Cancelled"
        case .expired: "Expired"
        case .unknown: "Unknown"
        }
    }
}

struct ShiftTradeUser: Codable, Identifiable {
    let id: String
    let name: String
}

struct ShiftTradeShift: Codable {
    let area: String
    let startsAt: Date
    let endsAt: Date
    let shiftGroup: ShiftTradeGroup?
}

struct ShiftTradeGroup: Codable {
    let event: ShiftTradeEvent?
}

struct ShiftTradeEvent: Codable {
    let summary: String?
}

struct ShiftTradeAssignment: Codable {
    let id: String
    let shift: ShiftTradeShift
    let user: ShiftTradeUser
}

struct ShiftTrade: Codable, Identifiable, Hashable {
    static func == (lhs: ShiftTrade, rhs: ShiftTrade) -> Bool { lhs.id == rhs.id }
    func hash(into hasher: inout Hasher) { hasher.combine(id) }

    let id: String
    let status: ShiftTradeStatus
    let notes: String?
    let postedBy: ShiftTradeUser
    let claimedBy: ShiftTradeUser?
    let shiftAssignment: ShiftTradeAssignment
    let createdAt: Date
}

struct ShiftTradesResponse: Codable {
    let data: [ShiftTrade]
    let total: Int
}
