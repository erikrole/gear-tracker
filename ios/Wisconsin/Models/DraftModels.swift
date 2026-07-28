import Foundation

/// A saved in-progress booking. Drafts are real `Booking` rows with
/// `status = DRAFT`, shared with the web wizard through `/api/drafts`, so a
/// reservation started on the phone can be finished at a desk.
struct BookingDraftSummary: Codable, Identifiable, Hashable {
    let id: String
    let kind: String
    let title: String
    let locationName: String?
    let startsAt: Date
    let endsAt: Date
    let itemCount: Int
    let updatedAt: Date

    var isReservation: Bool { kind == "RESERVATION" }

    /// The server stores `"Untitled draft"` when the user never named the
    /// reservation. That is a storage placeholder, not product copy.
    var displayTitle: String {
        let trimmed = title.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty || trimmed == "Untitled draft" { return "New Reservation" }
        return trimmed
    }
}

/// Only the id is read back from a draft's linked events. The composer
/// re-resolves full event rows from `/api/calendar-events`, so decoding the
/// server's partial event shape into `ScheduleEvent` would add a contract
/// surface with nothing to gain.
struct BookingDraftEventRef: Codable, Hashable {
    let id: String
}

struct BookingDraftDetail: Codable {
    let id: String
    let kind: String
    let title: String
    let requesterUserId: String?
    let locationId: String?
    let locationName: String?
    let startsAt: Date
    let endsAt: Date
    let eventId: String?
    let events: [BookingDraftEventRef]
    let sportCode: String?
    let notes: String
    let serializedAssetIds: [String]
    let bulkItems: [BulkReservationRequest]
    let updatedAt: Date

    /// Linked event ids in server order, tolerating the legacy single-event
    /// field for drafts saved before multi-event linking.
    var linkedEventIds: [String] {
        if !events.isEmpty { return events.map(\.id) }
        return eventId.map { [$0] } ?? []
    }
}
