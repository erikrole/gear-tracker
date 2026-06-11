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

    var prefillEventId: String?
    var prefillShiftAssignmentId: String?

    var options: FormOptions?
    var isLoadingOptions = false
    var isSubmitting = false
    var error: String?

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
        let duration = endsAt.timeIntervalSince(startsAt)
        startsAt = newStart
        endsAt = newStart.addingTimeInterval(max(duration, 0))
    }

    func prefill(title: String, startsAt: Date, endsAt: Date, userId: String, eventId: String?, shiftAssignmentId: String?) {
        self.title = title
        self.startsAt = startsAt
        self.endsAt = endsAt
        self.selectedUserId = userId
        self.prefillEventId = eventId
        self.prefillShiftAssignmentId = shiftAssignmentId
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
            eventId: prefillEventId,
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
            .task { await vm.loadOptions() }
            .fullScreenCover(isPresented: $showScanner) {
                QRScannerSheet { assetId in
                    showScanner = false
                    Task { await vm.addScannedAsset(id: assetId) }
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
            VStack(spacing: 12) {
                // Title
                FormCard {
                    TextField("Booking title", text: $vm.title)
                        .font(.body)
                }

                // Who & Where
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
                                selection: $vm.selectedLocationId
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

                // Dates
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
                    DatePicker("To", selection: $vm.endsAt, in: vm.startsAt..., displayedComponents: [.date, .hourAndMinute])
                        .tint(.accentColor)
                }

                // Notes
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

    @ViewBuilder
    private var equipmentPicker: some View {
        List {
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
                    Image(systemName: "calendar")
                        .font(.title2)
                        .foregroundStyle(Color.statusText(.purple))
                        .frame(width: 48, height: 48)
                        .background(Color.statusBackground(.purple), in: RoundedRectangle(cornerRadius: 12))

                    Text("Review your reservation")
                        .font(.title3.weight(.semibold))
                        .padding(.top, 16)

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
