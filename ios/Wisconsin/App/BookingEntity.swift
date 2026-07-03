import AppIntents
import Foundation

/// Shortcuts-facing projection of a `Booking` so users can parameterize
/// automations ("Open <booking>") over their reservations and checkouts.
struct BookingEntity: AppEntity, Identifiable, Sendable {
    static let typeDisplayRepresentation = TypeDisplayRepresentation(name: "Booking")
    static let defaultQuery = BookingEntityQuery()

    let id: String
    let title: String
    let kindLabel: String
    let statusLabel: String
    let endsAt: Date

    var displayRepresentation: DisplayRepresentation {
        DisplayRepresentation(
            title: "\(title)",
            subtitle: "\(kindLabel) · \(statusLabel) · \(endsAt.formatted(date: .abbreviated, time: .shortened))"
        )
    }

    init(booking: Booking) {
        id = booking.id
        title = booking.title
        kindLabel = booking.kind == .checkout ? "Checkout" : "Reservation"
        statusLabel = booking.status.label
        endsAt = booking.endsAt
    }
}

struct BookingEntityQuery: EntityStringQuery {
    func entities(for identifiers: [String]) async throws -> [BookingEntity] {
        var results: [BookingEntity] = []
        for id in identifiers {
            // Tolerate stale ids (cancelled/deleted bookings) instead of
            // failing the whole shortcut.
            if let booking = try? await APIClient.shared.booking(id: id) {
                results.append(BookingEntity(booking: booking))
            }
        }
        return results
    }

    func entities(matching string: String) async throws -> [BookingEntity] {
        async let reservations = APIClient.shared
            .reservations(activeOnly: true, search: string, limit: 10)
        async let checkouts = APIClient.shared
            .checkouts(activeOnly: true, search: string, limit: 10)
        let (reserved, out) = try await (reservations.data, checkouts.data)
        return dedupedEntities(from: out + reserved)
    }

    func suggestedEntities() async throws -> [BookingEntity] {
        let me = try await APIClient.shared.me()
        async let reservations = APIClient.shared
            .reservations(activeOnly: true, requesterId: me.id, limit: 5)
        async let checkouts = APIClient.shared
            .checkouts(activeOnly: true, requesterId: me.id, limit: 5)
        let (reserved, out) = try await (reservations.data, checkouts.data)
        return dedupedEntities(from: out + reserved)
    }

    private func dedupedEntities(from bookings: [Booking]) -> [BookingEntity] {
        var seen = Set<String>()
        return bookings
            .filter { seen.insert($0.id).inserted }
            .sorted { $0.endsAt < $1.endsAt }
            .map(BookingEntity.init)
    }
}

struct OpenBookingIntent: AppIntent {
    static let title: LocalizedStringResource = "Open Booking"
    static let description = IntentDescription("Open a reservation or checkout in the app.")
    static let openAppWhenRun = true

    @Parameter(title: "Booking")
    var booking: BookingEntity

    static var parameterSummary: some ParameterSummary {
        Summary("Open \(\.$booking)")
    }

    @MainActor
    func perform() async throws -> some IntentResult {
        GearTrackerAppIntentHandoff.shared.requestBooking(id: booking.id)
        return .result()
    }
}
