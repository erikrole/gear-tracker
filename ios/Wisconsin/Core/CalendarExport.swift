import EventKit
import Foundation

/// Writes a checkout into the user's own calendar with a reminder before the
/// return time.
///
/// Deliberately distinct from the shifts ICS subscription in `ScheduleView`:
/// that feed is a passive, always-current mirror of assigned shifts, whereas
/// this is a one-off the user asks for on a specific booking. Gear checkouts
/// are not in the feed, so this is the only way a return time reaches the
/// calendar someone actually looks at.
///
/// Uses write-only access. The app never needs to read the user's calendar, and
/// asking for less is both the smaller prompt and the smaller promise.
@MainActor
enum CalendarExport {
    /// Booking ids already written, so a second tap reports the truth instead
    /// of silently creating a duplicate. Write-only access cannot read events
    /// back to check, so this local record is the only signal available.
    private static let exportedKey = "WisconsinCalendarExportedBookingIds"

    /// How long before the return time the reminder fires. Matches the Live
    /// Activity's lead so the two surfaces agree on what "about to be due" means.
    static let reminderLead: TimeInterval = 30 * 60

    enum ExportError: LocalizedError {
        case accessDenied
        case saveFailed(String)

        var errorDescription: String? {
            switch self {
            case .accessDenied:
                "Creative needs permission to add events. Turn on Calendars for Creative in iOS Settings."
            case .saveFailed(let message):
                message
            }
        }
    }

    static func hasExported(bookingId: String) -> Bool {
        exportedBookingIds().contains(bookingId)
    }

    /// Adds the checkout window to the default calendar, with an alarm ahead of
    /// the return time. Returns silently on success; throws for the two cases
    /// the caller can act on (permission, save failure).
    static func addCheckout(
        bookingId: String,
        title: String,
        startsAt: Date,
        endsAt: Date,
        locationName: String?,
        notes: String?
    ) async throws {
        let store = EKEventStore()

        let granted: Bool
        do {
            granted = try await store.requestWriteOnlyAccessToEvents()
        } catch {
            throw ExportError.saveFailed(error.localizedDescription)
        }
        guard granted else { throw ExportError.accessDenied }

        let event = EKEvent(eventStore: store)
        event.title = title
        event.startDate = startsAt
        // A checkout whose window is inverted or zero-length would be rejected
        // by EventKit; give it a minimum duration rather than failing the save.
        event.endDate = max(endsAt, startsAt.addingTimeInterval(60))
        event.location = locationName
        event.notes = notes
        event.url = checkoutCalendarURL(bookingId: bookingId)
        event.calendar = store.defaultCalendarForNewEvents

        guard event.calendar != nil else {
            throw ExportError.saveFailed("No default calendar is set up on this device.")
        }

        // Relative to the end date: the point of this is the return, not the
        // pickup. Skipped when the return is already inside the lead window,
        // since EventKit would fire it immediately.
        if endsAt.timeIntervalSinceNow > reminderLead {
            event.addAlarm(EKAlarm(relativeOffset: -reminderLead))
        }

        do {
            try store.save(event, span: .thisEvent, commit: true)
        } catch {
            throw ExportError.saveFailed(error.localizedDescription)
        }

        markExported(bookingId: bookingId)
    }

    /// Deep link back into the app, so the calendar entry is a way in rather
    /// than a dead copy of the details.
    private static func checkoutCalendarURL(bookingId: String) -> URL? {
        var components = URLComponents()
        components.scheme = "wisconsin"
        components.host = "booking"
        components.path = "/\(bookingId)"
        return components.url
    }

    private static func exportedBookingIds() -> Set<String> {
        Set(UserDefaults.standard.stringArray(forKey: exportedKey) ?? [])
    }

    private static func markExported(bookingId: String) {
        var ids = exportedBookingIds()
        ids.insert(bookingId)
        UserDefaults.standard.set(Array(ids), forKey: exportedKey)
    }

    /// Clears the local record on sign-out. The calendar entries themselves
    /// belong to the person who added them and are deliberately left alone.
    static func resetExportedRecord() {
        UserDefaults.standard.removeObject(forKey: exportedKey)
    }
}
