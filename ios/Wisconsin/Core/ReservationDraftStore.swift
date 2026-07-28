import SwiftUI

/// Owns the one in-progress reservation the app is composing.
///
/// The reservation sheet used to be modal per call site, so opening it meant
/// giving up on checking anything else. This store lifts the composer above the
/// tab shell: the sheet can close to a card at the bottom of the app while the
/// view model stays alive, and exiting for real offers to keep the work as a
/// draft through the same `/api/drafts` rows the web wizard writes.
@MainActor
@Observable
final class ReservationDraftStore {
    /// A start request that arrived while another composer was already live.
    /// Held until the user says what should happen to the current one.
    struct PendingStart {
        let composer: CreateBookingViewModel
        let onCreated: ((String) -> Void)?
    }

    /// The live composer, if the user is composing or has minimized.
    private(set) var composer: CreateBookingViewModel?
    /// A draft saved on the server with no composer loaded — the resume target
    /// restored at launch. Cleared as soon as it is opened into a composer.
    private(set) var savedDraft: BookingDraftSummary?
    private(set) var pendingStart: PendingStart?

    /// Step the sheet reopens on, so minimizing mid-flow is lossless.
    var step = 1
    /// Whether the sheet is on screen. Setting this to `false` (swipe down, or
    /// the minimize control) keeps the composer alive; only `discard`,
    /// `saveAndClose`, and `finish` end it.
    var isExpanded = false

    private(set) var isBusy = false
    /// Non-blocking status for the card and sheet ("Draft saved", failures).
    var statusMessage: String?
    var errorMessage: String?

    /// Set after a successful create so the shell can route to the new booking.
    var createdBookingId: String?

    private var onCreated: ((String) -> Void)?

    /// The card shows whenever there is work parked and the sheet is closed.
    var showsCard: Bool {
        !isExpanded && (composer != nil || savedDraft != nil)
    }

    var cardTitle: String {
        composer?.draftDisplayTitle ?? savedDraft?.displayTitle ?? "New Reservation"
    }

    var cardSubtitle: String {
        if let composer { return composer.draftSummaryLine }
        guard let savedDraft else { return "" }
        let count = savedDraft.itemCount
        let items = count == 0 ? "No gear yet" : "\(count) item\(count == 1 ? "" : "s")"
        let when = savedDraft.startsAt.formatted(.dateTime.month(.abbreviated).day().hour().minute())
        return "\(items) · \(when)"
    }

    /// A restored draft has nothing loaded yet, so reopening it fetches first.
    var cardNeedsLoad: Bool { composer == nil && savedDraft != nil }

    // MARK: - Lifecycle

    /// Opens a composer. When one is already live and holds real work, the
    /// request is parked and `pendingStart` drives a choice instead of silently
    /// throwing away either side.
    func start(_ newComposer: CreateBookingViewModel = CreateBookingViewModel(), onCreated: ((String) -> Void)? = nil) {
        if let existing = composer, existing.hasUnsavedInput {
            pendingStart = PendingStart(composer: newComposer, onCreated: onCreated)
            return
        }
        adopt(newComposer, onCreated: onCreated)
    }

    private func adopt(_ newComposer: CreateBookingViewModel, onCreated: ((String) -> Void)?) {
        composer = newComposer
        self.onCreated = onCreated
        savedDraft = nil
        step = 1
        errorMessage = nil
        isExpanded = true
    }

    /// Resolves a parked start by keeping the current composer as a draft.
    func resolvePendingStartBySavingCurrent() async {
        guard let pending = pendingStart else { return }
        pendingStart = nil
        await saveCurrentComposerAsDraft(announcing: true)
        adopt(pending.composer, onCreated: pending.onCreated)
    }

    /// Resolves a parked start by throwing the current composer away.
    func resolvePendingStartByDiscardingCurrent() async {
        guard let pending = pendingStart else { return }
        pendingStart = nil
        await deleteServerDraftIfAny()
        composer = nil
        adopt(pending.composer, onCreated: pending.onCreated)
    }

    /// Resolves a parked start by staying where the user already was.
    func cancelPendingStart() {
        pendingStart = nil
        isExpanded = true
    }

    /// Closes the sheet but keeps composing. This is the swipe-down path.
    func minimize() {
        guard composer != nil else { return }
        isExpanded = false
    }

    func expand() {
        guard composer != nil else { return }
        isExpanded = true
    }

    /// Opens whatever the card represents: the live composer, or a saved draft
    /// that has to be fetched first.
    func openCard() async {
        if composer != nil {
            expand()
            return
        }
        guard let savedDraft else { return }
        await resume(draftId: savedDraft.id)
    }

    /// Loads a saved draft into a composer and opens it.
    func resume(draftId: String) async {
        isBusy = true
        defer { isBusy = false }
        do {
            let detail = try await APIClient.shared.bookingDraft(id: draftId)
            let vm = CreateBookingViewModel()
            await vm.applyDraft(detail)
            adopt(vm, onCreated: nil)
        } catch APIError.notFound {
            // Finished or discarded elsewhere — stop offering it.
            savedDraft = nil
            errorMessage = "That draft is no longer available."
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    /// Exits and keeps the work. Returns to no-draft state with the card
    /// showing the saved row, so the user can pick it straight back up.
    func saveAndClose() async {
        await saveCurrentComposerAsDraft(announcing: true)
        composer = nil
        onCreated = nil
        isExpanded = false
        step = 1
    }

    /// Exits and throws the work away, including any server row it produced.
    func discard() async {
        await deleteServerDraftIfAny()
        composer = nil
        savedDraft = nil
        onCreated = nil
        isExpanded = false
        step = 1
    }

    /// Called after the reservation is created. The composer's own submit
    /// already removed its draft row.
    func finish(bookingId: String) {
        onCreated?(bookingId)
        createdBookingId = bookingId
        composer = nil
        savedDraft = nil
        onCreated = nil
        isExpanded = false
        step = 1
    }

    // MARK: - Persistence

    /// Silent insurance when the app leaves the foreground: the composer stays
    /// live, but its contents survive a task kill.
    func autosave() async {
        guard let composer, composer.isWorthSavingAsDraft, composer.hasUnsavedInput else { return }
        _ = try? await composer.saveDraft()
    }

    /// Loads the newest reservation draft as a resume target. Skipped whenever
    /// a composer is already live — an in-memory composer is always the more
    /// current version of the same work.
    func loadSavedDraft() async {
        guard composer == nil else { return }
        guard let newest = try? await APIClient.shared.bookingDrafts().first(where: { $0.isReservation }) else { return }
        savedDraft = newest
    }

    func clearForSignOut() {
        composer = nil
        savedDraft = nil
        pendingStart = nil
        onCreated = nil
        isExpanded = false
        step = 1
        statusMessage = nil
        errorMessage = nil
    }

    private func saveCurrentComposerAsDraft(announcing: Bool) async {
        guard let composer, composer.isWorthSavingAsDraft else { return }
        isBusy = true
        defer { isBusy = false }
        do {
            let id = try await composer.saveDraft()
            savedDraft = BookingDraftSummary(
                id: id,
                kind: "RESERVATION",
                title: composer.title,
                locationName: composer.selectedLocation?.name,
                startsAt: composer.startsAt,
                endsAt: composer.endsAt,
                itemCount: composer.selectedEquipmentCount,
                updatedAt: .now
            )
            if announcing {
                statusMessage = "Draft saved"
                Haptics.success()
            }
        } catch {
            errorMessage = "Couldn't save your draft. \(error.localizedDescription)"
            Haptics.warning()
        }
    }

    private func deleteServerDraftIfAny() async {
        guard let draftId = composer?.serverDraftId ?? savedDraft?.id else { return }
        try? await APIClient.shared.deleteBookingDraft(id: draftId)
        composer?.serverDraftId = nil
    }
}
