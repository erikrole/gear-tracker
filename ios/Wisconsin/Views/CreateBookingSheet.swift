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
    var isLoadingAssets = false
    var assetSearch = ""
    var assetTotal = 0
    var assetOffset = 0
    var hasMoreAssets: Bool { availableAssets.count < assetTotal }
    private var searchTask: Task<Void, Never>?

    var selectedUser: FormUser? { options?.users.first(where: { $0.id == selectedUserId }) }
    var selectedLocation: FormOption? { options?.locations.first(where: { $0.id == selectedLocationId }) }

    var isValid: Bool {
        !title.trimmingCharacters(in: .whitespaces).isEmpty
            && !selectedUserId.isEmpty
            && !selectedLocationId.isEmpty
            && endsAt > startsAt
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
        guard !isLoadingAssets else { return }
        if reset {
            availableAssets = []
            assetOffset = 0
            assetTotal = 0
        }
        isLoadingAssets = true
        do {
            let resp = try await APIClient.shared.assets(
                search: assetSearch.isEmpty ? nil : assetSearch,
                status: .available,
                limit: 30,
                offset: assetOffset
            )
            availableAssets += resp.data
            assetTotal = resp.total
            assetOffset += resp.data.count
        } catch {
            self.error = error.localizedDescription
        }
        isLoadingAssets = false
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
        !vm.title.trimmingCharacters(in: .whitespaces).isEmpty
            || !vm.notes.isEmpty
            || !vm.selectedAssetIds.isEmpty
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
            .navigationTitle(step == 1 ? "New Reservation" : "Add Equipment")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { toolbar }
            .alert("Unable to Create Reservation", isPresented: Binding(
                get: { submitError != nil },
                set: { if !$0 { submitError = nil } }
            )) {
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
            }
        }
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
                }
                .disabled(!vm.isValid || vm.isSubmitting)
                .fontWeight(.semibold)
            } else {
                Button("Create") {
                    Task { await create() }
                }
                .disabled(vm.isSubmitting)
                .fontWeight(.semibold)
                .overlay {
                    if vm.isSubmitting { ProgressView().scaleEffect(0.8) }
                }
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
                                OptionPickerView(
                                    title: "Requester",
                                    options: vm.options?.users.map { ($0.id, $0.name) } ?? [],
                                    selection: $vm.selectedUserId
                                )
                            } label: {
                                FormPickerRow(
                                    label: "For",
                                    value: vm.selectedUser?.name ?? "Select person"
                                )
                            }
                            .buttonStyle(.plain)
                        } else {
                            // Student: locked to self.
                            FormPickerRow(
                                label: "For",
                                value: session.currentUser?.name ?? "You"
                            )
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
                    DatePicker("From", selection: $vm.startsAt, displayedComponents: [.date, .hourAndMinute])
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
                        .foregroundStyle(.red)
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
                        .foregroundStyle(.blue)
                }
            }

            Section {
                if vm.availableAssets.isEmpty && !vm.isLoadingAssets {
                    Text("No available equipment found.")
                        .foregroundStyle(.secondary)
                        .font(.subheadline)
                } else {
                    ForEach(vm.availableAssets) { asset in
                        AssetPickerRow(asset: asset, isSelected: vm.selectedAssetIds.contains(asset.id)) {
                            if vm.selectedAssetIds.contains(asset.id) {
                                vm.selectedAssetIds.remove(asset.id)
                            } else {
                                vm.selectedAssetIds.insert(asset.id)
                            }
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
    }

    private func create() async {
        do {
            let id = try await vm.submit()
            onCreated(id)
            dismiss()
        } catch {
            submitError = error.localizedDescription
        }
    }
}

struct AssetPickerRow: View {
    let asset: Asset
    let isSelected: Bool
    let onTap: () -> Void

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
                }

                Spacer()

                Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                    .font(.title3)
                    .foregroundStyle(isSelected ? .blue : Color(.systemGray4))
                    .animation(.easeInOut(duration: 0.15), value: isSelected)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(ScalePressStyle())
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

struct FormPickerRow: View {
    let label: String
    let value: String

    var body: some View {
        HStack {
            Text(label)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .frame(width: 40, alignment: .leading)
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
                    dismiss()
                } label: {
                    HStack {
                        Text(option.name)
                            .foregroundStyle(.primary)
                        Spacer()
                        if selection == option.id {
                            Image(systemName: "checkmark")
                                .fontWeight(.semibold)
                                .foregroundStyle(.blue)
                        }
                    }
                }
                .buttonStyle(.plain)
            }
        }
        .searchable(text: $search, prompt: "Search \(title.lowercased())")
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.inline)
    }
}
