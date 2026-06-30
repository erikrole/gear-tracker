import ActivityKit
import Foundation

struct CheckoutReturnActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var endsAt: Date
        var now: Date
        var nextNeedAt: Date?
        var allowsExtend: Bool
        var urgency: Urgency

        enum Urgency: String, Codable, Hashable {
            case normal
            case warning
            case critical
            case overdue
        }
    }

    var bookingId: String
    var bookingTitle: String
    var requesterName: String
    var requesterInitials: String
    var requesterAvatarUrl: String?
    var returnTimeText: String
}

extension CheckoutReturnActivityAttributes.ContentState {
    var isOverdue: Bool { now >= endsAt }

    func isOverdue(at date: Date) -> Bool {
        date >= endsAt
    }

    func minuteLabel(at date: Date) -> String {
        let seconds = Int(abs(endsAt.timeIntervalSince(date)).rounded())
        let minutes = max(1, seconds / 60)
        return isOverdue(at: date)
            ? "\(minutes) min overdue"
            : "\(minutes) min"
    }

    func urgency(at date: Date) -> Urgency {
        if endsAt <= date { return .overdue }
        let remaining = endsAt.timeIntervalSince(date)
        if remaining <= 10 * 60 { return .critical }
        if remaining <= 30 * 60 { return .warning }
        return urgency
    }
}
