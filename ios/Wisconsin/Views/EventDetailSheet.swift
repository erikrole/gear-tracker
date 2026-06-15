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
    let eventWork: DashboardEventWork?
    @Environment(SessionStore.self) private var session
    @Environment(\.dismiss) private var dismiss

    @State private var vm: EventDetailViewModel
    @State private var weatherData: EventWeatherData?
    @State private var prepGearOpen = false
    @State private var assignTarget: EventShift?
    @State private var requestTarget: EventShift?
    @State private var unassignTarget: ShiftAssignmentRecord?
    @State private var deleteTarget: EventShift?
    @State private var editTimesTarget: EventShift?
    @State private var showAddShift = false
    @State private var isCreatingGroup = false
    @State private var actionError: String?

    init(event: ScheduleEvent, myShift: MyShift?, eventWork: DashboardEventWork? = nil) {
        self.event = event
        self.myShift = myShift
        self.eventWork = eventWork
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
                    if eventWork != nil || myShift != nil {
                        Divider()
                        gearAndCallSection
                    }
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
                            Label("Add shift", systemImage: "plus.circle")
                        }
                    }
                }
                if canPrepGear {
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
            .navigationDestination(for: BookingRouteId.self) { route in
                BookingDetailView(bookingId: route.id)
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
            .sheet(item: $editTimesTarget) { shift in
                EditShiftTimesSheet(shift: shift) { newStart, newEnd in
                    await updateShiftTimes(shift, startsAt: newStart, endsAt: newEnd)
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
            .confirmationDialog(
                deleteDialogTitle,
                isPresented: Binding(
                    get: { deleteTarget != nil },
                    set: { if !$0 { deleteTarget = nil } }
                ),
                titleVisibility: .visible
            ) {
                Button("Delete shift", role: .destructive) {
                    guard let shift = deleteTarget else { return }
                    Task { await deleteShift(shift) }
                    deleteTarget = nil
                }
                Button("Cancel", role: .cancel) { deleteTarget = nil }
            } message: {
                if let shift = deleteTarget, !shift.assignments.isEmpty {
                    Text("This shift has someone assigned. They'll be removed too.")
                } else {
                    Text("This cannot be undone.")
                }
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
        return "Request \(shift.area.shiftAreaLabel) shift?"
    }

    private var unassignDialogTitle: String {
        guard let assignment = unassignTarget else { return "Remove assignment?" }
        return "Remove \(assignment.user.name)?"
    }

    private var deleteDialogTitle: String {
        guard let shift = deleteTarget else { return "Delete shift?" }
        return "Delete \(shift.area.shiftAreaLabel) shift?"
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

    private func deleteShift(_ shift: EventShift) async {
        guard let groupId = vm.shiftGroup?.id else { return }
        do {
            try await APIClient.shared.deleteShift(shiftGroupId: groupId, shiftId: shift.id)
            Haptics.success()
            await vm.load()
        } catch {
            actionError = error.localizedDescription
            Haptics.error()
        }
    }

    private func updateShiftTimes(_ shift: EventShift, startsAt: Date, endsAt: Date) async {
        do {
            try await APIClient.shared.updateShiftTimes(shiftId: shift.id, startsAt: startsAt, endsAt: endsAt)
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
        if let work = eventWork, let userId = session.currentUser?.id {
            bookingVM.prefill(
                title: "Gear - \(event.summary)",
                startsAt: work.shift.startsAt,
                endsAt: event.endsAt,
                userId: userId,
                eventId: event.id,
                shiftAssignmentId: work.shift.id
            )
        } else if let shift = myShift, let userId = session.currentUser?.id {
            bookingVM.prefill(
                title: "Gear - \(event.summary)",
                startsAt: shift.startsAt,
                endsAt: event.endsAt,
                userId: userId,
                eventId: event.id,
                shiftAssignmentId: shift.id
            )
        }
        return bookingVM
    }

    private var canPrepGear: Bool {
        if eventWork?.needsGear == true { return true }
        return myShift != nil
    }

    private var callTime: Date? {
        eventWork?.shift.startsAt ?? myShift?.startsAt
    }

    @ViewBuilder
    private var gearAndCallSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Your Event")
                .font(.headline)

            VStack(alignment: .leading, spacing: 10) {
                if let gear = eventWork?.primaryGear, eventWork?.needsGear == false {
                    NavigationLink(value: BookingRouteId(id: gear.id)) {
                        detailLine(
                            icon: "archivebox.fill",
                            title: gearInstruction(for: gear),
                            subtitle: gear.itemCount == 1 ? "1 item reserved" : "\(gear.itemCount) items reserved",
                            tone: gear.status == .pendingPickup && gear.startsAt < Date() ? .orange : .green
                        )
                    }
                    .buttonStyle(.plain)
                } else {
                    Button {
                        prepGearOpen = true
                    } label: {
                        detailLine(
                            icon: "archivebox",
                            title: "Reserve gear now",
                            subtitle: "Add the gear you need for this event.",
                            tone: .blue
                        )
                    }
                    .buttonStyle(.plain)
                }

                if let callTime {
                    detailLine(
                        icon: "clock.fill",
                        title: "Call time at \(callTime.formatted(date: .omitted, time: .shortened))",
                        subtitle: eventWork?.shift.area.shiftAreaLabel ?? myShift?.area.shiftAreaLabel ?? "Shift",
                        tone: .blue
                    )
                }
            }
            .padding(12)
            .background(.background.secondary)
            .clipShape(RoundedRectangle(cornerRadius: 10))
        }
    }

    private func detailLine(icon: String, title: String, subtitle: String, tone: StatusTone) -> some View {
        HStack(spacing: 10) {
            Image(systemName: icon)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Color.statusText(tone))
                .frame(width: 24)
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.primary)
                Text(subtitle)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
        }
        .contentShape(Rectangle())
    }

    private func gearInstruction(for gear: BookingSummary) -> String {
        let time = gear.startsAt.formatted(date: .omitted, time: .shortened)
        if gear.status == .pendingPickup && gear.startsAt < Date() {
            return "Pickup gear now"
        }
        return "Pickup gear at \(time)"
    }

    // MARK: - Event Header

    /// Single day → "Saturday, June 14, 2026". Multi-day → "Sat, Jun 14 – Mon,
    /// Jun 16, 2026" (drops the redundant start-year when both ends share one).
    private var eventDateText: String {
        guard event.isMultiDay else {
            return event.startsAt.formatted(.dateTime.weekday(.wide).month(.wide).day().year())
        }
        let cal = Calendar.current
        let endRef = event.allDay ? event.endsAt.addingTimeInterval(-1) : event.endsAt
        let sameYear = cal.isDate(event.startsAt, equalTo: endRef, toGranularity: .year)
        let start = event.startsAt.formatted(
            sameYear ? .dateTime.weekday(.abbreviated).month(.abbreviated).day()
                     : .dateTime.weekday(.abbreviated).month(.abbreviated).day().year()
        )
        let end = endRef.formatted(.dateTime.weekday(.abbreviated).month(.abbreviated).day().year())
        return "\(start) – \(end)"
    }

    /// Times read as a same-day range; for multi-day they're labeled so they
    /// don't look like one continuous block on a single day.
    private var eventTimeText: String {
        let start = event.startsAt.formatted(.dateTime.hour().minute())
        let end = event.endsAt.formatted(.dateTime.hour().minute())
        return event.isMultiDay ? "Starts \(start) · ends \(end)" : "\(start) – \(end)"
    }

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
                    eventDateText,
                    systemImage: event.isMultiDay ? "calendar.day.timeline.left" : "calendar"
                )
                .font(.subheadline)
                .foregroundStyle(.secondary)

                if !event.allDay {
                    Label(eventTimeText, systemImage: "clock")
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
                    onDuplicate: { shift in Task { await duplicateShift(shift) } },
                    onEditTimes: { shift in editTimesTarget = shift },
                    onDelete: { shift in
                        if shift.assignments.isEmpty {
                            Task { await deleteShift(shift) }
                        } else {
                            deleteTarget = shift
                        }
                    }
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
            .background(Color.statusBackground(tone))
            .foregroundStyle(Color.statusText(tone))
            .clipShape(Capsule())
            .accessibilityLabel("Crew coverage: \(coverage.filled) of \(coverage.total) filled")
    }

    private var tone: StatusTone {
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
    var onEditTimes: ((EventShift) -> Void)? = nil
    var onDelete: ((EventShift) -> Void)? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Area header — title-cased ("Video" / "Photo") so the row's
            // ALL-CAPS server token doesn't shout. tracking dropped since
            // sentence case doesn't need the wide letterspacing.
            Text(area.shiftAreaLabel)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.primary)
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
                        onDuplicate: onDuplicate,
                        onEditTimes: onEditTimes,
                        onDelete: onDelete
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
    var onEditTimes: ((EventShift) -> Void)? = nil
    var onDelete: ((EventShift) -> Void)? = nil

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
                    .accessibilityHidden(true)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(isHighlighted ? Color.accentColor.opacity(0.06) : Color.clear)
        .contentShape(.contextMenuPreview, Rectangle())
        .contextMenu { rowContextMenu }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(rowAccessibilityLabel)
    }

    private var rowAccessibilityLabel: String {
        let timeRange = "\(shift.startsAt.formatted(.dateTime.hour().minute())) to \(shift.endsAt.formatted(.dateTime.hour().minute()))"
        var parts: [String] = []
        if isHighlighted { parts.append("Your shift") }
        parts.append("\(workerTypeLabel) shift")
        parts.append(timeRange)
        if shift.isOpen {
            parts.append("Open slot")
        } else {
            let names = shift.assignments.map { assignment -> String in
                if assignment.status == "REQUESTED" {
                    return "\(assignment.user.name), pending"
                }
                return assignment.user.name
            }.joined(separator: ", ")
            parts.append("Assigned: \(names)")
        }
        return parts.joined(separator: ". ")
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
        // Duplicate / Edit times / Delete always available to staff
        if canManageShifts {
            if let onDuplicate {
                Button { onDuplicate(shift) } label: {
                    Label("Duplicate shift", systemImage: "plus.square.on.square")
                }
            }
            if let onEditTimes {
                Button { onEditTimes(shift) } label: {
                    Label("Change call time", systemImage: "clock.badge.checkmark")
                }
            }
            if let onDelete {
                Button(role: .destructive) { onDelete(shift) } label: {
                    Label("Delete shift", systemImage: "trash")
                }
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
                                StatusPill(label: "Pending", tone: .orange)
                            }
                        }
                        if canManageShifts && assignment.status == "REQUESTED" {
                            // Approve is the primary call-to-action (filled green);
                            // Decline is a clearly-separated outlined red. Bumped from
                            // .mini to .small + wider spacing so two consequential
                            // actions aren't a mis-tap risk on a dense row.
                            HStack(spacing: 10) {
                                if let onApprove {
                                    Button("Approve \(assignment.user.name)") { onApprove(assignment) }
                                        .buttonStyle(.borderedProminent)
                                        .controlSize(.small)
                                        .tint(Color.statusText(.green))
                                        .accessibilityLabel("Approve \(assignment.user.name)")
                                }
                                if let onDecline {
                                    Button("Decline \(assignment.user.name)") { onDecline(assignment) }
                                        .buttonStyle(.bordered)
                                        .controlSize(.small)
                                        .tint(Color.statusText(.red))
                                        .accessibilityLabel("Decline \(assignment.user.name)")
                                }
                            }
                            .padding(.top, 2)
                        }
                    }
                }
            }
        }
    }

    @ViewBuilder
    private var openSlotView: some View {
        // Open slots are where the primary call-to-action lives — surface it as a
        // real tinted button, not accent-colored text, so it reads as tappable and
        // gives a comfortable hit area for both staff (Assign) and students (Request).
        if canManageShifts, let onAssign {
            Button { onAssign(shift) } label: {
                Label("Assign person", systemImage: "plus.circle.fill")
                    .font(.subheadline.weight(.medium))
            }
            .buttonStyle(.bordered)
            .controlSize(.small)
            .tint(Color.accentColor)
            .accessibilityLabel("Assign \(shift.area.shiftAreaLabel) shift")
        } else if isStudent && isStudentSlot, let onRequest {
            Button { onRequest(shift) } label: {
                Label("Request shift", systemImage: "hand.raised.fill")
                    .font(.subheadline.weight(.medium))
            }
            .buttonStyle(.bordered)
            .controlSize(.small)
            .tint(Color.accentColor)
            .accessibilityLabel("Request \(shift.area.shiftAreaLabel) shift")
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
        shift.workerType == "FT" ? .secondary : Color.statusText(.blue)
    }
}

// MARK: - Edit Shift Times Sheet

struct EditShiftTimesSheet: View {
    let shift: EventShift
    let onSave: (Date, Date) async -> Void

    @State private var startsAt: Date
    @State private var endsAt: Date
    @State private var isSaving = false
    @State private var showDiscardConfirm = false
    @Environment(\.dismiss) private var dismiss

    init(shift: EventShift, onSave: @escaping (Date, Date) async -> Void) {
        self.shift = shift
        self.onSave = onSave
        _startsAt = State(initialValue: shift.startsAt)
        _endsAt = State(initialValue: shift.endsAt)
    }

    private var hasChanges: Bool {
        startsAt != shift.startsAt || endsAt != shift.endsAt
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    DatePicker("Call time", selection: $startsAt, displayedComponents: [.hourAndMinute])
                        .disabled(isSaving)
                    DatePicker("End time", selection: $endsAt, in: startsAt..., displayedComponents: [.hourAndMinute])
                        .disabled(isSaving)
                } header: {
                    Text("\(shift.area.shiftAreaLabel) shift")
                } footer: {
                    Text("Times apply to this shift only.")
                        .font(.caption)
                }
            }
            .navigationTitle("Change call time")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        if isSaving { return }
                        if hasChanges {
                            showDiscardConfirm = true
                        } else {
                            dismiss()
                        }
                    }
                    .disabled(isSaving)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button {
                        Task { await save() }
                    } label: {
                        if isSaving {
                            ProgressView().controlSize(.small)
                        } else {
                            Text("Save").fontWeight(.semibold)
                        }
                    }
                    .disabled(isSaving || !hasChanges)
                }
            }
            .interactiveDismissDisabled(isSaving || hasChanges)
            .confirmationDialog(
                "Discard changes?",
                isPresented: $showDiscardConfirm,
                titleVisibility: .visible
            ) {
                Button("Discard", role: .destructive) { dismiss() }
                Button("Keep Editing", role: .cancel) {}
            } message: {
                Text("Your changes will be lost.")
            }
        }
        .presentationDetents([.height(320)])
        .presentationDragIndicator(.visible)
    }

    private func save() async {
        isSaving = true
        await onSave(startsAt, endsAt)
        isSaving = false
        // Parent handles success/error haptic + alert. Sheet always
        // dismisses — failures will be visible in the parent's actionError.
        dismiss()
    }
}

#Preview {
    Text("Tap an event to see detail")
}
