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
            shiftAssignmentId: prefillShiftAssignmentId
        )
    }
}

struct CreateBookingSheet: View {
    let onCreated: (String) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var vm: CreateBookingViewModel
    @Environment(SessionStore.self) private var session

    /// Standard init — creates a fresh view model.
    init(onCreated: @escaping (String) -> Void) {
        _vm = State(wrappedValue: CreateBookingViewModel())
        self.onCreated = onCreated
    }

    /// Pre-fill init — accepts an externally configured view model (e.g. from EventDetailSheet).
    init(vm: CreateBookingViewModel, onCreated: @escaping (String) -> Void) {
        _vm = State(wrappedValue: vm)
        self.onCreated = onCreated
    }

    var body: some View {
        NavigationStack {
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
            .navigationTitle("New Reservation")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Create") {
                        Task { await create() }
                    }
                    .disabled(!vm.isValid || vm.isSubmitting)
                    .fontWeight(.semibold)
                }
            }
            .task { await vm.loadOptions() }
            .onChange(of: vm.options) {
                // Pre-select current user once options load
                if vm.selectedUserId.isEmpty, let current = session.currentUser {
                    if vm.options?.users.contains(where: { $0.id == current.id }) == true {
                        vm.selectedUserId = current.id
                    }
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
