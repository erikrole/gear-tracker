import SwiftUI

/// STAFF/ADMIN: add a new shift slot to an event's shift group.
/// Defaults to the event's start/end and a student worker (covers the
/// common case of "we need another camera/photo on this game").
struct AddShiftSheet: View {
    let shiftGroupId: String
    let defaultStart: Date
    let defaultEnd: Date
    let onAdded: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var area: ShiftAreaOption = .video
    @State private var workerType: ShiftWorkerOption = .student
    @State private var customizeTimes = false
    @State private var startsAt: Date
    @State private var endsAt: Date
    @State private var isSubmitting = false
    @State private var error: String?

    init(shiftGroupId: String, defaultStart: Date, defaultEnd: Date, onAdded: @escaping () -> Void) {
        self.shiftGroupId = shiftGroupId
        self.defaultStart = defaultStart
        self.defaultEnd = defaultEnd
        self.onAdded = onAdded
        _startsAt = State(initialValue: defaultStart)
        _endsAt = State(initialValue: defaultEnd)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Area") {
                    Picker("Area", selection: $area) {
                        ForEach(ShiftAreaOption.allCases, id: \.self) { Text($0.label).tag($0) }
                    }
                    .pickerStyle(.segmented)
                }
                Section("Worker") {
                    Picker("Worker type", selection: $workerType) {
                        ForEach(ShiftWorkerOption.allCases, id: \.self) { Text($0.label).tag($0) }
                    }
                    .pickerStyle(.segmented)
                }
                Section {
                    Toggle("Custom call & end time", isOn: $customizeTimes)
                    if customizeTimes {
                        DatePicker("Call time", selection: $startsAt, displayedComponents: [.date, .hourAndMinute])
                        DatePicker("End time", selection: $endsAt, in: startsAt..., displayedComponents: [.date, .hourAndMinute])
                    } else {
                        LabeledContent("Call") { Text(defaultStart.gearTime).foregroundStyle(.secondary) }
                        LabeledContent("End") { Text(defaultEnd.gearTime).foregroundStyle(.secondary) }
                    }
                } footer: {
                    Text(customizeTimes
                        ? "Override the event's default start/end for this slot only."
                        : "Defaults to the event's call and end times.")
                }
                if let error {
                    Section {
                        Text(error).font(.footnote).foregroundStyle(.red)
                    }
                }
            }
            .navigationTitle("Add Shift")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .disabled(isSubmitting)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Add") { Task { await submit() } }
                        .fontWeight(.semibold)
                        .disabled(isSubmitting)
                }
            }
            .interactiveDismissDisabled(isSubmitting)
        }
    }

    private func submit() async {
        isSubmitting = true
        error = nil
        defer { isSubmitting = false }
        do {
            try await APIClient.shared.addShift(
                shiftGroupId: shiftGroupId,
                area: area.rawValue,
                workerType: workerType.rawValue,
                startsAt: customizeTimes ? startsAt : nil,
                endsAt: customizeTimes ? endsAt : nil
            )
            Haptics.success()
            onAdded()
            dismiss()
        } catch {
            self.error = error.localizedDescription
            Haptics.error()
        }
    }
}

enum ShiftAreaOption: String, CaseIterable {
    case video = "VIDEO"
    case photo = "PHOTO"
    case graphics = "GRAPHICS"
    case comms = "COMMS"

    var label: String {
        switch self {
        case .video:    "Video"
        case .photo:    "Photo"
        case .graphics: "Graphics"
        case .comms:    "Comms"
        }
    }
}

enum ShiftWorkerOption: String, CaseIterable {
    case student = "ST"
    case fullTime = "FT"

    var label: String {
        switch self {
        case .student:  "Student"
        case .fullTime: "Staff"
        }
    }
}
