import SwiftUI

// MARK: - View Model

@MainActor
@Observable
final class EventDetailViewModel {
    let event: ScheduleEvent
    let myShift: MyShift?

    var shiftGroup: EventShiftGroup?
    var isLoading = false
    var error: String?

    init(event: ScheduleEvent, myShift: MyShift?) {
        self.event = event
        self.myShift = myShift
    }

    func load() async {
        guard !isLoading else { return }
        isLoading = true
        error = nil
        do {
            shiftGroup = try await APIClient.shared.shiftGroup(eventId: event.id)
        } catch APIError.unauthorized {
            // SessionStore handles the global routing on 401.
            isLoading = false
            return
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }

    private static let areaOrder = ["VIDEO", "PHOTO", "GRAPHICS", "COMMS"]

    var shiftsByArea: [(area: String, shifts: [EventShift])] {
        guard let group = shiftGroup else { return [] }
        var byArea: [String: [EventShift]] = [:]
        for shift in group.shifts {
            byArea[shift.area, default: []].append(shift)
        }
        return byArea
            .sorted {
                let ai = Self.areaOrder.firstIndex(of: $0.key) ?? Int.max
                let bi = Self.areaOrder.firstIndex(of: $1.key) ?? Int.max
                return ai < bi
            }
            .map { (area: $0.key, shifts: $0.value.sorted { $0.startsAt < $1.startsAt }) }
    }
}

// MARK: - Sheet

struct EventDetailSheet: View {
    let event: ScheduleEvent
    let myShift: MyShift?
    @Environment(SessionStore.self) private var session
    @Environment(\.dismiss) private var dismiss

    @State private var vm: EventDetailViewModel
    @State private var weatherData: EventWeatherData?
    @State private var prepGearOpen = false
    @State private var assignTarget: EventShift?
    @State private var requestTarget: EventShift?
    @State private var unassignTarget: ShiftAssignmentRecord?
    @State private var showAddShift = false
    @State private var isCreatingGroup = false
    @State private var actionError: String?

    init(event: ScheduleEvent, myShift: MyShift?) {
        self.event = event
        self.myShift = myShift
        _vm = State(initialValue: EventDetailViewModel(event: event, myShift: myShift))
    }

    private var canManageShifts: Bool {
        let role = session.currentUser?.role ?? ""
        return role == "STAFF" || role == "ADMIN"
    }

    private var isStudent: Bool {
        (session.currentUser?.role ?? "") == "STUDENT"
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    eventHeader
                    Divider()
                    crewSection
                }
                .padding(.horizontal, 20)
                .padding(.vertical, 16)
            }
            .navigationTitle("")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .principal) {
                    Text(event.summary)
                        .font(.headline)
                        .lineLimit(1)
                }
                if canManageShifts && vm.shiftGroup != nil {
                    ToolbarItem(placement: .topBarLeading) {
                        Button { showAddShift = true } label: {
                            Image(systemName: "plus.circle")
                        }
                        .accessibilityLabel("Add shift")
                    }
                }
                if myShift != nil {
                    ToolbarItem(placement: .bottomBar) {
                        Button {
                            prepGearOpen = true
                        } label: {
                            Label("Prep gear", systemImage: "archivebox")
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.borderedProminent)
                        .padding(.horizontal)
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
            .task { await vm.load() }
            .task { weatherData = await EventWeatherService.shared.weather(for: event) }
            .sheet(isPresented: $prepGearOpen) {
                CreateBookingSheet(vm: makePrepGearVM()) { _ in }
            }
            .sheet(item: $assignTarget) { shift in
                AssignStudentSheet(
                    shiftId: shift.id,
                    shiftArea: shift.area,
                    sportCode: event.sportCode,
                    onAssigned: { Task { await vm.load() } }
                )
            }
            .sheet(isPresented: $showAddShift) {
                if let group = vm.shiftGroup {
                    AddShiftSheet(
                        shiftGroupId: group.id,
                        defaultStart: event.startsAt,
                        defaultEnd: event.endsAt,
                        onAdded: { Task { await vm.load() } }
                    )
                }
            }
            .confirmationDialog(
                requestDialogTitle,
                isPresented: Binding(
                    get: { requestTarget != nil },
                    set: { if !$0 { requestTarget = nil } }
                ),
                titleVisibility: .visible
            ) {
                Button("Request shift") {
                    guard let shift = requestTarget else { return }
                    Task { await requestShift(shift) }
                    requestTarget = nil
                }
                Button("Cancel", role: .cancel) { requestTarget = nil }
            } message: {
                Text("Staff will review your request before it's confirmed.")
            }
            .confirmationDialog(
                unassignDialogTitle,
                isPresented: Binding(
                    get: { unassignTarget != nil },
                    set: { if !$0 { unassignTarget = nil } }
                ),
                titleVisibility: .visible
            ) {
                Button("Remove assignment", role: .destructive) {
                    guard let assignment = unassignTarget else { return }
                    Task { await unassign(assignment) }
                    unassignTarget = nil
                }
                Button("Keep", role: .cancel) { unassignTarget = nil }
            }
            .alert(
                "Couldn't update shift",
                isPresented: Binding(
                    get: { actionError != nil },
                    set: { if !$0 { actionError = nil } }
                )
            ) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(actionError ?? "")
            }
        }
    }

    // MARK: - Action handlers

    private var requestDialogTitle: String {
        guard let shift = requestTarget else { return "Request shift?" }
        return "Request \(shift.area) shift?"
    }

    private var unassignDialogTitle: String {
        guard let assignment = unassignTarget else { return "Remove assignment?" }
        return "Remove \(assignment.user.name)?"
    }

    private func requestShift(_ shift: EventShift) async {
        do {
            try await APIClient.shared.requestShift(shiftId: shift.id)
            Haptics.success()
            await vm.load()
        } catch {
            actionError = error.localizedDescription
            Haptics.error()
        }
    }

    private func unassign(_ assignment: ShiftAssignmentRecord) async {
        do {
            try await APIClient.shared.unassignShift(assignmentId: assignment.id)
            Haptics.success()
            await vm.load()
        } catch {
            actionError = error.localizedDescription
            Haptics.error()
        }
    }

    private func approveRequest(_ assignment: ShiftAssignmentRecord) async {
        do {
            try await APIClient.shared.approveShift(assignmentId: assignment.id)
            Haptics.success()
            await vm.load()
        } catch {
            actionError = error.localizedDescription
            Haptics.error()
        }
    }

    private func declineRequest(_ assignment: ShiftAssignmentRecord) async {
        do {
            try await APIClient.shared.declineShift(assignmentId: assignment.id)
            Haptics.success()
            await vm.load()
        } catch {
            actionError = error.localizedDescription
            Haptics.error()
        }
    }

    private func duplicateShift(_ shift: EventShift) async {
        guard let groupId = vm.shiftGroup?.id else { return }
        do {
            try await APIClient.shared.addShift(
                shiftGroupId: groupId,
                area: shift.area,
                workerType: shift.workerType,
                startsAt: shift.startsAt,
                endsAt: shift.endsAt
            )
            Haptics.success()
            await vm.load()
        } catch {
            actionError = error.localizedDescription
            Haptics.error()
        }
    }

    private func makePrepGearVM() -> CreateBookingViewModel {
        let bookingVM = CreateBookingViewModel()
        if let shift = myShift, let userId = session.currentUser?.id {
            bookingVM.prefill(
                title: "Gear – \(event.summary)",
                startsAt: shift.startsAt,
                endsAt: event.endsAt,
                userId: userId,
                eventId: event.id,
                shiftAssignmentId: shift.id
            )
        }
        return bookingVM
    }

    // MARK: - Event Header

    private var eventHeader: some View {
        VStack(alignment: .leading, spacing: 10) {
            // Sport + home/away
            HStack(spacing: 8) {
                if let sport = sportLabel(event.sportCode) {
                    Text(sport)
                        .font(.caption.weight(.semibold))
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(Color.accentColor.opacity(0.12))
                        .foregroundStyle(Color.accentColor)
                        .clipShape(Capsule())
                }
                if let isHome = event.isHome {
                    let locationText = event.location?.name ?? (isHome ? "Home" : "Away")
                    Label(locationText, systemImage: isHome ? "house" : "airplane.departure")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }

            // Title
            Text(event.summary)
                .font(.title3.weight(.semibold))

            // Date + time
            VStack(alignment: .leading, spacing: 4) {
                Label(
                    event.startsAt.formatted(.dateTime.weekday(.wide).month(.wide).day().year()),
                    systemImage: "calendar"
                )
                .font(.subheadline)
                .foregroundStyle(.secondary)

                if !event.allDay {
                    Label(
                        "\(event.startsAt.formatted(.dateTime.hour().minute())) – \(event.endsAt.formatted(.dateTime.hour().minute()))",
                        systemImage: "clock"
                    )
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                }

                if let location = event.location {
                    Label(location.name, systemImage: "mappin.and.ellipse")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }

                if let weather = weatherData {
                    HStack(spacing: 6) {
                        Image(systemName: weather.symbolName)
                            .symbolRenderingMode(.multicolor)
                            .font(.subheadline)
                        Text(weather.temperature)
                            .font(.subheadline)
                        Spacer()
                        Link("Apple Weather", destination: URL(string: "https://weatherkit.apple.com/legal-attribution.html")!)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            }
        }
    }

    // MARK: - Crew Section

    @ViewBuilder
    private var crewSection: some View {
        if vm.isLoading {
            HStack(spacing: 10) {
                ProgressView()
                Text("Loading crew...")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity, alignment: .center)
            .padding(.vertical, 20)
        } else if let err = vm.error {
            ContentUnavailableView {
                Label("Couldn't load crew", systemImage: "exclamationmark.triangle")
            } description: {
                Text(err)
            } actions: {
                Button("Retry") { Task { await vm.load() } }
            }
        } else if vm.shiftGroup == nil {
            VStack(spacing: 12) {
                Image(systemName: "person.2.slash")
                    .font(.largeTitle)
                    .foregroundStyle(.tertiary)
                Text("No crew scheduled")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                if canManageShifts {
                    Button {
                        Task {
                            isCreatingGroup = true
                            do {
                                vm.shiftGroup = try await APIClient.shared.createShiftGroup(eventId: event.id)
                            } catch {
                                actionError = error.localizedDescription
                            }
                            isCreatingGroup = false
                        }
                    } label: {
                        if isCreatingGroup {
                            ProgressView()
                                .controlSize(.small)
                        } else {
                            Label("Set up crew", systemImage: "plus.circle")
                        }
                    }
                    .buttonStyle(.bordered)
                    .disabled(isCreatingGroup)
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 24)
        } else {
            crewList
        }
    }

    private var crewList: some View {
        VStack(alignment: .leading, spacing: 16) {
            // Coverage summary header
            if let coverage = vm.shiftGroup?.coverage {
                HStack {
                    Text("Crew")
                        .font(.headline)
                    Spacer()
                    CoveragePill(coverage: coverage)
                }
            }

            // Per-area shift blocks
            ForEach(vm.shiftsByArea, id: \.area) { group in
                AreaBlock(
                    area: group.area,
                    shifts: group.shifts,
                    myShiftId: myShift?.id,
                    currentUserId: session.currentUser?.id,
                    canManageShifts: canManageShifts,
                    isStudent: isStudent,
                    onAssign: { shift in assignTarget = shift },
                    onRequest: { shift in requestTarget = shift },
                    onUnassign: { assignment in unassignTarget = assignment },
                    onApprove: { assignment in Task { await approveRequest(assignment) } },
                    onDecline: { assignment in Task { await declineRequest(assignment) } },
                    onDuplicate: { shift in Task { await duplicateShift(shift) } }
                )
            }
        }
    }
}

// MARK: - Coverage Pill

struct CoveragePill: View {
    let coverage: ShiftCoverage

    var body: some View {
        Text("\(coverage.filled)/\(coverage.total) filled")
            .font(.caption.weight(.semibold))
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(pillColor.opacity(0.15))
            .foregroundStyle(pillColor)
            .clipShape(Capsule())
    }

    private var pillColor: Color {
        if coverage.percentage >= 100 { return .green }
        if coverage.percentage > 0 { return .orange }
        return .red
    }
}

// MARK: - Area Block

struct AreaBlock: View {
    let area: String
    let shifts: [EventShift]
    let myShiftId: String?
    let currentUserId: String?
    var canManageShifts: Bool = false
    var isStudent: Bool = false
    var onAssign: ((EventShift) -> Void)? = nil
    var onRequest: ((EventShift) -> Void)? = nil
    var onUnassign: ((ShiftAssignmentRecord) -> Void)? = nil
    var onApprove: ((ShiftAssignmentRecord) -> Void)? = nil
    var onDecline: ((ShiftAssignmentRecord) -> Void)? = nil
    var onDuplicate: ((EventShift) -> Void)? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Area header
            Text(area)
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
                .textCase(.uppercase)
                .tracking(0.5)
                .padding(.bottom, 8)

            VStack(spacing: 0) {
                ForEach(Array(shifts.enumerated()), id: \.element.id) { idx, shift in
                    ShiftRow(
                        shift: shift,
                        isHighlighted: isMyShift(shift),
                        currentUserId: currentUserId,
                        canManageShifts: canManageShifts,
                        isStudent: isStudent,
                        onAssign: onAssign,
                        onRequest: onRequest,
                        onUnassign: onUnassign,
                        onApprove: onApprove,
                        onDecline: onDecline,
                        onDuplicate: onDuplicate
                    )
                    if idx < shifts.count - 1 {
                        Divider().padding(.leading, 44)
                    }
                }
            }
            .background(.background.secondary)
            .clipShape(RoundedRectangle(cornerRadius: 10))
        }
    }

    private func isMyShift(_ shift: EventShift) -> Bool {
        guard let userId = currentUserId else { return false }
        return shift.assignments.contains { $0.user.id == userId }
    }
}

// MARK: - Shift Row

struct ShiftRow: View {
    let shift: EventShift
    let isHighlighted: Bool
    let currentUserId: String?
    var canManageShifts: Bool = false
    var isStudent: Bool = false
    var onAssign: ((EventShift) -> Void)? = nil
    var onRequest: ((EventShift) -> Void)? = nil
    var onUnassign: ((ShiftAssignmentRecord) -> Void)? = nil
    var onApprove: ((ShiftAssignmentRecord) -> Void)? = nil
    var onDecline: ((ShiftAssignmentRecord) -> Void)? = nil
    var onDuplicate: ((EventShift) -> Void)? = nil

    private var isStudentSlot: Bool { shift.workerType == "ST" }

    var body: some View {
        HStack(spacing: 12) {
            // Call time column
            VStack(alignment: .trailing, spacing: 2) {
                Text(shift.startsAt.formatted(.dateTime.hour().minute()))
                    .font(.caption.monospacedDigit().weight(.medium))
                Text(shift.endsAt.formatted(.dateTime.hour().minute()))
                    .font(.caption2.monospacedDigit())
                    .foregroundStyle(.tertiary)
            }
            .frame(width: 52, alignment: .trailing)

            Divider().frame(height: 36)

            // Worker type badge
            Text(workerTypeLabel)
                .font(.caption2.weight(.medium))
                .padding(.horizontal, 6)
                .padding(.vertical, 2)
                .background(workerTypeColor.opacity(0.12))
                .foregroundStyle(workerTypeColor)
                .clipShape(Capsule())
                .fixedSize()

            // Assigned person (or open slot)
            assignedPersonView

            Spacer()

            // My-shift indicator dot
            if isHighlighted {
                Circle()
                    .fill(Color.accentColor)
                    .frame(width: 7, height: 7)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(isHighlighted ? Color.accentColor.opacity(0.06) : Color.clear)
        .contentShape(.contextMenuPreview, Rectangle())
        .contextMenu { rowContextMenu }
    }

    @ViewBuilder
    private var rowContextMenu: some View {
        if shift.isOpen {
            if canManageShifts, let onAssign {
                Button { onAssign(shift) } label: {
                    Label("Assign someone", systemImage: "person.badge.plus")
                }
            }
            if isStudent && isStudentSlot, let onRequest {
                Button { onRequest(shift) } label: {
                    Label("Request this shift", systemImage: "hand.raised")
                }
            }
        } else {
            // Pending request actions come first
            ForEach(shift.assignments.filter { $0.status == "REQUESTED" }, id: \.id) { assignment in
                if canManageShifts {
                    if let onApprove {
                        Button { onApprove(assignment) } label: {
                            Label("Approve \(assignment.user.name)", systemImage: "checkmark.circle")
                        }
                    }
                    if let onDecline {
                        Button(role: .destructive) { onDecline(assignment) } label: {
                            Label("Decline \(assignment.user.name)", systemImage: "xmark.circle")
                        }
                    }
                }
            }
            // Replace / Remove for assigned slots
            if canManageShifts {
                if let onAssign {
                    Button { onAssign(shift) } label: {
                        Label("Replace…", systemImage: "person.2.badge.gearshape.fill")
                    }
                }
                ForEach(shift.assignments, id: \.id) { assignment in
                    if let onUnassign {
                        Button(role: .destructive) { onUnassign(assignment) } label: {
                            Label("Remove \(assignment.user.name)", systemImage: "person.fill.xmark")
                        }
                    }
                }
            }
        }
        // Duplicate is always available to staff (open or filled)
        if canManageShifts, let onDuplicate {
            Button { onDuplicate(shift) } label: {
                Label("Duplicate shift", systemImage: "plus.square.on.square")
            }
        }
    }

    @ViewBuilder
    private var assignedPersonView: some View {
        if shift.isOpen {
            openSlotView
        } else {
            VStack(alignment: .leading, spacing: 1) {
                ForEach(shift.assignments, id: \.id) { assignment in
                    let isMe = currentUserId.map { $0 == assignment.user.id } ?? false
                    VStack(alignment: .leading, spacing: 4) {
                        HStack(spacing: 4) {
                            Text(assignment.user.name)
                                .font(.subheadline)
                                .foregroundStyle(isMe ? Color.primary : Color.secondary)
                            if isMe {
                                Image(systemName: "person.fill")
                                    .font(.caption2)
                                    .foregroundStyle(Color.accentColor)
                            }
                            if assignment.status == "REQUESTED" {
                                Text("Pending")
                                    .font(.caption2.weight(.semibold))
                                    .padding(.horizontal, 5)
                                    .padding(.vertical, 1)
                                    .background(Color.orange.opacity(0.15), in: Capsule())
                                    .foregroundStyle(.orange)
                            }
                        }
                        if canManageShifts && assignment.status == "REQUESTED" {
                            HStack(spacing: 6) {
                                if let onApprove {
                                    Button("Approve") { onApprove(assignment) }
                                        .buttonStyle(.bordered)
                                        .controlSize(.mini)
                                        .tint(.green)
                                }
                                if let onDecline {
                                    Button("Decline") { onDecline(assignment) }
                                        .buttonStyle(.borderless)
                                        .controlSize(.mini)
                                        .foregroundStyle(.red)
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    @ViewBuilder
    private var openSlotView: some View {
        if canManageShifts, let onAssign {
            Button {
                onAssign(shift)
            } label: {
                HStack(spacing: 4) {
                    Image(systemName: "plus.circle.fill")
                    Text("Assign")
                }
                .font(.subheadline.weight(.medium))
                .foregroundStyle(Color.accentColor)
            }
            .buttonStyle(.plain)
        } else if isStudent && isStudentSlot, let onRequest {
            Button {
                onRequest(shift)
            } label: {
                HStack(spacing: 4) {
                    Image(systemName: "hand.raised.fill")
                    Text("Request")
                }
                .font(.subheadline.weight(.medium))
                .foregroundStyle(Color.accentColor)
            }
            .buttonStyle(.plain)
        } else {
            Text("Open")
                .font(.subheadline)
                .foregroundStyle(.tertiary)
                .italic()
        }
    }

    private var workerTypeLabel: String {
        switch shift.workerType {
        case "ST": return "Student"
        case "FT": return "Staff"
        default:   return shift.workerType
        }
    }

    private var workerTypeColor: Color {
        shift.workerType == "FT" ? .secondary : .blue
    }
}

#Preview {
    Text("Tap an event to see detail")
}
