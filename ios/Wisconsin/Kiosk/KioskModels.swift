import Foundation

// MARK: - Activation

struct KioskActivationResponse: Decodable {
    let kioskId: String
    let name: String
    let location: Location

    struct Location: Decodable {
        let id: String
        let name: String
    }
}

struct KioskInfo: Codable {
    let kioskId: String
    let name: String
    let locationId: String
    let locationName: String
}

// MARK: - Dashboard

struct KioskDashboard: Decodable {
    let stats: Stats
    let events: [KioskEvent]
    let checkouts: [KioskActiveCheckout]

    struct Stats: Decodable {
        let itemsOut: Int
        let checkouts: Int
        let overdue: Int
    }
}

struct KioskEvent: Decodable, Identifiable {
    let id: String
    let title: String
    let sportCode: String?
    let startsAt: Date
    let shiftCount: Int
}

struct KioskActiveCheckout: Decodable, Identifiable {
    let id: String
    let title: String
    let requesterName: String
    let requesterAvatarUrl: String?
    let requesterInitials: String
    let items: [CheckoutItem]
    let itemCount: Int
    let endsAt: Date
    let isOverdue: Bool

    struct CheckoutItem: Decodable {
        let name: String
    }
}

// MARK: - Users

struct KioskUser: Decodable, Identifiable, Equatable {
    let id: String
    let name: String
    let avatarUrl: String?
    let role: String

    var initials: String {
        name.split(separator: " ").prefix(2).compactMap { $0.first }.map { String($0) }.joined().uppercased()
    }
}

// MARK: - Student Context

struct KioskStudentContext: Decodable {
    let checkouts: [KioskStudentCheckout]
    let pendingPickups: [KioskPendingPickup]
    let reservations: [KioskReservation]
}

struct KioskStudentCheckout: Decodable, Identifiable {
    let id: String
    let title: String
    let refNumber: String?
    let items: [StudentItem]
    let endsAt: Date
    let isOverdue: Bool

    struct StudentItem: Decodable {
        let name: String
        let tagName: String
    }
}

struct KioskPendingPickup: Decodable, Identifiable {
    let id: String
    let title: String
    let refNumber: String?
    let startsAt: Date
    let serializedItems: [SerializedItem]
    let bulkItems: [BulkItem]

    struct SerializedItem: Decodable, Identifiable {
        let id: String
        let tagName: String
        let name: String
    }

    struct BulkItem: Decodable {
        let name: String
        let quantity: Int
    }
}

struct KioskReservation: Decodable, Identifiable {
    let id: String
    let title: String
    let startsAt: Date
}

// MARK: - Scan

struct KioskScanResult: Decodable {
    let success: Bool
    let error: String?
    let item: ScannedItem?

    struct ScannedItem: Decodable, Identifiable {
        let id: String
        let name: String
        let tagName: String
        let type: String?
    }
}

// MARK: - Checkout Detail (return flow)

struct KioskCheckoutDetail: Decodable {
    let id: String
    let title: String
    let refNumber: String?
    let status: String
    let endsAt: Date
    let items: [ReturnItem]

    struct ReturnItem: Decodable, Identifiable {
        let id: String
        let tagName: String
        let name: String
        let returned: Bool
    }
}

// MARK: - Screen State

enum KioskScreen: Equatable {
    case activation
    case idle
    case studentHub(KioskUser)
    case checkout(userId: String)
    case pickup(bookingId: String, userId: String)
    case `return`(bookingId: String, userId: String)
    case success(String)
}
