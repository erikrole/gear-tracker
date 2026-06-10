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
    var availableAssets: [Asset] = []
    var selectedAssetSnapshots: [String: Asset] = [:]
    var isLoadingAssets = false
    var assetSearch = ""
    var assetTotal = 0
    var assetOffset = 0
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
            serializedAssetIds: Array(selectedAssetIds)
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
                } else {
                    equipmentPicker
                }
            }
            .navigationTitle(step == 1 ? "New Reservation" : "Choose Equipment")
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
                Button("Back") { step = 1 }
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
            } else {
                Button {
                    Task { await create() }
                } label: {
                    if vm.isSubmitting {
                        ProgressView().controlSize(.small)
                    } else {
                        Text("Create Reservation").fontWeight(.semibold)
                    }
                }
                .disabled(vm.isSubmitting)
            }
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

            if !vm.selectedAssetIds.isEmpty {
                Section {
                    let count = vm.selectedAssetIds.count
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
                } header: {
                    Text("Selected Equipment")
                } footer: {
                    Text("Remove anything you do not want before creating the reservation.")
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
