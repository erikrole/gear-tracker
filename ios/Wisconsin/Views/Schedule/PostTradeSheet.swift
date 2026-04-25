import SwiftUI

struct PostTradeSheet: View {
    let myShifts: [MyShift]
    let onPosted: (MyShift) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var selectedShift: MyShift?
    @State private var notes = ""
    @State private var isPosting = false
    @State private var error: String?
    @State private var showDiscardConfirm = false

    private var eligibleShifts: [MyShift] {
        let now = Date()
        return myShifts.filter { $0.startsAt > now && $0.statusValue == .active }
    }

    private var hasUnsavedInput: Bool {
        selectedShift != nil || !notes.trimmingCharacters(in: .whitespaces).isEmpty
    }

    private func attemptCancel() {
        if isPosting { return }
        if hasUnsavedInput {
            showDiscardConfirm = true
        } else {
            dismiss()
        }
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Select a Shift to Post") {
                    if eligibleShifts.isEmpty {
                        Text("No upcoming active shifts available to post.")
                            .foregroundStyle(.secondary)
                            .font(.subheadline)
                    } else {
                        ForEach(eligibleShifts) { shift in
                            ShiftPickerRow(shift: shift, isSelected: selectedShift?.id == shift.id)
                                .contentShape(Rectangle())
                                .onTapGesture { selectedShift = shift }
                        }
                    }
                }

                if selectedShift != nil {
                    Section("Notes (Optional)") {
                        TextField("e.g. Have a conflict that day", text: $notes, axis: .vertical)
                            .lineLimit(3)
                    }
                }

                if let error {
                    Section {
                        Text(error)
                            .foregroundStyle(.red)
                            .font(.caption)
                    }
                }
            }
            .navigationTitle("Post for Trade")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { attemptCancel() }
                        .disabled(isPosting)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Post") {
                        Task { await post() }
                    }
                    .disabled(selectedShift == nil || isPosting)
                    .fontWeight(.semibold)
                }
            }
            .interactiveDismissDisabled(hasUnsavedInput || isPosting)
            .confirmationDialog(
                "Discard post?",
                isPresented: $showDiscardConfirm,
                titleVisibility: .visible
            ) {
                Button("Discard", role: .destructive) { dismiss() }
                Button("Keep Editing", role: .cancel) {}
            } message: {
                Text("Your selection will be lost.")
            }
        }
    }

}

private struct ShiftPickerRow: View {
    let shift: MyShift
    let isSelected: Bool

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 3) {
                Text(shift.area)
                    .font(.subheadline.weight(.medium))
                Text(shift.event.summary)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                let timeRange = "\(shift.startsAt.formatted(date: .abbreviated, time: .shortened)) – \(shift.endsAt.formatted(date: .omitted, time: .shortened))"
                Text(timeRange)
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }
            Spacer()
            if isSelected {
                Image(systemName: "checkmark.circle.fill")
                    .foregroundStyle(Color.accentColor)
            }
        }
    }
}

extension PostTradeSheet {
    private func post() async {
        guard let shift = selectedShift else { return }
        isPosting = true
        error = nil
        defer { isPosting = false }
        do {
            _ = try await APIClient.shared.postShiftTrade(
                assignmentId: shift.id,
                notes: notes.isEmpty ? nil : notes
            )
            UINotificationFeedbackGenerator().notificationOccurred(.success)
            onPosted(shift)
            dismiss()
        } catch {
            self.error = error.localizedDescription
        }
    }
}
