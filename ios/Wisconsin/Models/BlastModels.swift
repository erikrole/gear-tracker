import Foundation

/// Mirrors `BlastSeverity` in prisma/schema.prisma and the badge tones in
/// src/app/(app)/blasts/_severity.ts.
enum BlastSeverity: String, Codable {
    case info = "INFO"
    case warning = "WARNING"
    case urgent = "URGENT"
    case unknown = "UNKNOWN"

    init(from decoder: Decoder) throws {
        let value = try decoder.singleValueContainer().decode(String.self)
        // A severity this build doesn't know about must still show the banner --
        // falling back to `info` is safer than failing to decode the whole blast.
        self = BlastSeverity(rawValue: value) ?? .unknown
    }

    /// Most severe first when several blasts are active at once.
    var rank: Int {
        switch self {
        case .urgent: 0
        case .warning: 1
        case .info, .unknown: 2
        }
    }
}

/// An unacknowledged blast, as returned by `GET /api/me/blasts`.
///
/// `id` is the blast id, not the recipient row id -- the ack and read endpoints
/// are addressed by blast, and the client never needs to know the row exists.
struct ActiveBlast: Codable, Identifiable, Equatable {
    let id: String
    let title: String
    let body: String
    let severity: BlastSeverity
    let sentAt: Date?
    let senderName: String?
    let requiresAck: Bool
    let readAt: Date?

    enum CodingKeys: String, CodingKey {
        case id, title, body, severity, sentAt, senderName, requiresAck, readAt
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        title = try c.decode(String.self, forKey: .title)
        body = try c.decode(String.self, forKey: .body)
        // Everything past the message itself is optional so a server-side field
        // addition never breaks an older build's banner.
        severity = try c.decodeIfPresent(BlastSeverity.self, forKey: .severity) ?? .info
        sentAt = try c.decodeIfPresent(Date.self, forKey: .sentAt)
        senderName = try c.decodeIfPresent(String.self, forKey: .senderName)
        requiresAck = try c.decodeIfPresent(Bool.self, forKey: .requiresAck) ?? true
        readAt = try c.decodeIfPresent(Date.self, forKey: .readAt)
    }

    static func == (lhs: ActiveBlast, rhs: ActiveBlast) -> Bool { lhs.id == rhs.id }
}
