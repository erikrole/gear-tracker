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
    var returnTimeText: String
}

extension CheckoutReturnActivityAttributes.ContentState {
    var isOverdue: Bool { now >= endsAt }
}
