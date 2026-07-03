import SwiftUI

// MARK: - Availability editor

private let availabilityDayNames = [
    "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
]

/// Student scheduling-class self-service editor for the same availability,
/// preference, dislike, and time-off signals used by web scheduling surfaces.
struct AvailabilityView: View {
    let userId: String

    @State private var blocks: [AvailabilityBlock] = []
    @State private var isLoading = true
    @State private var error: String?
    @State private var showAdd = false
    @State private var blockPendingDelete: AvailabilityBlock?

    private var weeklyGroups: [(day: Int, blocks: [AvailabilityBlock])] {
        Dictionary(grouping: blocks.filter(\.isWeekly), by: { $0.dayOfWeek ?? 0 })
            .sorted { $0.key < $1.key }
            .map { (day: $0.key, blocks: $0.value.sorted(by: sortBlocks)) }
    }

    private var datedBlocks: [AvailabilityBlock] {
        blocks.filter(\.isDated).sorted(by: sortBlocks)
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
                    Label("No availability added", systemImage: "calendar.badge.clock")
                } description: {
                    Text("Add class conflicts, preferred work times, or time off so staff can schedule with better context.")
                } actions: {
                    Button { showAdd = true } label: {
                        Label("Add availability block", systemImage: "plus")
                    }
                    .buttonStyle(.borderedProminent)
                }
            } else {
                List {
                    if let error {
                        Section {
                            Text(error)
                                .font(.footnote)
                                .foregroundStyle(Color.statusText(.red))
                        }
                    }

                    Section {
                        Button { showAdd = true } label: {
                            Label("Add availability block", systemImage: "plus")
                        }
                    } footer: {
                        Text("Approved time off blocks pickup and trade actions. Other availability stays visible as scheduling guidance.")
                    }

                    Section("Impact") {
                        AvailabilitySummaryRow(
                            title: "Blocking time off",
                            value: blocks.filter(\.isApprovedTimeOff).count,
                            systemImage: "hand.raised.fill",
                            tone: .red
                        )
                        AvailabilitySummaryRow(
                            title: "Advisory signals",
                            value: blocks.filter(\.isAdvisory).count,
                            systemImage: "exclamationmark.triangle.fill",
                            tone: .orange
                        )
                        AvailabilitySummaryRow(
                            title: "Preferred windows",
                            value: blocks.filter(\.isPreference).count,
                            systemImage: "checkmark.circle.fill",
                            tone: .green
                        )
                    }

                    ForEach(weeklyGroups, id: \.day) { group in
                        Section(availabilityDayNames[group.day]) {
                            availabilityRows(group.blocks)
                        }
                    }

                    if !datedBlocks.isEmpty {
                        Section("One-time requests and exceptions") {
                            availabilityRows(datedBlocks)
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
        .confirmationDialog(
            "Delete availability block?",
            isPresented: deleteConfirmationBinding,
            titleVisibility: .visible,
            presenting: blockPendingDelete
        ) { block in
            Button("Delete \(block.primaryLine)", role: .destructive) {
                Task { await delete(block) }
            }
            Button("Cancel", role: .cancel) {
                blockPendingDelete = nil
            }
        } message: { block in
            Text("Staff will no longer see \(block.primaryLine) when reviewing your scheduling availability.")
        }
    }

    @ViewBuilder
    private func availabilityRows(_ rows: [AvailabilityBlock]) -> some View {
        ForEach(rows) { block in
            AvailabilityBlockRow(block: block)
                .swipeActions(edge: .trailing) {
                    Button(role: .destructive) {
                        blockPendingDelete = block
                    } label: {
                        Label("Delete", systemImage: "trash")
                    }
                }
                .accessibilityElement(children: .combine)
                .accessibilityLabel(block.accessibilityLabel)
        }
    }

    private func sortBlocks(_ lhs: AvailabilityBlock, _ rhs: AvailabilityBlock) -> Bool {
        let lhsDate = lhs.dateValue ?? ""
        let rhsDate = rhs.dateValue ?? ""
        if lhsDate != rhsDate { return lhsDate < rhsDate }
        if lhs.startsAt != rhs.startsAt { return lhs.startsAt < rhs.startsAt }
        return lhs.endsAt < rhs.endsAt
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
            blockPendingDelete = nil
            Haptics.success()
        } catch {
            self.error = error.localizedDescription
            blockPendingDelete = nil
            Haptics.warning()
        }
    }

    private var deleteConfirmationBinding: Binding<Bool> {
        Binding(
            get: { blockPendingDelete != nil },
            set: { isPresented in
                if !isPresented { blockPendingDelete = nil }
            }
        )
    }
}

private struct AvailabilitySummaryRow: View {
    let title: String
    let value: Int
    let systemImage: String
    let tone: StatusTone

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: systemImage)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Color.statusText(tone))
                .frame(width: 24)
                .accessibilityHidden(true)
            Text(title)
            Spacer()
            Text("\(value)")
                .font(.subheadline.weight(.semibold).monospacedDigit())
                .foregroundStyle(Color.statusText(tone))
        }
    }
}

private struct AvailabilityBlockRow: View {
    let block: AvailabilityBlock

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: block.intentMetadata.systemImage)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Color.statusText(block.intentMetadata.tone))
                .frame(width: 24)
                .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: 4) {
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    Text(block.primaryLine)
                        .font(.body.weight(.medium))
                    Spacer(minLength: 8)
                    Text(block.intentMetadata.label)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(Color.statusText(block.intentMetadata.tone))
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(Color.statusBackground(block.intentMetadata.tone), in: Capsule())
                }

                Text(block.secondaryLine)
                    .font(.caption)
                    .foregroundStyle(.secondary)

                if let statusLine = block.statusLine {
                    Text(statusLine)
                        .font(.caption)
                        .foregroundStyle(Color.statusText(block.statusTone))
                }
            }
        }
        .padding(.vertical, 3)
    }
}

private struct AddAvailabilitySheet: View {
    let userId: String
    let onAdded: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var kind: AvailabilityEditorKind = .weekly
    @State private var intent: AvailabilityEditorIntent = .cannotWork
    @State private var dayOfWeek = 1
    @State private var date = Date()
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
                Section("Signal") {
                    Picker("Type", selection: $intent) {
                        ForEach(AvailabilityEditorIntent.allCases) { option in
                            Label(option.label, systemImage: option.systemImage).tag(option)
                        }
                    }
                    Text(intent.detail)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }

                Section("When") {
                    Picker("Repeats", selection: $kind) {
                        ForEach(AvailabilityEditorKind.allCases) { option in
                            Text(option.label).tag(option)
                        }
                    }
                    .pickerStyle(.segmented)

                    if kind == .weekly {
                        Picker("Day", selection: $dayOfWeek) {
                            ForEach(0..<7, id: \.self) { Text(availabilityDayNames[$0]).tag($0) }
                        }
                    } else {
                        DatePicker("Date", selection: $date, displayedComponents: .date)
                    }
                }

                Section("Time") {
                    DatePicker("Starts", selection: $start, displayedComponents: .hourAndMinute)
                    DatePicker("Ends", selection: $end, displayedComponents: .hourAndMinute)
                }

                Section {
                    TextField(intent.labelPlaceholder, text: $label)
                } footer: {
                    Text(kind == .weekly ? "Repeats weekly until you remove it." : "Applies only to the selected date.")
                }

                if let error {
                    Section {
                        Text(error)
                            .font(.footnote)
                            .foregroundStyle(Color.statusText(.red))
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
        let trimmed = label.trimmingCharacters(in: .whitespacesAndNewlines)
        do {
            _ = try await APIClient.shared.createAvailabilityBlock(
                userId: userId,
                kind: kind.rawValue,
                intent: intent.rawValue,
                dayOfWeek: dayOfWeek,
                date: kind == .adHoc ? Self.yyyyMMdd(date) : nil,
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
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "HH:mm"
        return formatter.string(from: date)
    }

    private static func yyyyMMdd(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: date)
    }
}

private enum AvailabilityEditorKind: String, CaseIterable, Identifiable {
    case weekly = "WEEKLY"
    case adHoc = "AD_HOC"

    var id: String { rawValue }

    var label: String {
        switch self {
        case .weekly: "Weekly"
        case .adHoc: "One-time"
        }
    }
}

private enum AvailabilityEditorIntent: String, CaseIterable, Identifiable {
    case cannotWork = "CANNOT_WORK"
    case prefer = "PREFER"
    case dislike = "DISLIKE"
    case timeOff = "TIME_OFF"

    var id: String { rawValue }

    var label: String {
        switch self {
        case .cannotWork: "Cannot work"
        case .prefer: "Prefer"
        case .dislike: "Avoid if possible"
        case .timeOff: "Time off"
        }
    }

    var detail: String {
        switch self {
        case .cannotWork: "Warns staff that you are unavailable during this window."
        case .prefer: "Helps staff spot shifts you would like to work."
        case .dislike: "Warns staff this window is not ideal, without blocking assignment."
        case .timeOff: "Requests time off. Approved time off blocks pickup and trade actions."
        }
    }

    var labelPlaceholder: String {
        switch self {
        case .cannotWork: "Label (optional), e.g. CHEM 101"
        case .prefer: "Label (optional), e.g. Like photo shifts"
        case .dislike: "Label (optional), e.g. Lab conflict"
        case .timeOff: "Reason (optional), e.g. Family trip"
        }
    }

    var systemImage: String {
        switch self {
        case .cannotWork: "calendar.badge.exclamationmark"
        case .prefer: "checkmark.circle"
        case .dislike: "exclamationmark.triangle"
        case .timeOff: "hand.raised"
        }
    }
}

private struct AvailabilityIntentMetadata {
    let label: String
    let systemImage: String
    let tone: StatusTone
}

private extension AvailabilityBlock {
    var normalizedKind: String { kind ?? "WEEKLY" }
    var normalizedIntent: String { intent ?? "CANNOT_WORK" }
    var normalizedStatus: String { status ?? "APPROVED" }

    var isWeekly: Bool {
        normalizedKind != "AD_HOC" && dayOfWeek != nil
    }

    var isDated: Bool {
        normalizedKind == "AD_HOC" || dateValue != nil
    }

    var isApprovedTimeOff: Bool {
        normalizedIntent == "TIME_OFF" && normalizedStatus == "APPROVED"
    }

    var isPreference: Bool {
        normalizedIntent == "PREFER"
    }

    var isAdvisory: Bool {
        switch normalizedIntent {
        case "CANNOT_WORK", "DISLIKE":
            true
        case "TIME_OFF":
            normalizedStatus == "PENDING"
        default:
            false
        }
    }

    var intentMetadata: AvailabilityIntentMetadata {
        switch normalizedIntent {
        case "PREFER":
            AvailabilityIntentMetadata(label: "Prefer", systemImage: "checkmark.circle.fill", tone: .green)
        case "DISLIKE":
            AvailabilityIntentMetadata(label: "Avoid", systemImage: "exclamationmark.triangle.fill", tone: .orange)
        case "TIME_OFF":
            AvailabilityIntentMetadata(label: "Time off", systemImage: "hand.raised.fill", tone: statusTone)
        default:
            AvailabilityIntentMetadata(label: "Cannot work", systemImage: "calendar.badge.exclamationmark", tone: .orange)
        }
    }

    var statusTone: StatusTone {
        switch normalizedStatus {
        case "APPROVED": normalizedIntent == "TIME_OFF" ? .red : .green
        case "PENDING": .orange
        case "DENIED": .gray
        default: .gray
        }
    }

    var primaryLine: String {
        if let label, !label.isEmpty { return label }
        return intentMetadata.label
    }

    var secondaryLine: String {
        var parts: [String] = []
        if let dateLine = displayDate {
            parts.append(dateLine)
        }
        parts.append("\(startsAt)-\(endsAt)")
        if let semesterLabel, !semesterLabel.isEmpty {
            parts.append(semesterLabel)
        }
        return parts.joined(separator: " | ")
    }

    var statusLine: String? {
        guard normalizedIntent == "TIME_OFF" else { return nil }
        return switch normalizedStatus {
        case "APPROVED": "Approved time off"
        case "PENDING": "Pending staff review"
        case "DENIED": "Denied"
        default: nil
        }
    }

    var accessibilityLabel: String {
        [
            primaryLine,
            intentMetadata.label,
            secondaryLine,
            statusLine,
        ].compactMap { $0 }.joined(separator: ", ")
    }

    var dateValue: String? {
        guard let date, !date.isEmpty else { return nil }
        if date.count >= 10 { return String(date.prefix(10)) }
        return date
    }

    var displayDate: String? {
        guard let dateValue else { return nil }
        let input = DateFormatter()
        input.locale = Locale(identifier: "en_US_POSIX")
        input.dateFormat = "yyyy-MM-dd"
        guard let date = input.date(from: dateValue) else { return dateValue }
        return date.formatted(date: .abbreviated, time: .omitted)
    }
}
