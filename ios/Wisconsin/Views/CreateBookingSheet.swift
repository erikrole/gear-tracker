import SwiftUI

@MainActor
@Observable
final class CreateBookingViewModel {
    var title = ""
    var selectedUserId: String = ""
    var selectedLocationId: String = ""
    var startsAt = Date().addingTimeInterval(3600)
    var endsAt = Date().addingTimeInterval(7200)
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
    @Environment(SessionStore.self) private var session

    init(onCreated: @escaping (String) -> Void) {
        _vm = State(wrappedValue: CreateBookingViewModel())
        self.onCreated = onCreated
    }

    init(vm: CreateBookingViewModel, onCreated: @escaping (String) -> Void) {
        _vm = State(wrappedValue: vm)
        self.onCreated = onCreated
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
                Button("Cancel") { dismiss() }
            } else {
                Button("Back") { step = 1 }
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
        Form {
            Section("Details") {
                TextField("Title", text: $vm.title)

                if vm.isLoadingOptions {
                    ProgressView("Loading…")
                } else {
                    Picker("Requester", selection: $vm.selectedUserId) {
                        Text("Select requester").tag("")
                        ForEach(vm.options?.users ?? []) { user in
                            Text(user.name).tag(user.id)
                        }
                    }
                    .pickerStyle(.navigationLink)

                    Picker("Location", selection: $vm.selectedLocationId) {
                        Text("Select location").tag("")
                        ForEach(vm.options?.locations ?? []) { loc in
                            Text(loc.name).tag(loc.id)
                        }
                    }
                    .pickerStyle(.navigationLink)
                }
            }

            Section("Dates") {
                DatePicker("Starts", selection: $vm.startsAt, displayedComponents: [.date, .hourAndMinute])
                DatePicker("Ends", selection: $vm.endsAt, in: vm.startsAt..., displayedComponents: [.date, .hourAndMinute])
            }

            Section("Notes") {
                TextField("Optional notes…", text: $vm.notes, axis: .vertical)
                    .lineLimit(3...6)
            }

            if let error = vm.error {
                Section {
                    Text(error).foregroundStyle(.red).font(.footnote)
                }
            }
        }
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

            if let error = vm.error {
                Section {
                    Text(error).foregroundStyle(.red).font(.footnote)
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
            vm.error = error.localizedDescription
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
        .buttonStyle(.plain)
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
