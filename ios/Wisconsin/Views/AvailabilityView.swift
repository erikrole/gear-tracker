import SwiftUI

private let availabilityDayNames = [
    "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
]

/// Student self-service editor for recurring class-conflict blocks. Mirrors the
/// web profile Availability tab; these blocks drive the assign-picker conflict
/// warnings (see `AssignStudentSheet`).
struct AvailabilityView: View {
    let userId: String

    @State private var blocks: [AvailabilityBlock] = []
    @State private var isLoading = true
    @State private var error: String?
    @State private var showAdd = false

    private var grouped: [(day: Int, blocks: [AvailabilityBlock])] {
        // AD_HOC blocks (web-only, dayOfWeek == nil) don't fit the weekly
        // grid this editor renders; skip them rather than failing the list.
        let weekly = blocks.filter { $0.dayOfWeek != nil }
        return Dictionary(grouping: weekly, by: { $0.dayOfWeek ?? 0 })
            .sorted { $0.key < $1.key }
            .map { (day: $0.key, blocks: $0.value.sorted { $0.startsAt < $1.startsAt }) }
    }

    var body: some View {
        Group {
            if isLoading && blocks.isEmpty {
                ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let error, blocks.isEmpty {
                ContentUnavailableView {
                    Label("Couldn't load availability", systemImage: "exclamationmark.triangle")
                } description: {
                    Text(error)
                } actions: {
                    Button("Retry") { Task { await load() } }
                        .buttonStyle(.borderedProminent)
                }
            } else if blocks.isEmpty {
                ContentUnavailableView {
                    Label("No class conflicts added", systemImage: "calendar.badge.clock")
                } description: {
                    Text("Add the times you have class so staff don't schedule you then.")
                } actions: {
                    Button { showAdd = true } label: {
                        Label("Add a block", systemImage: "plus")
                    }
                    .buttonStyle(.borderedProminent)
                }
            } else {
                List {
                    Section {
                        Button { showAdd = true } label: {
                            Label("Add availability block", systemImage: "plus")
                        }
                    }
                    ForEach(grouped, id: \.day) { group in
                        Section(availabilityDayNames[group.day]) {
                            ForEach(group.blocks) { block in
                                HStack {
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text("\(block.startsAt)–\(block.endsAt)")
                                            .font(.body.monospacedDigit())
                                        if let label = block.label, !label.isEmpty {
                                            Text(label)
                                                .font(.caption)
                                                .foregroundStyle(.secondary)
                                        }
                                    }
                                    Spacer()
                                }
                                .swipeActions(edge: .trailing) {
                                    Button(role: .destructive) {
                                        Task { await delete(block) }
                                    } label: {
                                        Label("Delete", systemImage: "trash")
                                    }
                                }
                                .accessibilityElement(children: .combine)
                                .accessibilityLabel(rowLabel(day: group.day, block: block))
                            }
                        }
                    }
                }
            }
        }
        .navigationTitle("My Availability")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button { showAdd = true } label: {
                    Label("Add block", systemImage: "plus")
                }
                .labelStyle(.titleAndIcon)
            }
        }
        .task { await load() }
        .sheet(isPresented: $showAdd) {
            AddAvailabilitySheet(userId: userId) { Task { await load() } }
        }
    }

    private func rowLabel(day: Int, block: AvailabilityBlock) -> String {
        var parts = ["\(availabilityDayNames[day]) \(block.startsAt) to \(block.endsAt)"]
        if let label = block.label, !label.isEmpty { parts.append(label) }
        return parts.joined(separator: ", ")
    }

    private func load() async {
        isLoading = true
        error = nil
        do {
            blocks = try await APIClient.shared.availabilityBlocks(userId: userId)
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }

    private func delete(_ block: AvailabilityBlock) async {
        do {
            try await APIClient.shared.deleteAvailabilityBlock(userId: userId, blockId: block.id)
            blocks.removeAll { $0.id == block.id }
            Haptics.success()
        } catch {
            self.error = error.localizedDescription
            Haptics.warning()
        }
    }
}

private struct AddAvailabilitySheet: View {
    let userId: String
    let onAdded: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var dayOfWeek = 1
    @State private var start: Date
    @State private var end: Date
    @State private var label = ""
    @State private var isSaving = false
    @State private var error: String?

    init(userId: String, onAdded: @escaping () -> Void) {
        self.userId = userId
        self.onAdded = onAdded
        let cal = Calendar.current
        _start = State(initialValue: cal.date(bySettingHour: 9, minute: 0, second: 0, of: .now) ?? .now)
        _end = State(initialValue: cal.date(bySettingHour: 10, minute: 0, second: 0, of: .now) ?? .now)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Day") {
                    Picker("Day", selection: $dayOfWeek) {
                        ForEach(0..<7, id: \.self) { Text(availabilityDayNames[$0]).tag($0) }
                    }
                }
                Section("Time") {
                    DatePicker("Starts", selection: $start, displayedComponents: .hourAndMinute)
                    DatePicker("Ends", selection: $end, displayedComponents: .hourAndMinute)
                }
                Section {
                    TextField("Label (optional) — e.g. CHEM 101", text: $label)
                } footer: {
                    Text("Recurs every week. Staff see a conflict warning if a shift overlaps this.")
                }
                if let error {
                    Section {
                        Text(error).font(.footnote).foregroundStyle(Color.statusText(.red))
                    }
                }
            }
            .navigationTitle("Add Availability")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .disabled(isSaving)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button {
                        Task { await save() }
                    } label: {
                        if isSaving {
                            ProgressView().controlSize(.small)
                        } else {
                            Text("Add").fontWeight(.semibold)
                        }
                    }
                    .disabled(isSaving)
                }
            }
            .interactiveDismissDisabled(isSaving)
        }
    }

    private func save() async {
        let startStr = Self.hhmm(start)
        let endStr = Self.hhmm(end)
        guard startStr < endStr else {
            error = "Start time must be before end time"
            Haptics.warning()
            return
        }
        isSaving = true
        error = nil
        let trimmed = label.trimmingCharacters(in: .whitespaces)
        do {
            _ = try await APIClient.shared.createAvailabilityBlock(
                userId: userId,
                dayOfWeek: dayOfWeek,
                startsAt: startStr,
                endsAt: endStr,
                label: trimmed.isEmpty ? nil : trimmed
            )
            Haptics.success()
            onAdded()
            dismiss()
        } catch {
            self.error = error.localizedDescription
            Haptics.warning()
        }
        isSaving = false
    }

    private static func hhmm(_ date: Date) -> String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "HH:mm"
        return f.string(from: date)
    }
}
