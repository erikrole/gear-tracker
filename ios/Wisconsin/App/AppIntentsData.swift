import AppIntents
import SwiftUI

// MARK: - Errors

enum GearIntentError: Error, CustomLocalizedStringResourceConvertible {
    case signedOut

    var localizedStringResource: LocalizedStringResource {
        switch self {
        case .signedOut: "You're signed out. Open Wisconsin Creative and sign in first."
        }
    }
}

/// Maps a thrown API error into the intent-facing error space. Auth failures
/// get the actionable "sign in first" message; everything else keeps the
/// humanized `APIError` copy Siri/Shortcuts will read aloud.
func mapIntentError(_ error: Error) -> Error {
    if case APIError.unauthorized = error { return GearIntentError.signedOut }
    return error
}

// MARK: - What Gear Is Out

struct MyCheckedOutGearIntent: AppIntent {
    static let title: LocalizedStringResource = "My Checked-Out Gear"
    static let description = IntentDescription(
        "Check which gear you currently have checked out and when it's due back, without opening the app."
    )
    static let authenticationPolicy: IntentAuthenticationPolicy = .requiresAuthentication

    func perform() async throws -> some IntentResult & ProvidesDialog & ShowsSnippetView {
        let checkouts: [Booking]
        do {
            let me = try await APIClient.shared.me()
            // `sort: endsAt` so a user with more than `limit` checkouts gets the
            // soonest due — otherwise the overdue count below silently misses
            // the oldest ones, which are exactly the overdue ones.
            checkouts = try await APIClient.shared
                .checkouts(activeOnly: true, requesterId: me.id, sort: "endsAt", limit: 10)
                .data
        } catch {
            throw mapIntentError(error)
        }

        let summaries = checkouts
            .map(CheckoutIntentSummary.init)
            .sorted { $0.endsAt < $1.endsAt }

        guard !summaries.isEmpty else {
            return .result(
                dialog: "You don't have any gear checked out right now.",
                view: GearOutSnippetView(checkouts: [])
            )
        }

        let itemCount = summaries.reduce(0) { $0 + $1.itemCount }
        let itemPhrase = itemCount == 1 ? "1 item" : "\(itemCount) items"
        let checkoutPhrase = summaries.count == 1
            ? "one checkout"
            : "\(summaries.count) checkouts"
        let overdueCount = summaries.count(where: \.isOverdue)

        let dialog: IntentDialog
        if overdueCount > 0 {
            let overduePhrase = overdueCount == 1 ? "One of them is overdue" : "\(overdueCount) of them are overdue"
            dialog = IntentDialog("You have \(itemPhrase) out across \(checkoutPhrase). \(overduePhrase).")
        } else if let lastDue = summaries.map(\.endsAt).max() {
            dialog = IntentDialog(
                "You have \(itemPhrase) out across \(checkoutPhrase). Everything is due back by \(lastDue.formatted(date: .abbreviated, time: .shortened))."
            )
        } else {
            dialog = IntentDialog("You have \(itemPhrase) out across \(checkoutPhrase).")
        }

        return .result(dialog: dialog, view: GearOutSnippetView(checkouts: summaries))
    }
}

/// Immutable, Sendable projection of a checkout for snippet rendering.
struct CheckoutIntentSummary: Identifiable, Sendable {
    let id: String
    let title: String
    let itemLine: String
    let itemCount: Int
    let endsAt: Date
    let isPendingPickup: Bool
    let isOverdue: Bool

    init(booking: Booking) {
        id = booking.id
        title = booking.title
        itemLine = Self.itemLine(for: booking)
        itemCount = booking.serializedItems.count
            + booking.bulkItems.reduce(0) { $0 + $1.plannedQuantity }
        endsAt = booking.endsAt
        isPendingPickup = booking.status == .pendingPickup
        isOverdue = booking.status == .open && booking.endsAt < Date()
    }

    /// "C300 Kit A, Batteries ×4 · +2 more" — first two item names, kiosk-style.
    private static func itemLine(for booking: Booking) -> String {
        var names = booking.serializedItems.map(\.asset.itemListPrimaryTitle)
        names += booking.bulkItems.map { item in
            item.plannedQuantity > 1 ? "\(item.bulkSku.name) ×\(item.plannedQuantity)" : item.bulkSku.name
        }
        guard !names.isEmpty else { return "No items listed" }
        let shown = names.prefix(2).joined(separator: ", ")
        let extra = names.count - 2
        return extra > 0 ? "\(shown) · +\(extra) more" : shown
    }
}

struct GearOutSnippetView: View {
    let checkouts: [CheckoutIntentSummary]

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            if checkouts.isEmpty {
                Label("Nothing checked out", systemImage: "checkmark.circle")
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(.secondary)
            } else {
                ForEach(checkouts) { checkout in
                    HStack(alignment: .firstTextBaseline, spacing: 10) {
                        Image(systemName: checkout.isOverdue ? "exclamationmark.triangle.fill" : "backpack")
                            .font(.subheadline)
                            .foregroundStyle(checkout.isOverdue ? Color.statusText(.red) : Color.statusText(.blue))
                            .accessibilityHidden(true)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(checkout.title)
                                .font(.subheadline.weight(.semibold))
                                .lineLimit(1)
                            Text(checkout.itemLine)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                                .lineLimit(1)
                            Text(dueLine(for: checkout))
                                .font(.caption.weight(checkout.isOverdue ? .semibold : .regular))
                                .foregroundStyle(checkout.isOverdue ? Color.statusText(.red) : .secondary)
                        }
                        Spacer(minLength: 0)
                    }
                    .accessibilityElement(children: .combine)
                }
            }
        }
        .padding()
    }

    private func dueLine(for checkout: CheckoutIntentSummary) -> String {
        let when = checkout.endsAt.formatted(date: .abbreviated, time: .shortened)
        if checkout.isOverdue { return "Overdue — was due \(when)" }
        if checkout.isPendingPickup { return "Pickup ready — due back \(when)" }
        return "Due back \(when)"
    }
}

// MARK: - Next Shift

struct NextShiftIntent: AppIntent {
    static let title: LocalizedStringResource = "Next Shift"
    static let description = IntentDescription(
        "Find out when your next shift is and whether gear is ready, without opening the app."
    )
    static let authenticationPolicy: IntentAuthenticationPolicy = .requiresAuthentication

    func perform() async throws -> some IntentResult & ProvidesDialog & ShowsSnippetView {
        let shifts: [MyShift]
        do {
            shifts = try await APIClient.shared.myShifts(limit: 10)
        } catch {
            throw mapIntentError(error)
        }

        let now = Date()
        guard let shift = shifts
            .filter({ $0.endsAt > now })
            .min(by: { $0.startsAt < $1.startsAt })
        else {
            return .result(
                dialog: "You don't have any upcoming shifts.",
                view: NextShiftSnippetView(shift: nil)
            )
        }

        let summary = shift.event.summary
        let time = shift.startsAt.formatted(date: .abbreviated, time: .shortened)
        let place = shift.event.locationName.map { " at \($0)" } ?? ""
        let dialog: IntentDialog
        if shift.startsAt <= now {
            dialog = IntentDialog(
                "You're on shift now — \(summary)\(place), until \(shift.endsAt.formatted(date: .omitted, time: .shortened))."
            )
        } else {
            dialog = IntentDialog("Your next shift is \(time) — \(summary)\(place).")
        }
        return .result(dialog: dialog, view: NextShiftSnippetView(shift: ShiftIntentSummary(shift: shift)))
    }
}

/// Immutable, Sendable projection of a shift for snippet rendering.
struct ShiftIntentSummary: Sendable {
    let eventSummary: String
    let area: String
    let startsAt: Date
    let endsAt: Date
    let locationName: String?
    let gearLabel: String?

    init(shift: MyShift) {
        eventSummary = shift.event.summary
        area = shift.area
        startsAt = shift.startsAt
        endsAt = shift.endsAt
        locationName = shift.event.locationName
        gearLabel = shift.gear.hasGear ? shift.gear.gearLabel : nil
    }
}

struct NextShiftSnippetView: View {
    let shift: ShiftIntentSummary?

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            if let shift {
                Text(shift.eventSummary)
                    .font(.subheadline.weight(.semibold))
                    .lineLimit(2)
                Label(
                    "\(shift.startsAt.formatted(date: .abbreviated, time: .shortened)) – \(shift.endsAt.formatted(date: .omitted, time: .shortened))",
                    systemImage: "clock"
                )
                .font(.caption)
                .foregroundStyle(.secondary)
                if let location = shift.locationName {
                    Label(location, systemImage: "mappin.and.ellipse")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Label(shift.area, systemImage: "person.badge.shield.checkmark")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                if let gearLabel = shift.gearLabel {
                    Label(gearLabel, systemImage: "backpack")
                        .font(.caption.weight(.medium))
                        .foregroundStyle(Color.statusText(.blue))
                }
            } else {
                Label("No upcoming shifts", systemImage: "calendar")
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .accessibilityElement(children: .combine)
    }
}
