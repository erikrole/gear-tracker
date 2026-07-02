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
    let primaryArea: String?
    let avatarUrl: String?
}

struct ShiftTradeShift: Codable {
    let id: String?
    let area: String
    let workerType: String?
    let startsAt: Date
    let endsAt: Date
    let callStartsAt: Date?
    let callEndsAt: Date?
    let shiftGroup: ShiftTradeGroup?
}

struct ShiftTradeGroup: Codable {
    let id: String?
    let publishedAt: Date?
    let event: ShiftTradeEvent?
}

struct ShiftTradeEvent: Codable {
    let id: String?
    let summary: String?
    let sportCode: String?
    let opponent: String?
    let isHome: Bool?

    var compactTitle: String {
        if let sportCode, let opponent, !sportCode.isEmpty, !opponent.isEmpty {
            return "\(sportCode) \(isHome == false ? "at" : "vs") \(opponent)"
        }
        return summary ?? "Shift"
    }
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
    let postedAt: Date?
    let claimedAt: Date?
    let createdAt: Date
}

struct ShiftTradesResponse: Codable {
    let data: [ShiftTrade]
    let total: Int
}

struct OpenWorkResponse: Codable {
    let openShifts: [OpenWorkShift]
    let pickupRequests: [OpenWorkPickupRequest]
}

struct OpenWorkShift: Codable, Identifiable, Hashable {
    static func == (lhs: OpenWorkShift, rhs: OpenWorkShift) -> Bool { lhs.id == rhs.id }
    func hash(into hasher: inout Hasher) { hasher.combine(id) }

    let id: String
    let kind: String
    let action: String
    let canAct: Bool
    let reason: String
    let score: Int?
    let bucket: String?
    let advisoryConflict: Bool
    let advisoryConflictNote: String?
    let warnings: [OpenWorkWarning]
    let ownRequestId: String?
    let requestCount: Int
    let shift: ShiftTradeShift
}

struct OpenWorkWarning: Codable, Hashable {
    let code: String
    let label: String
    let weight: Int?
}

struct OpenWorkPickupRequest: Codable, Identifiable, Hashable {
    static func == (lhs: OpenWorkPickupRequest, rhs: OpenWorkPickupRequest) -> Bool { lhs.id == rhs.id }
    func hash(into hasher: inout Hasher) { hasher.combine(id) }

    let id: String
    let kind: String
    let status: String
    let hasConflict: Bool
    let conflictNote: String?
    let createdAt: Date
    let user: ShiftTradeUser
    let shift: ShiftTradeShift
}

struct ShiftAssignmentActionResponse: Codable {
    let id: String
    let status: String
}
