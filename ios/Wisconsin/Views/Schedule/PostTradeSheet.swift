import SwiftUI

struct PostTradeSheet: View {
    let myShifts: [MyShift]
    let onPosted: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var selectedShift: MyShift?
    @State private var notes = ""
    @State private var isPosting = false
    @State private var error: String?

    private var eligibleShifts: [MyShift] {
        let now = Date()
        return myShifts.filter { $0.startsAt > now && $0.status == "ACTIVE" }
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
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Post") {
                        Task { await post() }
                    }
                    .disabled(selectedShift == nil || isPosting)
                }
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
            onPosted()
            dismiss()
        } catch {
            self.error = error.localizedDescription
        }
    }
}
