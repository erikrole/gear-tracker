import Foundation

struct AppNotification: Codable, Identifiable {
    let id: String
    let type: String
    let title: String
    let body: String?
    let readAt: Date?
    let createdAt: Date
    let payload: NotificationPayload?

    var isUnread: Bool { readAt == nil }
}

struct NotificationPayload: Codable {
    let bookingId: String?
    let checkoutId: String?
    let assignmentId: String?
    let assetId: String?
}

struct NotificationsResponse: Codable {
    let data: [AppNotification]
    let total: Int
    let limit: Int
    let offset: Int
    let unreadCount: Int
}
