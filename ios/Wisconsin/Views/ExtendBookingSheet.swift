import SwiftUI

struct ExtendBookingSheet: View {
    let bookingId: String
    let currentEndsAt: Date
    let onSuccess: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var newEndsAt: Date
    @State private var isLoading = false
    @State private var error: String?

    init(bookingId: String, currentEndsAt: Date, onSuccess: @escaping () -> Void) {
        self.bookingId = bookingId
        self.currentEndsAt = currentEndsAt
        self.onSuccess = onSuccess
        _newEndsAt = State(initialValue: currentEndsAt)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    LabeledContent("Current End") {
                        Text(currentEndsAt.formatted(date: .abbreviated, time: .shortened))
                            .foregroundStyle(.secondary)
                    }
                }

                Section("New End Date & Time") {
                    DatePicker(
                        "Ends At",
                        selection: $newEndsAt,
                        in: currentEndsAt...,
                        displayedComponents: [.date, .hourAndMinute]
                    )
                    .datePickerStyle(.graphical)
                }

                if let error {
                    Section {
                        Text(error)
                            .foregroundStyle(.red)
                            .font(.footnote)
                    }
                }
            }
            .navigationTitle("Extend Booking")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Extend") {
                        Task { await extend() }
                    }
                    .disabled(newEndsAt <= currentEndsAt || isLoading)
                    .fontWeight(.semibold)
                }
            }
            .overlay {
                if isLoading {
                    Color.black.opacity(0.1).ignoresSafeArea()
                    ProgressView()
                }
            }
        }
    }

    private func extend() async {
        isLoading = true
        error = nil
        do {
            try await APIClient.shared.extendBooking(id: bookingId, endsAt: newEndsAt)
            onSuccess()
            dismiss()
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }
}
