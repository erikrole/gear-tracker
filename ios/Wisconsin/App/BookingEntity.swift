import AppIntents
import Foundation

/// Shortcuts-facing projection of a `Booking` so users can parameterize
/// automations ("Open <booking>") over their reservations and checkouts.
struct BookingEntity: AppEntity, Identifiable, Sendable {
    static let typeDisplayRepresentation = TypeDisplayRepresentation(name: "Booking")
    static let defaultQuery = BookingEntityQuery()

    let id: String

    @Property(title: "Name")
    var title: String

    @Property(title: "Type")
    var kindLabel: String

    @Property(title: "Status")
    var statusLabel: String

    @Property(title: "Due Back")
    var endsAt: Date

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
            do {
                let booking = try await APIClient.shared.booking(id: id)
                results.append(BookingEntity(booking: booking))
            } catch APIError.notFound {
                continue
            } catch {
                throw mapIntentError(error)
            }
        }
        return results
    }

    // `bookings` spans both kinds already sorted by due date, so these no
    // longer fan out to one call per kind and re-merge on the client.
    func entities(matching string: String) async throws -> [BookingEntity] {
        do {
            let result = try await APIClient.shared.bookings(activeOnly: true, search: string, limit: 20)
            return dedupedEntities(from: result.data)
        } catch {
            throw mapIntentError(error)
        }
    }

    func suggestedEntities() async throws -> [BookingEntity] {
        do {
            let me = try await APIClient.shared.me()
            let result = try await APIClient.shared.bookings(activeOnly: true, requesterId: me.id, limit: 10)
            return dedupedEntities(from: result.data)
        } catch {
            throw mapIntentError(error)
        }
    }

    private func dedupedEntities(from bookings: [Booking]) -> [BookingEntity] {
        var seen = Set<String>()
        return bookings
            .filter { seen.insert($0.id).inserted }
            .sorted { $0.endsAt < $1.endsAt }
            .map(BookingEntity.init)
    }
}

struct OpenBookingIntent: OpenIntent {
    static let title: LocalizedStringResource = "Open Booking"
    static let description = IntentDescription("Open a reservation or checkout in the app.")
    static let authenticationPolicy: IntentAuthenticationPolicy = .requiresAuthentication

    @Parameter(title: "Booking", requestValueDialog: "Which booking?")
    var target: BookingEntity

    static var parameterSummary: some ParameterSummary {
        Summary("Open \(\.$target)")
    }

    @MainActor
    func perform() async throws -> some IntentResult {
        GearTrackerAppIntentHandoff.shared.requestBooking(id: target.id)
        return .result()
    }
}
