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

    /// Web parity: +1 day / +3 days / +1 week chips on `BookingDetailPage`.
    private static let quickPresets: [(label: String, days: Int)] = [
        ("+1 day", 1),
        ("+3 days", 3),
        ("+1 week", 7),
    ]

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    LabeledContent("Current End") {
                        Text(currentEndsAt.formatted(date: .abbreviated, time: .shortened))
                            .font(.callout.monospacedDigit())
                            .foregroundStyle(.secondary)
                    }
                }

                Section("Quick Extend") {
                    HStack(spacing: 8) {
                        ForEach(Self.quickPresets, id: \.days) { preset in
                            Button {
                                applyPreset(days: preset.days)
                            } label: {
                                Text(preset.label)
                                    .font(.footnote.weight(.medium))
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, 8)
                            }
                            .buttonStyle(.bordered)
                            .controlSize(.regular)
                            .disabled(isLoading)
                        }
                    }
                    .listRowInsets(EdgeInsets(top: 6, leading: 16, bottom: 6, trailing: 16))
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
                            .foregroundStyle(Color.statusText(.red))
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

    /// Offset from the current picker value if the user has already nudged it,
    /// otherwise from the booking's current end. Mirrors web's `handleQuickExtend`.
    private func applyPreset(days: Int) {
        let base = newEndsAt > currentEndsAt ? newEndsAt : currentEndsAt
        if let next = Calendar.current.date(byAdding: .day, value: days, to: base) {
            newEndsAt = next
            Haptics.tap()
        }
    }

    private func extend() async {
        isLoading = true
        error = nil
        do {
            try await APIClient.shared.extendBooking(id: bookingId, endsAt: newEndsAt)
            onSuccess()
            Haptics.success()
            dismiss()
        } catch {
            self.error = error.localizedDescription
            Haptics.warning()
        }
        isLoading = false
    }
}
