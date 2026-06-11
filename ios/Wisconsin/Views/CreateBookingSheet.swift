import SwiftUI

/// Returns the next clean hour boundary after `now`, plus `addingHours`.
/// `addingHours: 0` → the upcoming `:00`; `addingHours: 1` → one hour after that.
private func nextCleanHour(addingHours: Int = 0) -> Date {
    let cal = Calendar.current
    let nextHour = cal.nextDate(
        after: .now,
        matching: DateComponents(minute: 0, second: 0),
        matchingPolicy: .nextTime
    ) ?? .now
    return cal.date(byAdding: .hour, value: addingHours, to: nextHour) ?? nextHour
}

@MainActor
@Observable
final class CreateBookingViewModel {
    var title = ""
    var selectedUserId: String = ""
    var selectedLocationId: String = ""
    var startsAt = nextCleanHour(addingHours: 0)
    var endsAt = nextCleanHour(addingHours: 1)
    var notes = ""
    var userEditedTitle = false
    var userEditedLocation = false
    var userEditedWindow = false

    var prefillEventId: String?
    var prefillShiftAssignmentId: String?

    var options: FormOptions?
    var events: [ScheduleEvent] = []
    var selectedEventIds: [String] = []
    var isLoadingOptions = false
    var isLoadingEvents = false
    var isSubmitting = false
    var error: String?
    var eventError: String?

    // Equipment selection
    var selectedAssetIds: Set<String> = []
    var selectedBulkQuantities: [String: Int] = [:]
    var availableAssets: [Asset] = []
    var selectedAssetSnapshots: [String: Asset] = [:]
    var isLoadingAssets = false
    var isAddingScannedAsset = false
    var assetSearch = ""
    var assetTotal = 0
    var assetOffset = 0
    var scanError: String?
    var hasMoreAssets: Bool { availableAssets.count < assetTotal }
    private var searchTask: Task<Void, Never>?

    // Conflict checking — non-blocking pre-flight hint against the date window.
    var conflictedAssetIds: Set<String> = []
    private var conflictCheckTask: Task<Void, Never>?

    func scheduleConflictCheck() {
        conflictCheckTask?.cancel()
        guard !selectedAssetIds.isEmpty, !selectedLocationId.isEmpty, endsAt > startsAt else {
            conflictedAssetIds = []
            return
        }
        let ids = Array(selectedAssetIds)
        let location = selectedLocationId
        let start = startsAt, end = endsAt
        conflictCheckTask = Task {
            try? await Task.sleep(for: .milliseconds(500))
            guard !Task.isCancelled else { return }
            let result = await APIClient.shared.checkAvailability(
                locationId: location, serializedAssetIds: ids, startsAt: start, endsAt: end
            )
            conflictedAssetIds = Set(result.keys)
        }
    }

    var selectedUser: FormUser? { options?.users.first(where: { $0.id == selectedUserId }) }
    var selectedLocation: FormOption? { options?.locations.first(where: { $0.id == selectedLocationId }) }
    var selectedEvents: [ScheduleEvent] {
        let byId = Dictionary(uniqueKeysWithValues: events.map { ($0.id, $0) })
        return selectedEventIds
            .compactMap { byId[$0] }
            .sorted { $0.startsAt < $1.startsAt }
    }
    var linkedEventCount: Int {
        if !selectedEventIds.isEmpty { return selectedEventIds.count }
        return prefillEventId == nil ? 0 : 1
    }
    var linkedEventLabel: String? {
        if selectedEvents.isEmpty {
            return prefillEventId == nil ? nil : "Linked to event"
        }
        if selectedEvents.count == 1 { return selectedEvents[0].shortBookingEventTitle }
        return "\(selectedEvents.count) linked events"
    }
    var selectedAssets: [Asset] {
        selectedAssetIds
            .compactMap { id in selectedAssetSnapshots[id] ?? availableAssets.first(where: { $0.id == id }) }
            .sorted { $0.displayName.localizedCaseInsensitiveCompare($1.displayName) == .orderedAscending }
    }
    var availableBulkSkus: [FormBulkSku] {
        let all = options?.bulkSkus ?? []
        let query = assetSearch.trimmingCharacters(in: .whitespacesAndNewlines)
        return all
            .filter { sku in
                guard selectedLocationId.isEmpty || sku.locationId == nil || sku.locationId == selectedLocationId else { return false }
                if query.isEmpty { return true }
                return sku.name.localizedCaseInsensitiveContains(query)
                    || (sku.categoryName?.localizedCaseInsensitiveContains(query) ?? false)
                    || (sku.category?.localizedCaseInsensitiveContains(query) ?? false)
            }
            .sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
    }
    var selectedBulkSkus: [FormBulkSku] {
        let all = options?.bulkSkus ?? []
        return all
            .filter { (selectedBulkQuantities[$0.id] ?? 0) > 0 }
            .sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
    }
    var selectedBulkTotal: Int {
        selectedBulkQuantities.values.reduce(0, +)
    }
    var selectedEquipmentCount: Int {
        selectedAssetIds.count + selectedBulkTotal
    }
    var selectedBulkRequests: [BulkReservationRequest] {
        selectedBulkQuantities
            .filter { $0.value > 0 }
            .sorted { $0.key < $1.key }
            .map { BulkReservationRequest(bulkSkuId: $0.key, quantity: $0.value) }
    }

    var isValid: Bool {
        !title.trimmingCharacters(in: .whitespaces).isEmpty
            && !selectedUserId.isEmpty
            && !selectedLocationId.isEmpty
            && endsAt > startsAt
    }

    /// Moves the start date while preserving the booking duration, matching
    /// calendar-app behavior. Only called from the From picker binding so
    /// programmatic prefills never shift an explicitly set end date.
    func adjustStart(to newStart: Date) {
        userEditedWindow = true
        let duration = endsAt.timeIntervalSince(startsAt)
        startsAt = newStart
        endsAt = newStart.addingTimeInterval(max(duration, 0))
    }

    func adjustEnd(to newEnd: Date) {
        userEditedWindow = true
        endsAt = newEnd
    }

    func prefill(title: String, startsAt: Date, endsAt: Date, userId: String, eventId: String?, shiftAssignmentId: String?) {
        self.title = title
        self.startsAt = startsAt
        self.endsAt = endsAt
        self.selectedUserId = userId
        self.prefillEventId = eventId
        self.prefillShiftAssignmentId = shiftAssignmentId
    }

    func loadEvents() async {
        guard events.isEmpty else { return }
        isLoadingEvents = true
        eventError = nil
        do {
            events = try await APIClient.shared.calendarEvents(includePast: false, limit: 60)
        } catch {
            eventError = error.localizedDescription
        }
        isLoadingEvents = false
    }

    func toggleEvent(_ event: ScheduleEvent) {
        if selectedEventIds.contains(event.id) {
            selectedEventIds.removeAll { $0 == event.id }
        } else {
            guard selectedEventIds.count < 3 else {
                Haptics.warning()
                return
            }
            selectedEventIds.append(event.id)
        }
        sortSelectedEventIds()
        applySelectedEventsToDetails()
        Haptics.selection()
    }

    func removeSelectedEvent(_ event: ScheduleEvent) {
        selectedEventIds.removeAll { $0 == event.id }
        applySelectedEventsToDetails()
    }

    func setTitleFromUser(_ value: String) {
        userEditedTitle = true
        title = value
    }

    func setLocationFromUser(_ value: String) {
        userEditedLocation = true
        selectedLocationId = value
    }

    private func sortSelectedEventIds() {
        let byId = Dictionary(uniqueKeysWithValues: events.map { ($0.id, $0) })
        selectedEventIds.sort {
            (byId[$0]?.startsAt ?? .distantFuture) < (byId[$1]?.startsAt ?? .distantFuture)
        }
    }

    private func applySelectedEventsToDetails() {
        let picked = selectedEvents
        guard let first = picked.first else { return }
        if !userEditedTitle || title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            title = "Gear - \(first.summary)"
            userEditedTitle = false
        }
        if !userEditedLocation, let locationId = first.location?.id {
            selectedLocationId = locationId
        }
        if !userEditedWindow {
            startsAt = first.startsAt
            endsAt = picked.last?.endsAt ?? first.endsAt
        }
        prefillEventId = nil
        prefillShiftAssignmentId = nil
        scheduleConflictCheck()
    }

    /// Prefills a reservation context started from an item row.
    /// Sets a sensible title, preselects the asset, and seeds the equipment list
    /// so the asset is visible at the top of step 2.
    func prefillReservation(for asset: Asset) {
        if title.isEmpty {
            title = "Reservation: \(asset.displayName)"
        }
        selectedAssetIds.insert(asset.id)
        selectedAssetSnapshots[asset.id] = asset
        if !availableAssets.contains(where: { $0.id == asset.id }) {
            availableAssets.insert(asset, at: 0)
            if assetTotal == 0 { assetTotal = 1 }
        }
        // Pre-seed the location to the asset's home location if nothing is set yet.
        if selectedLocationId.isEmpty {
            selectedLocationId = asset.location.id
        }
    }

    func loadOptions() async {
        guard options == nil else { return }
        isLoadingOptions = true
        do {
            options = try await APIClient.shared.formOptions()
        } catch {
            self.error = error.localizedDescription
        }
        isLoadingOptions = false
    }

    func loadAvailableAssets(reset: Bool = false) async {
        // For pagination keep the concurrent-call guard. For reset (the
        // search-driven path) drop it and let the snapshot guard below
        // handle ordering — otherwise a fast typist can trigger debounce,
        // hit the `isLoadingAssets` gate, and silently lose the new query.
        if !reset, isLoadingAssets { return }
        let capturedSearch = assetSearch
        if reset {
            availableAssets = []
            assetOffset = 0
            assetTotal = 0
            error = nil
        }
        isLoadingAssets = true
        defer { isLoadingAssets = false }
        do {
            let resp = try await APIClient.shared.assets(
                search: capturedSearch.isEmpty ? nil : capturedSearch,
                statuses: [.available],
                limit: 30,
                offset: assetOffset
            )
            // Stale-write guard: drop the response if the user has typed more
            // since this request was started. Mirrors the global-search fix.
            guard capturedSearch == assetSearch else { return }
            availableAssets += resp.data
            for asset in resp.data where selectedAssetIds.contains(asset.id) {
                selectedAssetSnapshots[asset.id] = asset
            }
            assetTotal = resp.total
            assetOffset += resp.data.count
        } catch {
            guard capturedSearch == assetSearch else { return }
            self.error = error.localizedDescription
        }
    }

    func toggleAsset(_ asset: Asset) {
        if selectedAssetIds.contains(asset.id) {
            selectedAssetIds.remove(asset.id)
            selectedAssetSnapshots.removeValue(forKey: asset.id)
        } else {
            selectedAssetIds.insert(asset.id)
            selectedAssetSnapshots[asset.id] = asset
        }
        scheduleConflictCheck()
    }

    func removeSelectedAsset(_ asset: Asset) {
        selectedAssetIds.remove(asset.id)
        selectedAssetSnapshots.removeValue(forKey: asset.id)
        scheduleConflictCheck()
    }

    func quantity(for sku: FormBulkSku) -> Int {
        selectedBulkQuantities[sku.id] ?? 0
    }

    func setBulkQuantity(_ sku: FormBulkSku, quantity: Int) {
        let clamped = min(max(quantity, 0), max(sku.availableQuantity, 0))
        if clamped == 0 {
            selectedBulkQuantities.removeValue(forKey: sku.id)
        } else {
            selectedBulkQuantities[sku.id] = clamped
        }
    }

    func incrementBulk(_ sku: FormBulkSku) {
        setBulkQuantity(sku, quantity: quantity(for: sku) + 1)
    }

    func decrementBulk(_ sku: FormBulkSku) {
        setBulkQuantity(sku, quantity: quantity(for: sku) - 1)
    }

    func removeSelectedBulk(_ sku: FormBulkSku) {
        selectedBulkQuantities.removeValue(forKey: sku.id)
    }

    func addScannedAsset(id: String) async {
        scanError = nil
        isAddingScannedAsset = true
        defer { isAddingScannedAsset = false }
        do {
            let detail = try await APIClient.shared.asset(id: id)
            let asset = detail.asAsset
            guard asset.computedStatus == .available else {
                scanError = "\(asset.displayName) is \(asset.computedStatus.label.lowercased())."
                Haptics.warning()
                return
            }
            selectedAssetIds.insert(asset.id)
            selectedAssetSnapshots[asset.id] = asset
            if !availableAssets.contains(where: { $0.id == asset.id }) {
                availableAssets.insert(asset, at: 0)
                assetTotal = max(assetTotal, availableAssets.count)
            }
            scheduleConflictCheck()
            Haptics.success()
        } catch {
            scanError = error.localizedDescription
            Haptics.error()
        }
    }

    func onSearchChange() {
        searchTask?.cancel()
        searchTask = Task {
            try? await Task.sleep(for: .milliseconds(350))
            guard !Task.isCancelled else { return }
            await loadAvailableAssets(reset: true)
        }
    }

    func submit() async throws -> String {
        guard !selectedUserId.isEmpty, !selectedLocationId.isEmpty else {
            throw APIError.serverError("Select a requester and location.")
        }
        isSubmitting = true
        defer { isSubmitting = false }
        return try await APIClient.shared.createReservation(
            title: title.trimmingCharacters(in: .whitespaces),
            requesterUserId: selectedUserId,
            locationId: selectedLocationId,
            startsAt: startsAt,
            endsAt: endsAt,
            notes: notes.isEmpty ? nil : notes,
            eventId: selectedEventIds.isEmpty ? prefillEventId : nil,
            eventIds: selectedEventIds,
            shiftAssignmentId: prefillShiftAssignmentId,
            serializedAssetIds: Array(selectedAssetIds),
            bulkItems: selectedBulkRequests
        )
    }
}

struct CreateBookingSheet: View {
    let onCreated: (String) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var vm: CreateBookingViewModel
    @State private var step = 1
    @State private var submitError: String?
    @State private var showDiscardConfirm = false
    @State private var initialUserId: String = ""
    @State private var initialLocationId: String = ""
    @State private var initialStartsAt: Date = .now
    @State private var initialEndsAt: Date = .now
    @State private var initialEventIds: [String] = []
    @State private var capturedInitial = false
    @State private var showScanner = false
    @Environment(SessionStore.self) private var session

    init(onCreated: @escaping (String) -> Void) {
        _vm = State(wrappedValue: CreateBookingViewModel())
        self.onCreated = onCreated
    }

    init(vm: CreateBookingViewModel, onCreated: @escaping (String) -> Void) {
        _vm = State(wrappedValue: vm)
        self.onCreated = onCreated
    }

    private var canPickRequester: Bool {
        let role = session.currentUser?.role ?? ""
        return role == "STAFF" || role == "ADMIN"
    }

    private var hasUnsavedInput: Bool {
        if !vm.title.trimmingCharacters(in: .whitespaces).isEmpty { return true }
        if !vm.notes.isEmpty { return true }
        if !vm.selectedAssetIds.isEmpty { return true }
        if vm.selectedBulkTotal > 0 { return true }
        if vm.selectedEventIds != initialEventIds { return true }
        // Track requester / location / date deltas so a STAFF user who picks
        // a requester + adjusts dates and then taps Cancel gets a discard
        // prompt before losing the setup.
        guard capturedInitial else { return false }
        if vm.selectedUserId != initialUserId { return true }
        if vm.selectedLocationId != initialLocationId { return true }
        if vm.startsAt != initialStartsAt { return true }
        if vm.endsAt != initialEndsAt { return true }
        return false
    }

    private func attemptCancel() {
        if vm.isSubmitting { return }
        if hasUnsavedInput {
            showDiscardConfirm = true
        } else {
            dismiss()
        }
    }

    var body: some View {
        NavigationStack {
            Group {
                if step == 1 {
                    detailsForm
                } else if step == 2 {
                    equipmentPicker
                } else {
                    reviewStep
                }
            }
            .navigationTitle(step == 1 ? "New Reservation" : step == 2 ? "Equipment" : "Confirm")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { toolbar }
            .confirmationDialog(
                "Couldn't create reservation",
                isPresented: Binding(
                    get: { submitError != nil },
                    set: { if !$0 { submitError = nil } }
                ),
                titleVisibility: .visible
            ) {
                Button("Try again") {
                    submitError = nil
                    Task { await create() }
                }
                Button("OK", role: .cancel) {}
            } message: {
                Text(submitError ?? "")
            }
            .confirmationDialog(
                "Discard reservation?",
                isPresented: $showDiscardConfirm,
                titleVisibility: .visible
            ) {
                Button("Discard", role: .destructive) { dismiss() }
                Button("Keep Editing", role: .cancel) {}
            } message: {
                Text("Your changes will be lost.")
            }
            .interactiveDismissDisabled(hasUnsavedInput || vm.isSubmitting)
            .task {
                async let optionsTask: Void = vm.loadOptions()
                async let eventsTask: Void = vm.loadEvents()
                _ = await (optionsTask, eventsTask)
            }
            .fullScreenCover(isPresented: $showScanner) {
                QRScannerSheet { match in
                    showScanner = false
                    switch match {
                    case .asset(let assetId):
                        Task { await vm.addScannedAsset(id: assetId) }
                    case .itemFamily(let family):
                        vm.scanError = "\(family.name) is an item family. Add it with the quantity controls."
                        Haptics.warning()
                    }
                }
            }
            .onChange(of: vm.options) {
                if vm.selectedUserId.isEmpty, let current = session.currentUser {
                    if vm.options?.users.contains(where: { $0.id == current.id }) == true {
                        vm.selectedUserId = current.id
                    }
                }
                captureInitialIfNeeded()
            }
            .onAppear { captureInitialIfNeeded() }
        }
    }

    /// Snapshots the initial requester / location / date values once the
    /// view-model has had a chance to apply prefills (from the items-list or
    /// item-detail Reserve flows). `hasUnsavedInput` compares against these
    /// to detect changes the user made on top of any prefill.
    private func captureInitialIfNeeded() {
        if capturedInitial { return }
        // Wait until we have a non-empty user (either prefilled or auto-set
        // from the current session) — otherwise the snapshot would record
        // "" and a later auto-fill would falsely register as a delta.
        guard !vm.selectedUserId.isEmpty else { return }
        initialUserId = vm.selectedUserId
        initialLocationId = vm.selectedLocationId
        initialStartsAt = vm.startsAt
        initialEndsAt = vm.endsAt
        initialEventIds = vm.selectedEventIds
        capturedInitial = true
    }

    @ToolbarContentBuilder
    private var toolbar: some ToolbarContent {
        ToolbarItem(placement: .cancellationAction) {
            if step == 1 {
                Button("Cancel") { attemptCancel() }
                    .disabled(vm.isSubmitting)
            } else {
                Button("Back") { step -= 1 }
                    .disabled(vm.isSubmitting)
            }
        }
        ToolbarItem(placement: .confirmationAction) {
            if step == 1 {
                Button("Next") {
                    step = 2
                    Task { await vm.loadAvailableAssets(reset: true) }
                    vm.scheduleConflictCheck()
                }
                .disabled(!vm.isValid || vm.isSubmitting)
                .fontWeight(.semibold)
            } else if step == 2 {
                // Mirrors web: equipment is required before review, and the
                // primary action reads "Review", not a submit.
                Button("Review") { step = 3 }
                    .disabled(vm.selectedEquipmentCount == 0 || vm.isSubmitting)
                    .fontWeight(.semibold)
            }
            // Step 3's primary action is the prominent inline button in
            // reviewStep (Apple review-screen pattern, same as web Step 3).
        }
    }

    @ViewBuilder
    private var detailsForm: some View {
        ScrollView {
            VStack(spacing: 18) {
                BookingStepHeader(
                    icon: "calendar.badge.plus",
                    eyebrow: "Reservation",
                    title: vm.title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? "Plan the hold" : vm.title,
                    subtitle: detailHeaderSubtitle
                )

                FormCard {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Title")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(.secondary)
                            .textCase(.uppercase)
                        TextField(
                            "Booking title",
                            text: Binding(
                                get: { vm.title },
                                set: { vm.setTitleFromUser($0) }
                            )
                        )
                        .font(.title3.weight(.semibold))
                        .submitLabel(.next)
                    }
                }

                FormCard {
                    if vm.isLoadingOptions {
                        HStack {
                            ProgressView()
                            Text("Loading…").font(.subheadline).foregroundStyle(.secondary)
                        }
                        .frame(maxWidth: .infinity, alignment: .center)
                        .padding(.vertical, 4)
                    } else {
                        if canPickRequester {
                            NavigationLink {
                                RequesterPickerView(
                                    users: vm.options?.users ?? [],
                                    currentUserId: session.currentUser?.id,
                                    selection: $vm.selectedUserId
                                )
                            } label: {
                                FormPickerRow(
                                    label: "For",
                                    value: vm.selectedUser?.name ?? "Select person"
                                ) {
                                    if let selected = vm.selectedUser {
                                        UserAvatarView(name: selected.name, avatarUrl: selected.avatarUrl, size: 26)
                                    }
                                }
                            }
                            .buttonStyle(.plain)
                        } else {
                            // Student: locked to self.
                            FormPickerRow(
                                label: "For",
                                value: session.currentUser?.name ?? "You"
                            ) {
                                if let current = session.currentUser {
                                    UserAvatarView(name: current.name, avatarUrl: current.avatarUrl, size: 26)
                                }
                            }
                            .opacity(0.85)
                        }

                        Divider().padding(.leading, 4)

                        NavigationLink {
                            OptionPickerView(
                                title: "Location",
                                options: vm.options?.locations.map { ($0.id, $0.name) } ?? [],
                                selection: Binding(
                                    get: { vm.selectedLocationId },
                                    set: { vm.setLocationFromUser($0) }
                                )
                            )
                        } label: {
                            FormPickerRow(
                                label: "At",
                                value: vm.selectedLocation?.name ?? "Select location"
                            )
                        }
                        .buttonStyle(.plain)
                    }
                }

                EventLinkingCard(
                    events: vm.events,
                    selectedEvents: vm.selectedEvents,
                    isLoading: vm.isLoadingEvents,
                    error: vm.eventError,
                    onRetry: { Task { await vm.loadEvents() } },
                    onToggle: { vm.toggleEvent($0) },
                    onRemove: { vm.removeSelectedEvent($0) }
                )

                FormCard {
                    DatePicker(
                        "From",
                        selection: Binding(
                            get: { vm.startsAt },
                            set: { vm.adjustStart(to: $0) }
                        ),
                        displayedComponents: [.date, .hourAndMinute]
                    )
                    .tint(.accentColor)
                    Divider().padding(.leading, 4)
                    DatePicker(
                        "To",
                        selection: Binding(
                            get: { vm.endsAt },
                            set: { vm.adjustEnd(to: $0) }
                        ),
                        in: vm.startsAt...,
                        displayedComponents: [.date, .hourAndMinute]
                    )
                        .tint(.accentColor)
                }

                FormCard {
                    TextField("Notes (optional)", text: $vm.notes, axis: .vertical)
                        .lineLimit(3...6)
                        .font(.body)
                }

                if let error = vm.error {
                    Text(error)
                        .font(.footnote)
                        .foregroundStyle(Color.statusText(.red))
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, 4)
                }
            }
            .padding(20)
        }
        .background(Color(.systemGroupedBackground))
    }

    private var detailHeaderSubtitle: String {
        let window = "\(vm.startsAt.formatted(date: .abbreviated, time: .shortened)) to \(vm.endsAt.formatted(date: .omitted, time: .shortened))"
        if let linked = vm.linkedEventLabel {
            return "\(linked) · \(window)"
        }
        return window
    }

    @ViewBuilder
    private var equipmentPicker: some View {
        List {
            Section {
                BookingStepHeader(
                    icon: "shippingbox.and.arrow.backward",
                    eyebrow: "Equipment",
                    title: vm.selectedEquipmentCount == 0 ? "Choose the gear" : "\(vm.selectedEquipmentCount) selected",
                    subtitle: vm.linkedEventLabel ?? "Search, scan, or add counted supplies."
                )
                .listRowInsets(EdgeInsets(top: 8, leading: 20, bottom: 12, trailing: 20))
                .listRowBackground(Color.clear)
            }

            Section {
                TextField("Search equipment…", text: $vm.assetSearch)
                    .onChange(of: vm.assetSearch) { vm.onSearchChange() }
            }

            Section {
                Button {
                    showScanner = true
                } label: {
                    Label("Scan equipment", systemImage: "barcode.viewfinder")
                }
                .disabled(vm.isAddingScannedAsset)

                if vm.isAddingScannedAsset {
                    HStack(spacing: 10) {
                        ProgressView()
                        Text("Adding scanned item…")
                            .foregroundStyle(.secondary)
                    }
                    .font(.subheadline)
                }

                if let scanError = vm.scanError {
                    Label(scanError, systemImage: "exclamationmark.triangle.fill")
                        .font(.footnote)
                        .foregroundStyle(Color.statusText(.orange))
                }
            }

            if vm.selectedEquipmentCount > 0 {
                Section {
                    let count = vm.selectedEquipmentCount
                    Label("\(count) item\(count == 1 ? "" : "s") selected", systemImage: "checkmark.circle.fill")
                        .font(.subheadline)
                        .foregroundStyle(Color.statusText(.blue))
                        .accessibilityLabel("\(count) item\(count == 1 ? "" : "s") selected")

                    ForEach(vm.selectedAssets) { asset in
                        SelectedEquipmentRow(
                            asset: asset,
                            isConflicted: vm.conflictedAssetIds.contains(asset.id)
                        ) {
                            vm.removeSelectedAsset(asset)
                            Haptics.selection()
                        }
                    }
                    ForEach(vm.selectedBulkSkus) { sku in
                        SelectedBulkRow(
                            sku: sku,
                            quantity: vm.quantity(for: sku)
                        ) {
                            vm.removeSelectedBulk(sku)
                            Haptics.selection()
                        }
                    }
                } header: {
                    Text("Selected Equipment")
                } footer: {
                    Text("Remove anything you do not want before creating the reservation.")
                }
            }

            if !vm.availableBulkSkus.isEmpty {
                Section {
                    ForEach(vm.availableBulkSkus) { sku in
                        BulkQuantityRow(
                            sku: sku,
                            quantity: vm.quantity(for: sku),
                            onDecrement: {
                                vm.decrementBulk(sku)
                                Haptics.selection()
                            },
                            onIncrement: {
                                vm.incrementBulk(sku)
                                Haptics.selection()
                            }
                        )
                    }
                } header: {
                    Text("Batteries & Counted Items")
                }
            }

            Section {
                if vm.availableAssets.isEmpty && !vm.isLoadingAssets, let err = vm.error {
                    // Surface a load error with retry — was previously
                    // silent; user saw "No available equipment found"
                    // (misleading) on a server failure.
                    HStack(spacing: 12) {
                        Image(systemName: "wifi.exclamationmark")
                            .foregroundStyle(Color.statusText(.red))
                            .accessibilityHidden(true)
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Couldn't load equipment")
                                .font(.subheadline.weight(.medium))
                            Text(err)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                                .lineLimit(2)
                        }
                        Spacer()
                        Button("Retry") {
                            Task { await vm.loadAvailableAssets(reset: true) }
                        }
                        .buttonStyle(.bordered)
                        .controlSize(.small)
                    }
                } else if vm.availableAssets.isEmpty && !vm.isLoadingAssets {
                    Text("No available equipment found.")
                        .foregroundStyle(.secondary)
                        .font(.subheadline)
                } else {
                    ForEach(vm.availableAssets) { asset in
                        AssetPickerRow(
                            asset: asset,
                            isSelected: vm.selectedAssetIds.contains(asset.id),
                            isConflicted: vm.conflictedAssetIds.contains(asset.id)
                        ) {
                            vm.toggleAsset(asset)
                            Haptics.selection()
                        }
                        .onAppear {
                            if asset.id == vm.availableAssets.last?.id && vm.hasMoreAssets {
                                Task { await vm.loadAvailableAssets() }
                            }
                        }
                    }
                }

                if vm.isLoadingAssets {
                    HStack {
                        Spacer()
                        ProgressView()
                        Spacer()
                    }
                    .listRowBackground(Color.clear)
                }
            }

        }
        .listStyle(.insetGrouped)
        .scrollDismissesKeyboard(.immediately)
    }

    /// Apple-style review confirmation — the little brother of web Step 3:
    /// kind icon, the window as the hero claim, requester/location, a narrow
    /// facts table, the equipment list, and one primary action.
    @ViewBuilder
    private var reviewStep: some View {
        ScrollView {
            VStack(spacing: 24) {
                VStack(spacing: 0) {
                    // Canonical reservation identity: calendar on purple.
                    Image(systemName: vm.linkedEventCount > 0 ? "calendar.badge.checkmark" : "calendar")
                        .font(.title2.weight(.semibold))
                        .foregroundStyle(Color.statusText(.purple))
                        .frame(width: 56, height: 56)
                        .background(Color.statusBackground(.purple), in: RoundedRectangle(cornerRadius: 16))

                    Text(vm.title.isEmpty ? "Review your reservation" : vm.title)
                        .font(.title2.weight(.bold))
                        .multilineTextAlignment(.center)
                        .lineLimit(2)
                        .padding(.top, 18)

                    Text(vm.startsAt.formatted(date: .abbreviated, time: .shortened))
                        .font(.title2.weight(.semibold))
                        .monospacedDigit()
                        .padding(.top, 20)
                    Text("Ends \(vm.endsAt.formatted(date: .abbreviated, time: .shortened))")
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(.secondary)
                        .padding(.top, 2)

                    VStack(spacing: 2) {
                        Text(vm.selectedUser?.name ?? session.currentUser?.name ?? "")
                        Text(vm.selectedLocation?.name ?? "")
                    }
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .padding(.top, 14)

                    VStack(spacing: 0) {
                        reviewFactRow(label: "Status") {
                            Text("Reserved")
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(Color.statusText(.purple))
                                .padding(.horizontal, 8)
                                .padding(.vertical, 3)
                                .background(Color.statusBackground(.purple), in: Capsule())
                        }
                        Divider()
                        reviewFactRow(label: "Equipment") {
                            Text("\(vm.selectedEquipmentCount) item\(vm.selectedEquipmentCount == 1 ? "" : "s")")
                                .font(.subheadline.weight(.medium))
                                .monospacedDigit()
                        }
                        if let linked = vm.linkedEventLabel {
                            Divider()
                            reviewFactRow(label: vm.linkedEventCount > 1 ? "Events" : "Event") {
                                Text(linked)
                                    .font(.subheadline.weight(.medium))
                                    .multilineTextAlignment(.trailing)
                            }
                        }
                        if !vm.notes.isEmpty {
                            Divider()
                            reviewFactRow(label: "Notes") {
                                Text(vm.notes)
                                    .font(.subheadline)
                                    .multilineTextAlignment(.trailing)
                            }
                        }
                    }
                    .padding(.top, 22)
                    .overlay(Rectangle().frame(height: 0.5).foregroundStyle(Color(.separator)), alignment: .top)
                    .overlay(Rectangle().frame(height: 0.5).foregroundStyle(Color(.separator)), alignment: .bottom)
                }
                .frame(maxWidth: .infinity)
                .padding(.top, 28)
                .padding(.horizontal, 20)

                // Advisory only — server enforcement at submit is authoritative,
                // same semantics as the web availability review.
                if !vm.conflictedAssetIds.isEmpty {
                    let count = vm.conflictedAssetIds.count
                    HStack(spacing: 10) {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .foregroundStyle(Color.statusText(.orange))
                        Text("\(count) scheduling conflict\(count == 1 ? "" : "s") — availability is rechecked when you reserve.")
                            .font(.footnote)
                            .foregroundStyle(.primary)
                        Spacer(minLength: 0)
                    }
                    .padding(12)
                    .background(Color.statusBackground(.orange), in: RoundedRectangle(cornerRadius: 12))
                    .padding(.horizontal, 20)
                }

                // Equipment list — concise, not the visual center.
                VStack(alignment: .leading, spacing: 8) {
                    Text("Equipment")
                        .font(.subheadline.weight(.semibold))
                    VStack(spacing: 0) {
                        ForEach(Array(vm.selectedAssets.enumerated()), id: \.element.id) { index, asset in
                            if index > 0 { Divider().padding(.leading, 12) }
                            HStack(spacing: 10) {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(asset.displayName)
                                        .font(.subheadline.weight(.medium))
                                        .lineLimit(1)
                                    if let tag = asset.assetTag {
                                        Text(tag)
                                            .font(.caption)
                                            .fontDesign(.monospaced)
                                            .foregroundStyle(.secondary)
                                    }
                                }
                                Spacer()
                                if vm.conflictedAssetIds.contains(asset.id) {
                                    Image(systemName: "exclamationmark.triangle.fill")
                                        .font(.caption)
                                        .foregroundStyle(Color.statusText(.orange))
                                        .accessibilityLabel("Scheduling conflict")
                                }
                            }
                            .padding(.horizontal, 12)
                            .padding(.vertical, 10)
                        }
                        if !vm.selectedAssets.isEmpty && !vm.selectedBulkSkus.isEmpty {
                            Divider().padding(.leading, 12)
                        }
                        ForEach(Array(vm.selectedBulkSkus.enumerated()), id: \.element.id) { index, sku in
                            if index > 0 { Divider().padding(.leading, 12) }
                            HStack(spacing: 10) {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(sku.name)
                                        .font(.subheadline.weight(.medium))
                                        .lineLimit(1)
                                    Text(bulkSubtitle(sku))
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                                Spacer()
                                Text("×\(vm.quantity(for: sku))")
                                    .font(.subheadline.weight(.semibold))
                                    .monospacedDigit()
                                    .foregroundStyle(.secondary)
                            }
                            .padding(.horizontal, 12)
                            .padding(.vertical, 10)
                        }
                    }
                    .background(Color(.systemBackground), in: RoundedRectangle(cornerRadius: 12))
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .strokeBorder(Color(.separator).opacity(0.6), lineWidth: 0.5)
                    )
                }
                .padding(.horizontal, 20)

                if !vm.selectedEvents.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        Text(vm.selectedEvents.count == 1 ? "Linked Event" : "Linked Events")
                            .font(.subheadline.weight(.semibold))
                        VStack(spacing: 0) {
                            ForEach(Array(vm.selectedEvents.enumerated()), id: \.element.id) { index, event in
                                if index > 0 { Divider().padding(.leading, 12) }
                                ReviewEventRow(event: event)
                            }
                        }
                        .background(Color(.systemBackground), in: RoundedRectangle(cornerRadius: 12))
                        .overlay(
                            RoundedRectangle(cornerRadius: 12)
                                .strokeBorder(Color(.separator).opacity(0.6), lineWidth: 0.5)
                        )
                    }
                    .padding(.horizontal, 20)
                }

                // One primary action, prominent and inline — like web Step 3.
                Button {
                    Task { await create() }
                } label: {
                    Group {
                        if vm.isSubmitting {
                            ProgressView().tint(.white)
                        } else {
                            Text("Reserve for later")
                                .fontWeight(.semibold)
                        }
                    }
                    .frame(maxWidth: .infinity, minHeight: 44)
                }
                .buttonStyle(.borderedProminent)
                .disabled(vm.isSubmitting)
                .padding(.horizontal, 20)
                .padding(.bottom, 24)
            }
        }
        .background(Color(.systemGroupedBackground))
    }

    @ViewBuilder
    private func reviewFactRow(label: String, @ViewBuilder value: () -> some View) -> some View {
        HStack(alignment: .firstTextBaseline) {
            Text(label.uppercased())
                .font(.caption2.weight(.bold))
                .kerning(0.8)
                .foregroundStyle(.secondary)
            Spacer()
            value()
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 12)
    }

    private func create() async {
        do {
            let id = try await vm.submit()
            Haptics.success()
            onCreated(id)
            dismiss()
        } catch {
            submitError = error.localizedDescription
            Haptics.warning()
        }
    }

    private func bulkSubtitle(_ sku: FormBulkSku) -> String {
        let unit = sku.unit?.isEmpty == false ? " \(sku.unit!)" : ""
        let pickup = sku.trackByNumber ? " · units scan at pickup" : ""
        return "\(sku.availableQuantity) available\(unit)\(pickup)"
    }
}

private struct BookingStepHeader: View {
    let icon: String
    let eyebrow: String
    let title: String
    let subtitle: String

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 12) {
                Image(systemName: icon)
                    .font(.headline.weight(.semibold))
                    .foregroundStyle(Color.statusText(.purple))
                    .frame(width: 42, height: 42)
                    .background(Color.statusBackground(.purple), in: RoundedRectangle(cornerRadius: 12))
                    .accessibilityHidden(true)

                VStack(alignment: .leading, spacing: 3) {
                    Text(eyebrow)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                        .textCase(.uppercase)
                    Text(title)
                        .font(.title2.weight(.bold))
                        .foregroundStyle(.primary)
                        .lineLimit(2)
                        .minimumScaleFactor(0.85)
                }
            }

            Text(subtitle)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .lineLimit(2)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct EventLinkingCard: View {
    let events: [ScheduleEvent]
    let selectedEvents: [ScheduleEvent]
    let isLoading: Bool
    let error: String?
    let onRetry: () -> Void
    let onToggle: (ScheduleEvent) -> Void
    let onRemove: (ScheduleEvent) -> Void

    private var visibleEvents: [ScheduleEvent] {
        events
    }

    var body: some View {
        FormCard {
            VStack(alignment: .leading, spacing: 14) {
                HStack(spacing: 10) {
                    Image(systemName: "calendar")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Color.statusText(.purple))
                        .frame(width: 30, height: 30)
                        .background(Color.statusBackground(.purple), in: RoundedRectangle(cornerRadius: 8))
                        .accessibilityHidden(true)

                    VStack(alignment: .leading, spacing: 2) {
                        Text("Link events")
                            .font(.headline)
                        Text("Up to 3 upcoming events")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                    if !selectedEvents.isEmpty {
                        Text("\(selectedEvents.count)/3")
                            .font(.caption.weight(.semibold).monospacedDigit())
                            .foregroundStyle(Color.statusText(.purple))
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(Color.statusBackground(.purple), in: Capsule())
                    }
                }

                if !selectedEvents.isEmpty {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            ForEach(selectedEvents) { event in
                                EventChip(event: event) { onRemove(event) }
                            }
                        }
                        .padding(.vertical, 1)
                    }
                    .accessibilityLabel("Selected linked events")
                }

                if isLoading {
                    HStack(spacing: 10) {
                        ProgressView()
                        Text("Loading upcoming events…")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    .frame(maxWidth: .infinity, minHeight: 52, alignment: .leading)
                } else if let error {
                    HStack(spacing: 12) {
                        Image(systemName: "wifi.exclamationmark")
                            .foregroundStyle(Color.statusText(.orange))
                            .accessibilityHidden(true)
                        VStack(alignment: .leading, spacing: 3) {
                            Text("Couldn't load events")
                                .font(.subheadline.weight(.medium))
                            Text(error)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                                .lineLimit(2)
                        }
                        Spacer()
                        Button("Retry", action: onRetry)
                            .buttonStyle(.bordered)
                            .controlSize(.small)
                    }
                } else if visibleEvents.isEmpty {
                    Text("No upcoming events. You can still create an ad hoc reservation.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                } else {
                    VStack(spacing: 0) {
                        ForEach(Array(visibleEvents.enumerated()), id: \.element.id) { index, event in
                            if index > 0 { Divider().padding(.leading, 42) }
                            EventPickRow(
                                event: event,
                                isSelected: selectedEvents.contains(where: { $0.id == event.id }),
                                isDisabled: selectedEvents.count >= 3 && !selectedEvents.contains(where: { $0.id == event.id })
                            ) {
                                onToggle(event)
                            }
                        }
                    }
                    .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 12))
                }
            }
        }
    }
}

private struct EventPickRow: View {
    let event: ScheduleEvent
    let isSelected: Bool
    let isDisabled: Bool
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 12) {
                Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                    .font(.title3)
                    .foregroundStyle(isSelected ? Color.statusText(.purple) : Color(.systemGray3))
                    .accessibilityHidden(true)

                VStack(alignment: .leading, spacing: 3) {
                    Text(event.shortBookingEventTitle)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.primary)
                        .lineLimit(1)
                    Text(event.bookingEventSubtitle)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
                Spacer()
                if let label = sportLabel(event.sportCode) {
                    Text(label)
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            }
            .frame(minHeight: 52)
            .contentShape(Rectangle())
            .opacity(isDisabled ? 0.45 : 1)
        }
        .buttonStyle(.plain)
        .disabled(isDisabled)
        .accessibilityLabel(accessibilityLabel)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }

    private var accessibilityLabel: String {
        let selected = isSelected ? "Selected" : "Not selected"
        return "\(event.shortBookingEventTitle), \(event.bookingEventSubtitle), \(selected)"
    }
}

private struct EventChip: View {
    let event: ScheduleEvent
    let onRemove: () -> Void

    var body: some View {
        HStack(spacing: 6) {
            Text(event.shortBookingEventTitle)
                .font(.caption.weight(.semibold))
                .lineLimit(1)
            Button(action: onRemove) {
                Image(systemName: "xmark.circle.fill")
                    .font(.caption)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Remove \(event.shortBookingEventTitle)")
        }
        .foregroundStyle(Color.statusText(.purple))
        .padding(.horizontal, 10)
        .padding(.vertical, 7)
        .background(Color.statusBackground(.purple), in: Capsule())
    }
}

private struct ReviewEventRow: View {
    let event: ScheduleEvent

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: event.isHome == false ? "bus" : "sportscourt")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Color.statusText(event.isHome == false ? .orange : .green))
                .frame(width: 30, height: 30)
                .background(Color.statusBackground(event.isHome == false ? .orange : .green), in: RoundedRectangle(cornerRadius: 8))
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                Text(event.shortBookingEventTitle)
                    .font(.subheadline.weight(.medium))
                    .lineLimit(1)
                Text(event.bookingEventSubtitle)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            Spacer()
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
    }
}

private struct SelectedEquipmentRow: View {
    let asset: Asset
    let isConflicted: Bool
    let onRemove: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 3) {
                Text(asset.displayName)
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(.primary)
                    .lineLimit(1)
                HStack(spacing: 6) {
                    if let tag = asset.assetTag {
                        Text(tag)
                            .font(.caption)
                            .fontDesign(.monospaced)
                            .foregroundStyle(.secondary)
                    }
                    Text(asset.location.name)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
                if isConflicted {
                    Label("Scheduling conflict", systemImage: "exclamationmark.triangle.fill")
                        .font(.caption2)
                        .foregroundStyle(Color.statusText(.orange))
                        .accessibilityLabel("Scheduling conflict")
                }
            }
            Spacer()
            Button {
                onRemove()
            } label: {
                Label("Remove", systemImage: "xmark.circle.fill")
                    .labelStyle(.titleAndIcon)
            }
            .buttonStyle(.bordered)
            .controlSize(.small)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(accessibilityLabel)
    }

    private var accessibilityLabel: String {
        var parts: [String] = ["Selected", asset.displayName]
        if let tag = asset.assetTag { parts.append(tag) }
        parts.append(asset.location.name)
        if isConflicted { parts.append("Scheduling conflict") }
        parts.append("Remove button")
        return parts.joined(separator: ", ")
    }
}

private struct SelectedBulkRow: View {
    let sku: FormBulkSku
    let quantity: Int
    let onRemove: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "shippingbox")
                .foregroundStyle(.secondary)
                .frame(width: 32, height: 32)
                .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 8))
                .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: 3) {
                Text(sku.name)
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(.primary)
                    .lineLimit(1)
                Text("\(quantity) selected")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .monospacedDigit()
            }
            Spacer()
            Button {
                onRemove()
            } label: {
                Label("Remove", systemImage: "xmark.circle.fill")
                    .labelStyle(.titleAndIcon)
            }
            .buttonStyle(.bordered)
            .controlSize(.small)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Selected \(sku.name), \(quantity) selected, Remove button")
    }
}

private struct BulkQuantityRow: View {
    let sku: FormBulkSku
    let quantity: Int
    let onDecrement: () -> Void
    let onIncrement: () -> Void

    private var canIncrement: Bool { quantity < sku.availableQuantity }
    private var unitLabel: String {
        sku.unit?.isEmpty == false ? " \(sku.unit!)" : ""
    }
    private var subtitle: String {
        let pickup = sku.trackByNumber ? " · units scan at pickup" : ""
        return "\(sku.availableQuantity) available\(unitLabel)\(pickup)"
    }

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "shippingbox")
                .foregroundStyle(.secondary)
                .frame(width: 44, height: 44)
                .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 10))
                .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: 3) {
                Text(sku.name)
                    .font(.subheadline.weight(.medium))
                    .lineLimit(1)
                Text(subtitle)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }

            Spacer()

            HStack(spacing: 8) {
                Button(action: onDecrement) {
                    Image(systemName: "minus")
                        .font(.system(size: 14, weight: .semibold))
                        .frame(width: 40, height: 40)
                }
                .buttonStyle(.bordered)
                .disabled(quantity == 0)
                .accessibilityLabel("Remove one \(sku.name)")

                Text("\(quantity)")
                    .font(.body.monospacedDigit())
                    .frame(minWidth: 24)
                    .accessibilityLabel("\(quantity) selected")

                Button(action: onIncrement) {
                    Image(systemName: "plus")
                        .font(.system(size: 14, weight: .semibold))
                        .frame(width: 40, height: 40)
                }
                .buttonStyle(.bordered)
                .disabled(!canIncrement)
                .accessibilityLabel("Add one \(sku.name)")
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(sku.name), \(subtitle), \(quantity) selected")
    }
}

struct AssetPickerRow: View {
    let asset: Asset
    let isSelected: Bool
    var isConflicted: Bool = false
    let onTap: () -> Void
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 12) {
                Group {
                    if let urlString = asset.imageUrl, let url = URL(string: urlString) {
                        AsyncImage(url: url) { image in
                            image.resizable().aspectRatio(contentMode: .fill)
                        } placeholder: {
                            assetPlaceholder
                        }
                        .frame(width: 44, height: 44)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                        .overlay(RoundedRectangle(cornerRadius: 8).strokeBorder(Color(.separator), lineWidth: 1))
                    } else {
                        assetPlaceholder
                            .frame(width: 44, height: 44)
                    }
                }

                VStack(alignment: .leading, spacing: 3) {
                    Text(asset.displayName)
                        .font(.subheadline)
                        .fontWeight(.medium)
                        .foregroundStyle(.primary)
                    HStack(spacing: 6) {
                        if let tag = asset.assetTag {
                            Text(tag)
                                .font(.caption)
                                .fontDesign(.monospaced)
                                .foregroundStyle(.secondary)
                        }
                        Text(asset.location.name)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    if isConflicted {
                        Label("Scheduling conflict", systemImage: "exclamationmark.triangle.fill")
                            .font(.caption2)
                            .foregroundStyle(Color.statusText(.orange))
                            .accessibilityLabel("Scheduling conflict")
                    }
                }

                Spacer()

                Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                    .font(.title3)
                    .foregroundStyle(
                        isConflicted ? Color.statusText(.orange)
                            : (isSelected ? Color.statusText(.blue) : Color(.systemGray4))
                    )
                    .animation(reduceMotion ? nil : .easeInOut(duration: 0.15), value: isSelected)
                    .accessibilityHidden(true)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(ScalePressStyle())
        .accessibilityElement(children: .combine)
        .accessibilityLabel(rowAccessibilityLabel)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }

    private var rowAccessibilityLabel: String {
        var parts: [String] = [asset.displayName]
        if let tag = asset.assetTag { parts.append(tag) }
        parts.append(asset.location.name)
        if isConflicted { parts.append("Scheduling conflict") }
        parts.append(isSelected ? "Selected" : "Not selected")
        return parts.joined(separator: ", ")
    }

    private var assetPlaceholder: some View {
        RoundedRectangle(cornerRadius: 8)
            .fill(Color(.systemGray5))
            .overlay(
                Image(systemName: "bag")
                    .foregroundStyle(Color(.systemGray2))
            )
    }
}

// MARK: - Form Card Components

struct FormCard<Content: View>: View {
    @ViewBuilder let content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            content()
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.systemBackground), in: RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .strokeBorder(Color(.separator).opacity(0.6), lineWidth: 0.5)
        )
        .shadow(color: Color.primary.opacity(0.05), radius: 4, x: 0, y: 2)
    }
}

struct FormPickerRow<Leading: View>: View {
    let label: String
    let value: String
    @ViewBuilder var leading: () -> Leading

    var body: some View {
        HStack {
            Text(label)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .frame(width: 40, alignment: .leading)
            leading()
            Text(value)
                .font(.body)
                .foregroundStyle(.primary)
                .lineLimit(1)
            Spacer()
            Image(systemName: "chevron.right")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.tertiary)
        }
        .frame(minHeight: 36)
        .contentShape(Rectangle())
    }
}

extension FormPickerRow where Leading == EmptyView {
    init(label: String, value: String) {
        self.init(label: label, value: value) { EmptyView() }
    }
}

private extension ScheduleEvent {
    var shortBookingEventTitle: String {
        if let label = sportLabel(sportCode), let opponent, !opponent.isEmpty {
            let prefix = isHome == false ? "at" : "vs"
            return "\(label) \(prefix) \(opponent)"
        }
        return summary
    }

    var bookingEventSubtitle: String {
        let when = startsAt.formatted(date: .abbreviated, time: allDay ? .omitted : .shortened)
        let venue = location?.name
        let venuePrefix: String?
        if isHome == false {
            venuePrefix = "Away"
        } else if isHome == true {
            venuePrefix = "Home"
        } else {
            venuePrefix = nil
        }
        return [when, venuePrefix, venue].compactMap { $0 }.joined(separator: " · ")
    }
}

// MARK: - Option Picker

struct OptionPickerView: View {
    let title: String
    let options: [(id: String, name: String)]
    @Binding var selection: String
    @Environment(\.dismiss) private var dismiss
    @State private var search = ""

    private var filtered: [(id: String, name: String)] {
        guard !search.isEmpty else { return options }
        return options.filter { $0.name.localizedCaseInsensitiveContains(search) }
    }

    var body: some View {
        List {
            ForEach(filtered, id: \.id) { option in
                Button {
                    selection = option.id
                    Haptics.selection()
                    dismiss()
                } label: {
                    HStack {
                        Text(option.name)
                            .foregroundStyle(.primary)
                        Spacer()
                        if selection == option.id {
                            Image(systemName: "checkmark")
                                .fontWeight(.semibold)
                                .foregroundStyle(Color.statusText(.blue))
                        }
                    }
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(selection == option.id ? .isSelected : [])
            }
            if filtered.isEmpty && !search.isEmpty {
                ContentUnavailableView.search(text: search)
                    .listRowBackground(Color.clear)
            }
        }
        .searchable(text: $search, prompt: "Search \(title.lowercased())")
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.inline)
    }
}

// MARK: - Requester Picker

/// Requester-specific picker: avatars, the signed-in user pinned to the top
/// with a "You" subtitle, search, and a checkmark on the current selection.
struct RequesterPickerView: View {
    let users: [FormUser]
    let currentUserId: String?
    @Binding var selection: String
    @Environment(\.dismiss) private var dismiss
    @State private var search = ""

    /// Signed-in user first, everyone else in server (alphabetical) order.
    private var ordered: [FormUser] {
        guard let me = currentUserId,
              let index = users.firstIndex(where: { $0.id == me }) else { return users }
        var copy = users
        let mine = copy.remove(at: index)
        copy.insert(mine, at: 0)
        return copy
    }

    private var filtered: [FormUser] {
        guard !search.isEmpty else { return ordered }
        return ordered.filter { $0.name.localizedCaseInsensitiveContains(search) }
    }

    var body: some View {
        List {
            ForEach(filtered) { user in
                Button {
                    selection = user.id
                    Haptics.selection()
                    dismiss()
                } label: {
                    HStack(spacing: 12) {
                        UserAvatarView(name: user.name, avatarUrl: user.avatarUrl, size: 36)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(user.name)
                                .foregroundStyle(.primary)
                            if user.id == currentUserId {
                                Text("You")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                        Spacer()
                        if selection == user.id {
                            Image(systemName: "checkmark")
                                .fontWeight(.semibold)
                                .foregroundStyle(Color.statusText(.blue))
                        }
                    }
                }
                .buttonStyle(.plain)
                .accessibilityElement(children: .combine)
                .accessibilityAddTraits(selection == user.id ? .isSelected : [])
            }
            if filtered.isEmpty && !search.isEmpty {
                ContentUnavailableView.search(text: search)
                    .listRowBackground(Color.clear)
            }
        }
        .searchable(text: $search, prompt: "Search requester")
        .navigationTitle("Requester")
        .navigationBarTitleDisplayMode(.inline)
    }
}
