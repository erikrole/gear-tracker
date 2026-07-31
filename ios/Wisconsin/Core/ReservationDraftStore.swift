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
    private let persistence: any ReservationDraftPersistence
    private var sessionBoundaryId = UUID()
    private var loadTask: Task<Void, Never>?
    private var loadRequests = LatestRequestGeneration()
    private var busyOperationId: UUID?
    private var loadOperationId: UUID?
    private var ownedSubmissionBookingId: String?

    private struct OperationOwnership {
        let sessionBoundaryId: UUID
        let operationId: UUID
    }

    init(persistence: any ReservationDraftPersistence = APIClient.shared) {
        self.persistence = persistence
    }

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
    func start(onCreated: ((String) -> Void)? = nil) {
        start(CreateBookingViewModel(draftPersistence: persistence), onCreated: onCreated)
    }

    func start(_ newComposer: CreateBookingViewModel, onCreated: ((String) -> Void)? = nil) {
        cancelLoad()
        if let existing = composer, existing.hasUnsavedInput {
            pendingStart = PendingStart(composer: newComposer, onCreated: onCreated)
            return
        }
        adopt(newComposer, onCreated: onCreated)
    }

    private func adopt(_ newComposer: CreateBookingViewModel, onCreated: ((String) -> Void)?) {
        composer = newComposer
        ownedSubmissionBookingId = nil
        newComposer.onReservationSubmitted = { [weak self, weak newComposer] bookingId in
            guard let self,
                  let newComposer,
                  self.composer === newComposer
            else { return }
            self.ownedSubmissionBookingId = bookingId
        }
        self.onCreated = onCreated
        savedDraft = nil
        step = 1
        errorMessage = nil
        isExpanded = true
    }

    /// Resolves a parked start by keeping the current composer as a draft.
    func resolvePendingStartBySavingCurrent() async {
        guard let pending = pendingStart,
              let currentComposer = composer,
              let ownership = beginBusyOperation()
        else { return }
        defer { finishBusyOperation(ownership) }

        guard await saveCurrentComposerAsDraft(
            currentComposer,
            announcing: true,
            ownership: ownership
        ) else {
            guard canPublish(ownership) else { return }
            isExpanded = true
            return
        }
        guard canPublish(ownership),
              composer === currentComposer,
              pendingStart?.composer === pending.composer
        else { return }
        pendingStart = nil
        adopt(pending.composer, onCreated: pending.onCreated)
    }

    /// Resolves a parked start by throwing the current composer away.
    func resolvePendingStartByDiscardingCurrent() async {
        guard let pending = pendingStart,
              let ownership = beginBusyOperation()
        else { return }
        let currentComposer = composer
        defer { finishBusyOperation(ownership) }

        guard await deleteServerDraftIfAny(
            expectedComposer: currentComposer,
            ownership: ownership
        ) else {
            guard canPublish(ownership) else { return }
            isExpanded = true
            return
        }
        guard canPublish(ownership),
              composer === currentComposer,
              pendingStart?.composer === pending.composer
        else { return }
        pendingStart = nil
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
        cancelLoad()
        guard let ownership = beginBusyOperation() else { return }
        loadOperationId = ownership.operationId
        let requestToken = loadRequests.begin()
        let task = Task { @MainActor [weak self] in
            guard let self else { return }
            await self.performResume(
                draftId: draftId,
                requestToken: requestToken,
                ownership: ownership
            )
        }
        loadTask = task
        await withTaskCancellationHandler {
            await task.value
        } onCancel: {
            // SwiftUI and card/Home call sites create unstructured Tasks.
            // Forward cancellation to this exact child without touching a
            // newer account's replacement load.
            task.cancel()
        }
    }

    private func performResume(
        draftId: String,
        requestToken: UUID,
        ownership: OperationOwnership
    ) async {
        defer {
            finishLoad(requestToken: requestToken, ownership: ownership)
        }
        guard canPublishLoad(requestToken: requestToken, ownership: ownership) else { return }
        do {
            let detail = try await persistence.bookingDraft(id: draftId)
            guard canPublishLoad(requestToken: requestToken, ownership: ownership) else { return }
            let vm = CreateBookingViewModel(draftPersistence: persistence)
            await vm.applyDraft(detail)
            // applyDraft performs nested asset requests. Re-check after that
            // suspension so a previous account cannot publish its composer.
            guard canPublishLoad(requestToken: requestToken, ownership: ownership) else { return }
            adopt(vm, onCreated: nil)
        } catch APIError.notFound {
            guard canPublishLoad(requestToken: requestToken, ownership: ownership) else { return }
            // Finished or discarded elsewhere — stop offering it.
            savedDraft = nil
            errorMessage = "That draft is no longer available."
        } catch {
            guard canPublishLoad(requestToken: requestToken, ownership: ownership) else { return }
            errorMessage = error.localizedDescription
        }
    }

    /// Exits and keeps the work. Returns to no-draft state with the card
    /// showing the saved row, so the user can pick it straight back up.
    func saveAndClose() async {
        guard let currentComposer = composer,
              let ownership = beginBusyOperation()
        else { return }
        defer { finishBusyOperation(ownership) }
        guard await saveCurrentComposerAsDraft(
            currentComposer,
            announcing: true,
            ownership: ownership
        ) else { return }
        guard canPublish(ownership), composer === currentComposer else { return }
        composer = nil
        onCreated = nil
        isExpanded = false
        step = 1
    }

    /// Closes a saved draft that the user did not change. Cancel here means
    /// "I'm done looking at this", not "destroy the work I already chose to
    /// keep" — resuming a draft and backing out must leave it on the server.
    func closeKeepingDraft() async {
        guard let composer, let draftId = composer.serverDraftId else {
            await discard()
            return
        }
        savedDraft = summary(for: composer, id: draftId)
        self.composer = nil
        onCreated = nil
        isExpanded = false
        step = 1
    }

    /// Exits and throws the work away, including any server row it produced.
    /// Only ever reached from an explicit Discard, or from a composer that
    /// never had anything worth keeping.
    func discard() async {
        guard let ownership = beginBusyOperation() else { return }
        let currentComposer = composer
        defer { finishBusyOperation(ownership) }
        guard await deleteServerDraftIfAny(
            expectedComposer: currentComposer,
            ownership: ownership
        ) else { return }
        guard canPublish(ownership), composer === currentComposer else { return }
        composer = nil
        savedDraft = nil
        onCreated = nil
        isExpanded = false
        step = 1
    }

    /// Called after the reservation is created. The composer's own submit
    /// already removed its draft row.
    func finish(bookingId: String) {
        guard ownedSubmissionBookingId == bookingId else { return }
        ownedSubmissionBookingId = nil
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
        guard let composer,
              !composer.isSubmitting,
              composer.isWorthSavingAsDraft,
              composer.hasUnsavedInput else { return }
        guard let ownership = beginBusyOperation() else { return }
        defer { finishBusyOperation(ownership) }
        _ = try? await composer.saveDraft()
    }

    /// Loads the newest reservation draft as a resume target. Skipped whenever
    /// a composer is already live — an in-memory composer is always the more
    /// current version of the same work.
    func loadSavedDraft() async {
        guard composer == nil else { return }
        cancelLoad()
        guard let ownership = beginBusyOperation() else { return }
        loadOperationId = ownership.operationId
        let requestToken = loadRequests.begin()
        let task = Task { @MainActor [weak self] in
            guard let self else { return }
            await self.performSavedDraftLoad(
                requestToken: requestToken,
                ownership: ownership
            )
        }
        loadTask = task
        await withTaskCancellationHandler {
            await task.value
        } onCancel: {
            task.cancel()
        }
    }

    private func performSavedDraftLoad(
        requestToken: UUID,
        ownership: OperationOwnership
    ) async {
        defer {
            finishLoad(requestToken: requestToken, ownership: ownership)
        }
        guard canPublishLoad(requestToken: requestToken, ownership: ownership) else { return }
        guard let newest = try? await persistence.bookingDrafts()
            .first(where: { $0.isReservation })
        else { return }
        guard canPublishLoad(requestToken: requestToken, ownership: ownership),
              composer == nil
        else { return }
        savedDraft = newest
    }

    func clearForSignOut() {
        sessionBoundaryId = UUID()
        cancelLoad()
        composer?.cancelDraftPersistenceForSessionBoundary()
        busyOperationId = nil
        isBusy = false
        composer = nil
        savedDraft = nil
        pendingStart = nil
        onCreated = nil
        ownedSubmissionBookingId = nil
        isExpanded = false
        step = 1
        statusMessage = nil
        errorMessage = nil
        createdBookingId = nil
    }

    private func saveCurrentComposerAsDraft(
        _ composer: CreateBookingViewModel,
        announcing: Bool,
        ownership: OperationOwnership
    ) async -> Bool {
        guard canPublish(ownership), self.composer === composer else { return false }
        guard composer.isWorthSavingAsDraft else {
            errorMessage = "There isn't anything to save yet."
            Haptics.warning()
            return false
        }
        do {
            let id = try await composer.saveDraft()
            guard canPublish(ownership), self.composer === composer else { return false }
            guard !composer.hasUnsavedInput else {
                statusMessage = "Draft saved. Newer edits are still open."
                Haptics.success()
                return false
            }
            savedDraft = summary(for: composer, id: id)
            if announcing {
                statusMessage = "Draft saved"
                Haptics.success()
            }
            return true
        } catch {
            guard canPublish(ownership), self.composer === composer else { return false }
            errorMessage = "Couldn't save your draft. \(error.localizedDescription)"
            Haptics.warning()
            return false
        }
    }

    private func summary(for composer: CreateBookingViewModel, id: String) -> BookingDraftSummary {
        BookingDraftSummary(
            id: id,
            kind: "RESERVATION",
            title: composer.title,
            locationName: composer.selectedLocation?.name,
            startsAt: composer.startsAt,
            endsAt: composer.endsAt,
            itemCount: composer.selectedEquipmentCount,
            updatedAt: .now
        )
    }

    private func deleteServerDraftIfAny(
        expectedComposer: CreateBookingViewModel?,
        ownership: OperationOwnership
    ) async -> Bool {
        guard canPublish(ownership), composer === expectedComposer else { return false }
        guard let draftId = expectedComposer?.serverDraftId ?? savedDraft?.id else { return true }
        let expectedSavedDraftId = savedDraft?.id
        do {
            try await persistence.deleteBookingDraft(id: draftId)
            guard canPublish(ownership),
                  composer === expectedComposer,
                  expectedSavedDraftId == savedDraft?.id
            else { return false }
            expectedComposer?.serverDraftId = nil
            return true
        } catch {
            guard canPublish(ownership),
                  composer === expectedComposer,
                  expectedSavedDraftId == savedDraft?.id
            else { return false }
            errorMessage = "Couldn't discard your draft. \(error.localizedDescription)"
            Haptics.warning()
            return false
        }
    }

    private func beginBusyOperation() -> OperationOwnership? {
        guard !isBusy else { return nil }
        let ownership = OperationOwnership(
            sessionBoundaryId: sessionBoundaryId,
            operationId: UUID()
        )
        busyOperationId = ownership.operationId
        isBusy = true
        return ownership
    }

    private func canPublish(_ ownership: OperationOwnership) -> Bool {
        sessionBoundaryId == ownership.sessionBoundaryId
            && busyOperationId == ownership.operationId
            && !Task.isCancelled
    }

    private func canPublishLoad(
        requestToken: UUID,
        ownership: OperationOwnership
    ) -> Bool {
        canPublish(ownership) && loadRequests.owns(requestToken)
    }

    private func finishBusyOperation(_ ownership: OperationOwnership) {
        guard sessionBoundaryId == ownership.sessionBoundaryId,
              busyOperationId == ownership.operationId
        else { return }
        busyOperationId = nil
        isBusy = false
        if loadOperationId == ownership.operationId {
            loadOperationId = nil
        }
    }

    private func finishLoad(requestToken: UUID, ownership: OperationOwnership) {
        guard loadRequests.owns(requestToken) else { return }
        loadTask = nil
        loadRequests.invalidate()
        finishBusyOperation(ownership)
    }

    private func cancelLoad() {
        loadTask?.cancel()
        loadTask = nil
        loadRequests.invalidate()
        guard let loadOperationId,
              busyOperationId == loadOperationId
        else {
            self.loadOperationId = nil
            return
        }
        busyOperationId = nil
        self.loadOperationId = nil
        isBusy = false
    }
}
