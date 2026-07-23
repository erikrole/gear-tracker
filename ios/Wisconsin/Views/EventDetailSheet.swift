import SwiftUI

// MARK: - View Model

@MainActor
@Observable
final class EventDetailViewModel {
    let event: ScheduleEvent
    let myShift: MyShift?

    var shiftGroup: EventShiftGroup? {
        didSet { shiftsByArea = Self.makeShiftsByArea(from: shiftGroup) }
    }
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

    private(set) var shiftsByArea: [(area: String, shifts: [EventShift])] = []

    private static func makeShiftsByArea(from shiftGroup: EventShiftGroup?) -> [(area: String, shifts: [EventShift])] {
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

// MARK: - Detail

struct EventDetailView: View {
    let event: ScheduleEvent
    let myShift: MyShift?
    let eventWork: DashboardEventWork?
    @Environment(SessionStore.self) private var session

    @State private var vm: EventDetailViewModel
    @State private var weatherData: EventWeatherData?
    @State private var prepGearOpen = false
    @State private var createdGearBookingId: String?
    @State private var pushBooking: BookingRouteId?
    @State private var assignTarget: EventShift?
    @State private var claimTarget: EventShift?
    @State private var postTradeTarget: TradePostCandidate?
    @State private var cancelTradeTarget: ShiftAssignmentRecord?
    @State private var unassignTarget: ShiftAssignmentRecord?
    @State private var deleteTarget: EventShift?
    @State private var editTimesTarget: EventShift?
    @State private var showAddShift = false
    @State private var isCreatingGroup = false
    @State private var actionError: String?
    @State private var actionErrorTitle = "Couldn't update event"
    @State private var actionRetry: (() -> Void)?

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
        ScrollView {
            LazyVStack(alignment: .leading, spacing: Brand.Space.md) {
                eventHeader
                if showsYourEventSection {
                    assignmentSection
                }
                if showsOpenShiftSection {
                    openShiftSection
                }
                crewSection
            }
            .padding(.horizontal, Brand.Space.md)
            .padding(.top, Brand.Space.sm)
            .padding(.bottom, Brand.Space.xl)
        }
        .background(Color(.systemGroupedBackground))
        .navigationTitle("")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .principal) {
                Text("Event")
                    .font(.headline)
                    .lineLimit(1)
            }
        }
        .task { await vm.load() }
        .task { weatherData = await EventWeatherService.shared.weather(for: event) }
        .refreshable { await vm.load() }
        .sheet(isPresented: $prepGearOpen) {
            CreateBookingSheet(vm: makePrepGearVM()) { newId in
                prepGearOpen = false
                createdGearBookingId = newId
                pushBooking = BookingRouteId(id: newId)
            }
        }
        .navigationDestination(item: $pushBooking) { route in
            BookingDetailView(bookingId: route.id)
        }
        .sheet(item: $assignTarget) { shift in
            AssignStudentSheet(
                shiftId: shift.id,
                shiftArea: shift.area,
                shiftWorkerType: shift.workerType,
                shiftStartsAt: shift.startsAt,
                shiftEndsAt: shift.endsAt,
                eventTitle: scheduleEventDisplayTitle(event),
                sportCode: event.sportCode,
                onAssigned: { Task { await vm.load() } }
            )
        }
        .sheet(isPresented: $showAddShift) {
            if let group = vm.shiftGroup {
                AddShiftSheet(
                    shiftGroupId: group.id,
                    eventTitle: scheduleEventDisplayTitle(event),
                    defaultStart: event.startsAt,
                    defaultEnd: event.endsAt,
                    onAdded: { Task { await vm.load() } }
                )
            }
        }
        .sheet(item: $editTimesTarget) { shift in
            EditShiftTimesSheet(
                shift: shift,
                eventTitle: scheduleEventDisplayTitle(event)
            ) { newStart, newEnd in
                await updateShiftTimes(shift, startsAt: newStart, endsAt: newEnd)
            }
        }
        .sheet(item: $postTradeTarget) { candidate in
            PostTradeSheet(candidate: candidate) { _ in
                Task { await vm.load() }
            }
        }
        .confirmationDialog(
            claimDialogTitle,
            isPresented: Binding(
                get: { claimTarget != nil },
                set: { if !$0 { claimTarget = nil } }
            ),
            titleVisibility: .visible
        ) {
            Button("Claim shift") {
                guard let shift = claimTarget else { return }
                Task { await claimShift(shift) }
                claimTarget = nil
            }
            Button("Cancel", role: .cancel) { claimTarget = nil }
        } message: {
            Text("You will be assigned immediately.")
        }
        .confirmationDialog(
            "Remove from Trade Board?",
            isPresented: Binding(
                get: { cancelTradeTarget != nil },
                set: { if !$0 { cancelTradeTarget = nil } }
            ),
            titleVisibility: .visible
        ) {
            Button("Remove from Trade Board") {
                guard let assignment = cancelTradeTarget else { return }
                Task { await removeTradeFromBoard(assignment) }
                cancelTradeTarget = nil
            }
            Button("Keep it posted", role: .cancel) { cancelTradeTarget = nil }
        } message: {
            if let assignment = cancelTradeTarget {
                let owner = assignment.user.id == session.currentUser?.id ? "You stay" : "\(assignment.user.name) stays"
                Text("The post is withdrawn. \(owner) on the shift.")
            }
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
            actionErrorTitle,
            isPresented: Binding(
                get: { actionError != nil },
                set: {
                    if !$0 {
                        actionError = nil
                        actionRetry = nil
                    }
                }
            )
        ) {
            if let retry = actionRetry {
                Button("Try Again") { retry() }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text(actionError ?? "")
        }
    }

    // MARK: - Action handlers

    private var claimDialogTitle: String {
        guard let shift = claimTarget else { return "Claim shift?" }
        return "Claim \(shift.area.shiftAreaLabel) shift?"
    }

    private var unassignDialogTitle: String {
        guard let assignment = unassignTarget else { return "Remove assignment?" }
        return "Remove \(assignment.user.name)?"
    }

    private func presentActionError(
        title: String,
        error: Error,
        retry: @escaping () async -> Void
    ) {
        actionErrorTitle = title
        actionError = error.localizedDescription
        actionRetry = { Task { await retry() } }
        Haptics.error()
    }

    private func removeTradeFromBoard(_ assignment: ShiftAssignmentRecord) async {
        guard let trade = assignment.activeTrade else { return }
        do {
            _ = try await APIClient.shared.cancelShiftTrade(id: trade.id)
            Haptics.success()
            await vm.load()
        } catch {
            presentActionError(title: "Couldn't remove trade post", error: error) {
                await removeTradeFromBoard(assignment)
            }
        }
    }

    private var deleteDialogTitle: String {
        guard let shift = deleteTarget else { return "Delete shift?" }
        return "Delete \(shift.area.shiftAreaLabel) shift?"
    }

    private func claimShift(_ shift: EventShift) async {
        do {
            try await APIClient.shared.pickupOpenShift(id: shift.id)
            Haptics.success()
            await vm.load()
        } catch {
            presentActionError(title: "Couldn't claim shift", error: error) {
                await claimShift(shift)
            }
        }
    }

    private func unassign(_ assignment: ShiftAssignmentRecord) async {
        do {
            try await APIClient.shared.unassignShift(assignmentId: assignment.id)
            Haptics.success()
            await vm.load()
        } catch {
            presentActionError(title: "Couldn't remove assignment", error: error) {
                await unassign(assignment)
            }
        }
    }

    private func approveRequest(_ assignment: ShiftAssignmentRecord) async {
        do {
            try await APIClient.shared.approveShift(assignmentId: assignment.id)
            Haptics.success()
            await vm.load()
        } catch {
            presentActionError(title: "Couldn't approve request", error: error) {
                await approveRequest(assignment)
            }
        }
    }

    private func declineRequest(_ assignment: ShiftAssignmentRecord) async {
        do {
            try await APIClient.shared.declineShift(assignmentId: assignment.id)
            Haptics.success()
            await vm.load()
        } catch {
            presentActionError(title: "Couldn't decline request", error: error) {
                await declineRequest(assignment)
            }
        }
    }

    private func deleteShift(_ shift: EventShift) async {
        guard let groupId = vm.shiftGroup?.id else { return }
        do {
            try await APIClient.shared.deleteShift(shiftGroupId: groupId, shiftId: shift.id)
            Haptics.success()
            await vm.load()
        } catch {
            presentActionError(title: "Couldn't delete shift", error: error) {
                await deleteShift(shift)
            }
        }
    }

    private func updateShiftTimes(_ shift: EventShift, startsAt: Date, endsAt: Date) async -> String? {
        do {
            try await APIClient.shared.updateShiftTimes(shiftId: shift.id, startsAt: startsAt, endsAt: endsAt)
            Haptics.success()
            await vm.load()
            return nil
        } catch {
            Haptics.error()
            return error.localizedDescription
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
            presentActionError(title: "Couldn't duplicate shift", error: error) {
                await duplicateShift(shift)
            }
        }
    }

    private func makePrepGearVM() -> CreateBookingViewModel {
        let bookingVM = CreateBookingViewModel()
        if let work = eventWork, let userId = session.currentUser?.id {
            bookingVM.prefill(
                title: event.shortBookingEventTitle,
                startsAt: work.shift.startsAt,
                endsAt: event.endsAt,
                userId: userId,
                eventId: event.id,
                shiftAssignmentId: work.shift.id
            )
        } else if let shift = myShift, let userId = session.currentUser?.id {
            bookingVM.prefill(
                title: event.shortBookingEventTitle,
                startsAt: shift.startsAt,
                endsAt: event.endsAt,
                userId: userId,
                eventId: event.id,
                shiftAssignmentId: shift.id
            )
        }
        return bookingVM
    }

    private var callTime: Date? {
        if event.displayAllDay { return nil }
        return eventWork?.shift.startsAt ?? myShift?.startsAt
    }

    private var eventHasEnded: Bool { event.endsAt < Date() }

    private var showsYourEventSection: Bool {
        guard eventWork != nil || myShift != nil else { return false }
        if eventHasEnded { return hasKnownGearBookings }
        return true
    }

    private var claimableStudentShifts: [EventShift] {
        guard isStudent, myShift == nil, !eventHasEnded else { return [] }
        return vm.shiftGroup?.shifts.filter {
            $0.workerType == "ST" && $0.isOpen && $0.startsAt > Date()
        } ?? []
    }

    private var showsOpenShiftSection: Bool {
        !claimableStudentShifts.isEmpty
    }

    private var hasKnownGearBookings: Bool {
        createdGearBookingId != nil
            || !reservedGearBookings.isEmpty
            || !(myShift?.gear.bookings.isEmpty ?? true)
    }

    /// Gear bookings linked to my event work; empty when gear still needs
    /// reserving (or when opened from a bare shift with no gear context).
    private var reservedGearBookings: [BookingSummary] {
        guard let work = eventWork, !work.needsGear else { return [] }
        return work.gearBookings
    }

    private var assignmentSection: some View {
        VStack(alignment: .leading, spacing: Brand.Space.sm) {
            EventDetailSectionHeader("Your Assignment", systemImage: "person.crop.circle.badge.checkmark")

            VStack(alignment: .leading, spacing: 12) {
                if let callTime {
                    TimelineView(.periodic(from: .now, by: 60)) { context in
                        detailLine(
                            icon: "clock.fill",
                            title: callTimeTitle(callTime, now: context.date),
                            subtitle: assignmentTimeSubtitle(now: context.date),
                            tone: .blue
                        )
                    }
                } else if let area = assignmentArea {
                    detailLine(
                        icon: "person.fill.checkmark",
                        title: area,
                        subtitle: "Assigned to this event",
                        tone: .blue
                    )
                }

                Divider()

                if let createdGearBookingId {
                    NavigationLink {
                        BookingDetailView(bookingId: createdGearBookingId)
                    } label: {
                        detailLine(
                            icon: "shippingbox.fill",
                            title: "Gear reserved",
                            subtitle: "Open reservation",
                            tone: .green,
                            showsChevron: true
                        )
                    }
                    .buttonStyle(.plain)
                } else if !reservedGearBookings.isEmpty {
                    ForEach(reservedGearBookings) { gear in
                        NavigationLink {
                            BookingDetailView(bookingId: gear.id)
                        } label: {
                            detailLine(
                                icon: "shippingbox.fill",
                                title: gearInstruction(for: gear),
                                subtitle: gearSubtitle(for: gear),
                                tone: gear.status == .pendingPickup && gear.startsAt < Date() ? .orange : .green,
                                showsChevron: true
                            )
                        }
                        .buttonStyle(.plain)
                    }
                } else if let shiftGear = myShift?.gear, !shiftGear.bookings.isEmpty {
                    ForEach(shiftGear.bookings) { gear in
                        NavigationLink {
                            BookingDetailView(bookingId: gear.id)
                        } label: {
                            detailLine(
                                icon: "shippingbox.fill",
                                title: shiftGear.gearLabel,
                                subtitle: gear.itemCount == 1 ? "1 item" : "\(gear.itemCount) items",
                                tone: shiftGearTone(shiftGear),
                                showsChevron: true
                            )
                        }
                        .buttonStyle(.plain)
                    }
                } else if !eventHasEnded {
                    Button {
                        prepGearOpen = true
                    } label: {
                        Label(reserveGearTitle, systemImage: "shippingbox.and.arrow.backward.fill")
                            .font(.subheadline.weight(.semibold))
                            .frame(maxWidth: .infinity, minHeight: 44)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(Color.statusText(.purple))
                }
            }
            .brandCard()
        }
    }

    private var openShiftSection: some View {
        VStack(alignment: .leading, spacing: Brand.Space.sm) {
            EventDetailSectionHeader("Open Shifts", systemImage: "person.badge.plus")
            VStack(spacing: 0) {
                ForEach(Array(claimableStudentShifts.enumerated()), id: \.element.id) { index, shift in
                    Button {
                        claimTarget = shift
                    } label: {
                        HStack(spacing: 12) {
                            Image(systemName: "hand.raised.fill")
                                .foregroundStyle(Color.statusText(.purple))
                                .frame(width: 24)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(shift.area.shiftAreaLabel)
                                    .font(.subheadline.weight(.semibold))
                                    .foregroundStyle(.primary)
                                if !event.displayAllDay {
                                    Text("\(shift.startsAt.formatted(date: .omitted, time: .shortened)) to \(shift.endsAt.formatted(date: .omitted, time: .shortened))")
                                        .font(.caption.monospacedDigit())
                                        .foregroundStyle(.secondary)
                                }
                            }
                            Spacer()
                            Text("Claim")
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(Color.statusText(.purple))
                            Image(systemName: "chevron.right")
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(.tertiary)
                        }
                        .padding(.vertical, 12)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    if index < claimableStudentShifts.count - 1 {
                        Divider().padding(.leading, 36)
                    }
                }
            }
            .brandCard()
        }
    }

    /// Add Shift lives in the Crew header rather than its own "Staffing" card.
    /// That card restated the same coverage the Crew pill already shows, under a
    /// near-identical people icon, so managers read the number twice.
    @ViewBuilder
    private var addShiftButton: some View {
        if canManageShifts, vm.shiftGroup != nil {
            Button {
                showAddShift = true
            } label: {
                Label("Add Shift", systemImage: "plus")
                    .font(.subheadline.weight(.semibold))
            }
            .buttonStyle(.bordered)
            .controlSize(.small)
            .frame(minHeight: 44)
            .tint(Color.statusText(.purple))
        }
    }

    private func gearSubtitle(for gear: BookingSummary) -> String {
        let items = gear.itemCount == 1 ? "1 item reserved" : "\(gear.itemCount) items reserved"
        // With multiple linked bookings, the booking title tells them apart.
        return reservedGearBookings.count > 1 ? "\(gear.title) · \(items)" : items
    }

    /// Today: "Call time at 3:30 PM" (countdown lives in the subtitle).
    /// Another day: "Call time Tue at 3:30 PM" — no countdown noise days out.
    private func callTimeTitle(_ callTime: Date, now: Date) -> String {
        let clock = callTime.formatted(date: .omitted, time: .shortened)
        if Calendar.current.isDate(callTime, inSameDayAs: now) {
            return callTime < now ? "Call time was \(clock)" : "Call time at \(clock)"
        }
        return "Call time \(callTime.formatted(.dateTime.weekday(.abbreviated))) at \(clock)"
    }

    private var assignmentArea: String? {
        let raw = eventWork?.shift.area ?? myShift?.area
        return raw?.shiftAreaLabel
    }

    private var assignmentEndsAt: Date? {
        eventWork?.shift.endsAt ?? myShift?.endsAt
    }

    private func assignmentTimeSubtitle(now: Date) -> String {
        var parts: [String] = []
        if let area = assignmentArea { parts.append(area) }
        if let endsAt = assignmentEndsAt {
            parts.append("Until \(endsAt.formatted(date: .omitted, time: .shortened))")
        }
        if let callTime, Calendar.current.isDate(callTime, inSameDayAs: now) {
            parts.append(callTime.formatted(.relative(presentation: .named)))
        }
        return parts.joined(separator: " · ")
    }

    private func shiftGearTone(_ gear: ShiftGear) -> StatusTone {
        switch gear.status {
        case "checked_out", "pickup_ready": return .orange
        case "reserved": return .green
        case "draft": return .purple
        default: return .gray
        }
    }

    /// "now" only when the event is actually today (or underway) — five days
    /// out it states the deadline instead of shouting.
    private var reserveGearTitle: String {
        if event.startsAt < Date() || Calendar.current.isDateInToday(event.startsAt) {
            return "Reserve gear now"
        }
        return "Reserve gear for \(event.startsAt.formatted(.dateTime.month(.abbreviated).day()))"
    }

    private func detailLine(icon: String, title: String, subtitle: String, tone: StatusTone, showsChevron: Bool = false) -> some View {
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
            if showsChevron {
                Image(systemName: "chevron.right")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.tertiary)
                    .accessibilityHidden(true)
            }
        }
        .contentShape(Rectangle())
    }

    private func gearInstruction(for gear: BookingSummary) -> String {
        if gear.status == .pendingPickup && gear.startsAt < Date() {
            return "Pickup gear now"
        }
        if event.displayAllDay {
            // All-day gear rows start at local midnight; "at 12:00 AM" is noise.
            return "Pickup gear for this event"
        }
        return "Pickup gear at \(gear.startsAt.formatted(date: .omitted, time: .shortened))"
    }

    // MARK: - Event Header

    private var eventDateText: String {
        guard event.isMultiDay else {
            return detailDateLabel(event.startsAt, abbreviatedWeekday: false)
        }
        let endRef = event.displayAllDay ? event.endsAt.addingTimeInterval(-1) : event.endsAt
        let start = detailDateLabel(event.startsAt, abbreviatedWeekday: true)
        let end = detailDateLabel(endRef, abbreviatedWeekday: true)
        return "\(start) – \(end)"
    }

    private func detailDateLabel(_ date: Date, abbreviatedWeekday: Bool) -> String {
        let calendar = Calendar.current
        let includesYear = calendar.component(.year, from: date) != calendar.component(.year, from: .now)
        if calendar.isDateInToday(date) {
            return "Today, \(date.formatted(.dateTime.month(abbreviatedWeekday ? .abbreviated : .wide).day()))"
        }
        if calendar.isDateInTomorrow(date) {
            return "Tomorrow, \(date.formatted(.dateTime.month(abbreviatedWeekday ? .abbreviated : .wide).day()))"
        }
        if abbreviatedWeekday {
            return includesYear
                ? date.formatted(.dateTime.weekday(.abbreviated).month(.abbreviated).day().year())
                : date.formatted(.dateTime.weekday(.abbreviated).month(.abbreviated).day())
        }
        return includesYear
            ? date.formatted(.dateTime.weekday(.wide).month(.wide).day().year())
            : date.formatted(.dateTime.weekday(.wide).month(.wide).day())
    }

    /// Times read as a same-day range; for multi-day they're labeled so they
    /// don't look like one continuous block on a single day.
    private var eventTimeText: String {
        let start = event.startsAt.formatted(.dateTime.hour().minute())
        let end = event.endsAt.formatted(.dateTime.hour().minute())
        return event.isMultiDay ? "Starts \(start) · ends \(end)" : "\(start) – \(end)"
    }

    private var eventTypeLabel: String {
        switch event.isHome {
        case true: return "Home"
        case false: return "Away"
        case nil: return event.opponent == nil ? "Non-game" : "Neutral"
        }
    }

    private var eventRailColor: Color {
        venueRailColor(isHome: event.isHome)
    }

    private var eventVenueName: String? {
        if let name = event.location?.name, !name.isEmpty { return name }
        if let raw = event.rawLocationText?.trimmingCharacters(in: .whitespacesAndNewlines), !raw.isEmpty { return raw }
        return nil
    }

    private var eventHeader: some View {
        HStack(alignment: .top, spacing: 14) {
            StatusRail(color: eventRailColor)

            VStack(alignment: .leading, spacing: 10) {
                HStack(spacing: 6) {
                    if let sport = sportLabel(event.sportCode) {
                        Text(sport)
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(.secondary)
                    }
                    if event.sportCode != nil {
                        Text("·").foregroundStyle(.tertiary)
                    }
                    Text(eventTypeLabel)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(eventRailColor)
                }

                Text(scheduleEventDisplayTitle(event))
                    .font(.gothamBlack(size: 26))
                    .foregroundStyle(.primary)
                    .lineLimit(3)
                    .fixedSize(horizontal: false, vertical: true)

                VStack(alignment: .leading, spacing: 6) {
                    Label(
                        eventDateText,
                        systemImage: event.isMultiDay ? "calendar.day.timeline.left" : "calendar"
                    )
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(.primary)

                    Label(event.displayAllDay ? "All day" : eventTimeText, systemImage: "clock")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)

                    if let eventVenueName {
                        Label(eventVenueName, systemImage: "mappin.and.ellipse")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }

                    if let weather = weatherData {
                        HStack(spacing: 5) {
                            Image(systemName: weather.symbolName)
                                .symbolRenderingMode(.multicolor)
                            Text(weather.temperature)
                            Link("Weather", destination: URL(string: "https://weatherkit.apple.com/legal-attribution.html")!)
                                .foregroundStyle(.tertiary)
                        }
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .brandCard()
    }

    // MARK: - Crew Section

    private var crewSection: some View {
        VStack(alignment: .leading, spacing: Brand.Space.sm) {
            EventDetailSectionHeader(title: "Crew", systemImage: "person.2.fill") {
                HStack(spacing: Brand.Space.sm) {
                    if canManageShifts, let coverage = vm.shiftGroup?.coverage {
                        CoveragePill(coverage: coverage)
                    }
                    addShiftButton
                }
            }
            crewBody
        }
    }

    @ViewBuilder
    private var crewBody: some View {
        if vm.isLoading {
            HStack(spacing: 10) {
                ProgressView()
                Text("Loading crew…")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                Spacer(minLength: 0)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .brandCard()
        } else if let err = vm.error {
            VStack(spacing: 8) {
                Label("Couldn't load crew", systemImage: "exclamationmark.triangle")
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(Color.statusText(.orange))
                Text(err)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                Button("Retry") { Task { await vm.load() } }
                    .buttonStyle(.bordered)
                    .controlSize(.small)
            }
            .frame(maxWidth: .infinity)
            .brandCard(alignment: .center)
        } else if vm.shiftGroup == nil {
            VStack(spacing: 10) {
                Image(systemName: "person.2.slash")
                    .font(.largeTitle)
                    .foregroundStyle(.tertiary)
                Text("No crew scheduled")
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(.secondary)
                Text("No shifts have been set up for this event yet.")
                    .font(.caption)
                    .foregroundStyle(.tertiary)
                    .multilineTextAlignment(.center)
                if canManageShifts {
                    Button {
                        Task { await createShiftGroup() }
                    } label: {
                        if isCreatingGroup {
                            ProgressView()
                                .controlSize(.small)
                        } else {
                            Label("Set up crew", systemImage: "plus.circle")
                        }
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.regular)
                    .padding(.top, 2)
                    .disabled(isCreatingGroup)
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 8)
            .brandCard(alignment: .center)
        } else {
            crewList
        }
    }

    private func createShiftGroup() async {
        isCreatingGroup = true
        defer { isCreatingGroup = false }
        do {
            vm.shiftGroup = try await APIClient.shared.createShiftGroup(eventId: event.id)
            Haptics.success()
        } catch {
            presentActionError(title: "Couldn't set up crew", error: error) {
                await createShiftGroup()
            }
        }
    }

    private var crewList: some View {
        VStack(alignment: .leading, spacing: Brand.Space.md) {
            // Per-area shift blocks (the "Crew" header lives in crewSection).
            ForEach(vm.shiftsByArea, id: \.area) { group in
                AreaBlock(
                    area: group.area,
                    shifts: group.shifts,
                    myShiftId: myShift?.id,
                    currentUserId: session.currentUser?.id,
                    canManageShifts: canManageShifts,
                    // Unassigned students claim from the dedicated action card
                    // above. Once assigned, the row menu remains available for
                    // their own trade actions without duplicating Claim controls.
                    isStudent: isStudent && !showsOpenShiftSection,
                    onAssign: { shift in assignTarget = shift },
                    onRequest: { shift in claimTarget = shift },
                    onPostTrade: { shift, assignment in
                        postTradeTarget = TradePostCandidate(
                            assignment: assignment,
                            shift: shift,
                            eventTitle: scheduleEventDisplayTitle(event),
                            currentUserId: session.currentUser?.id
                        )
                    },
                    onCancelTrade: { assignment in cancelTradeTarget = assignment },
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
                    },
                    hidesShiftTimes: event.displayAllDay
                )
            }
        }
    }
}

// MARK: - Section Header

private struct EventDetailSectionHeader<Trailing: View>: View {
    let title: String
    var systemImage: String? = nil
    @ViewBuilder var trailing: () -> Trailing

    var body: some View {
        HStack(alignment: .center, spacing: Brand.Space.sm) {
            if let systemImage {
                Image(systemName: systemImage)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.secondary)
                    .accessibilityHidden(true)
            }
            Text(title)
                .font(.headline)
                .foregroundStyle(.primary)
                .accessibilityAddTraits(.isHeader)
            Spacer(minLength: Brand.Space.sm)
            trailing()
        }
    }
}

private extension EventDetailSectionHeader where Trailing == EmptyView {
    init(_ title: String, systemImage: String? = nil) {
        self.init(title: title, systemImage: systemImage, trailing: { EmptyView() })
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

    private var tone: StatusTone { coverageTone(coverage) }
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
    var onPostTrade: ((EventShift, ShiftAssignmentRecord) -> Void)? = nil
    var onCancelTrade: ((ShiftAssignmentRecord) -> Void)? = nil
    var onUnassign: ((ShiftAssignmentRecord) -> Void)? = nil
    var onApprove: ((ShiftAssignmentRecord) -> Void)? = nil
    var onDecline: ((ShiftAssignmentRecord) -> Void)? = nil
    var onDuplicate: ((EventShift) -> Void)? = nil
    var onEditTimes: ((EventShift) -> Void)? = nil
    var onDelete: ((EventShift) -> Void)? = nil
    var hidesShiftTimes = false

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Area header — title-cased ("Video" / "Photo") so the row's
            // ALL-CAPS server token doesn't shout, with the area's icon. The
            // worker-type chip stays on the rows, never here: hoisting it for
            // uniform areas made adjacent blocks structurally different and
            // knocked the name column out of alignment between them.
            Label(area.shiftAreaLabel, systemImage: areaIcon)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.secondary)

            VStack(spacing: 0) {
                ForEach(Array(shifts.enumerated()), id: \.element.id) { idx, shift in
                    ShiftRow(
                        shift: shift,
                        isHighlighted: isMyShift(shift),
                        currentUserId: currentUserId,
                        canManageShifts: canManageShifts,
                        isStudent: isStudent,
                        hidesShiftTimes: hidesShiftTimes,
                        showsWorkerType: true,
                        onAssign: onAssign,
                        onRequest: onRequest,
                        onPostTrade: onPostTrade,
                        onCancelTrade: onCancelTrade,
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
            .background(Color.cardSurface)
            .clipShape(RoundedRectangle(cornerRadius: Brand.Radius.md, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Brand.Radius.md, style: .continuous)
                    .strokeBorder(Color.hairline, lineWidth: 0.5)
            )
        }
    }

    /// SF Symbol per shift area, matching the area's job.
    private var areaIcon: String {
        switch area {
        case "VIDEO":    return "video.fill"
        case "PHOTO":    return "camera.fill"
        case "GRAPHICS": return "paintpalette.fill"
        case "COMMS":    return "dot.radiowaves.left.and.right"
        default:         return "person.fill"
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
    var hidesShiftTimes = false
    /// Per-row Student/Staff badge. Suppressed when the whole area block is one
    /// worker type (it's shown once on the area header instead), so an all-staff
    /// crew isn't a column of identical "Staff" pills.
    var showsWorkerType: Bool = true
    var onAssign: ((EventShift) -> Void)? = nil
    var onRequest: ((EventShift) -> Void)? = nil
    var onPostTrade: ((EventShift, ShiftAssignmentRecord) -> Void)? = nil
    var onCancelTrade: ((ShiftAssignmentRecord) -> Void)? = nil
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
            if !hidesShiftTimes {
                VStack(alignment: .trailing, spacing: 2) {
                    Text(shift.startsAt.formatted(.dateTime.hour().minute()))
                        .font(.caption.monospacedDigit().weight(.medium))
                    Text(shift.endsAt.formatted(.dateTime.hour().minute()))
                        .font(.caption2.monospacedDigit())
                        .foregroundStyle(.tertiary)
                }
                .frame(width: 52, alignment: .trailing)

                Divider().frame(height: 36)
            }

            // Worker type badge — only when the block mixes Student/Staff.
            if showsWorkerType {
                Text(workerTypeLabel)
                    .font(.caption2.weight(.medium))
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(workerTypeColor.opacity(0.12))
                    .foregroundStyle(workerTypeColor)
                    .clipShape(Capsule())
                    .fixedSize()
                    // A fixed column so the avatar and name start at the same x
                    // on every row. "Student" is wider than "Staff", which
                    // otherwise ragged the name edge between rows.
                    .frame(width: 62, alignment: .leading)
            }

            // Assigned person (or open slot)
            assignedPersonView

            Spacer()
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .contentShape(.contextMenuPreview, Rectangle())
        .contextMenu { rowContextMenu }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(rowAccessibilityLabel)
    }

    private var rowAccessibilityLabel: String {
        var parts: [String] = []
        if isHighlighted { parts.append("Your shift") }
        parts.append("\(workerTypeLabel) shift")
        if !hidesShiftTimes {
            let timeRange = "\(shift.startsAt.formatted(.dateTime.hour().minute())) to \(shift.endsAt.formatted(.dateTime.hour().minute()))"
            parts.append(timeRange)
        }
        if shift.isOpen {
            parts.append("Open slot")
        } else {
            let names = shift.assignments.map { assignment -> String in
                if assignment.status == "REQUESTED" {
                    return "\(assignment.user.name), pending"
                }
                if assignment.isOnTradeBoard {
                    return "\(assignment.user.name), on the Trade Board"
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
                    Label("Claim this shift", systemImage: "hand.raised")
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
            // Trade Board: owners post their own shift; staff post student
            // shifts. Started shifts can't be traded (server enforces too).
            ForEach(shift.assignments.filter { $0.status != "REQUESTED" }, id: \.id) { assignment in
                let isMine = currentUserId == assignment.user.id
                if shift.startsAt > Date() {
                    if assignment.isOnTradeBoard {
                        if isMine || canManageShifts, let onCancelTrade {
                            Button { onCancelTrade(assignment) } label: {
                                Label(
                                    shift.assignments.count > 1
                                        ? "Remove \(assignment.user.name) from Trade Board"
                                        : "Remove from Trade Board",
                                    systemImage: "arrow.uturn.backward"
                                )
                            }
                        }
                    } else if isMine || (canManageShifts && assignment.user.isStudentSchedulingClass), let onPostTrade {
                        Button { onPostTrade(shift, assignment) } label: {
                            Label(
                                shift.assignments.count > 1
                                    ? "Post \(assignment.user.name) to Trade Board"
                                    : "Post to Trade Board",
                                systemImage: "arrow.left.arrow.right"
                            )
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
            HStack(spacing: 8) {
                openSlotAvatar
                openSlotView
            }
        } else {
            VStack(alignment: .leading, spacing: 6) {
                ForEach(shift.assignments, id: \.id) { assignment in
                    assignmentRow(assignment)
                }
            }
        }
    }

    @ViewBuilder
    private func assignmentRow(_ assignment: ShiftAssignmentRecord) -> some View {
        let isMe = currentUserId.map { $0 == assignment.user.id } ?? false
        HStack(alignment: .top, spacing: 8) {
            UserAvatarView(name: assignment.user.name, avatarUrl: assignment.user.avatarUrl, size: 28)
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 4) {
                    // Everyone reads at full strength — secondary text made
                    // the rest of the crew look disabled. The "You" chip
                    // already distinguishes the signed-in user.
                    Text(assignment.user.name)
                        .font(.subheadline)
                        .foregroundStyle(.primary)
                    if isMe {
                        Text("You")
                            .font(.caption2.weight(.semibold))
                            .padding(.horizontal, 5)
                            .padding(.vertical, 2)
                            .background(Color.statusBackground(.blue))
                            .foregroundStyle(Color.statusText(.blue))
                            .clipShape(Capsule())
                    }
                    if assignment.status == "REQUESTED" {
                        StatusPill(label: "Pending", tone: .orange)
                    }
                    if assignment.isOnTradeBoard {
                        // On-the-board cue, matching the Schedule legend's
                        // trade iconography.
                        Label("Trade Board", systemImage: "arrow.left.arrow.right")
                            .font(.caption2.weight(.semibold))
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Color.statusBackground(.orange))
                            .foregroundStyle(Color.statusText(.orange))
                            .clipShape(Capsule())
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
                                .frame(minHeight: 44)
                                .tint(Color.statusText(.green))
                                .accessibilityLabel("Approve \(assignment.user.name)")
                        }
                        if let onDecline {
                            Button("Decline \(assignment.user.name)") { onDecline(assignment) }
                                .buttonStyle(.bordered)
                                .controlSize(.small)
                                .frame(minHeight: 44)
                                .tint(Color.statusText(.red))
                                .accessibilityLabel("Decline \(assignment.user.name)")
                        }
                    }
                    .padding(.top, 2)
                }
            }
        }
    }

    /// Dashed placeholder so an open slot's row aligns with the avatars on
    /// filled rows instead of the name/button jumping to the left edge.
    private var openSlotAvatar: some View {
        Circle()
            .strokeBorder(Color.secondary.opacity(0.35), style: StrokeStyle(lineWidth: 1, dash: [3]))
            .frame(width: 28, height: 28)
            .overlay(
                Image(systemName: "person")
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            )
            .accessibilityHidden(true)
    }

    @ViewBuilder
    private var openSlotView: some View {
        // Open slots are where the primary call-to-action lives — surface it as a
        // real tinted button, not accent-colored text, so it reads as tappable and
        // gives a comfortable hit area for both staff (Assign) and students (Claim).
        if canManageShifts, let onAssign {
            Button { onAssign(shift) } label: {
                Label("Assign person", systemImage: "plus.circle.fill")
                    .font(.subheadline.weight(.medium))
            }
            .buttonStyle(.bordered)
            .controlSize(.small)
            .frame(minHeight: 44)
            // Purple, matching Add Shift. Brand red on an additive action read
            // as destructive next to the other add controls.
            .tint(Color.statusText(.purple))
            .accessibilityLabel("Assign \(shift.area.shiftAreaLabel) shift")
        } else if isStudent && isStudentSlot, let onRequest {
            Button { onRequest(shift) } label: {
                Label("Claim shift", systemImage: "hand.raised.fill")
                    .font(.subheadline.weight(.medium))
            }
            .buttonStyle(.bordered)
            .controlSize(.small)
            .frame(minHeight: 44)
            .tint(Color.statusText(.purple))
            .accessibilityLabel("Claim \(shift.area.shiftAreaLabel) shift")
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
    let eventTitle: String
    let onSave: (Date, Date) async -> String?

    @State private var startsAt: Date
    @State private var endsAt: Date
    @State private var isSaving = false
    @State private var saveError: String?
    @State private var showDiscardConfirm = false
    @Environment(\.dismiss) private var dismiss

    init(
        shift: EventShift,
        eventTitle: String,
        onSave: @escaping (Date, Date) async -> String?
    ) {
        self.shift = shift
        self.eventTitle = eventTitle
        self.onSave = onSave
        _startsAt = State(initialValue: shift.startsAt)
        _endsAt = State(initialValue: shift.endsAt)
    }

    private var hasChanges: Bool {
        startsAt != shift.startsAt || endsAt != shift.endsAt
    }

    private var hasValidWindow: Bool {
        endsAt > startsAt
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    contextCard
                    callWindowCard

                    if let saveError {
                        saveErrorCard(message: saveError)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("Edit Call Window")
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
            }
            .safeAreaInset(edge: .bottom) {
                Button {
                    Task { await save() }
                } label: {
                    HStack(spacing: 8) {
                        if isSaving {
                            ProgressView().tint(.white)
                        } else {
                            Image(systemName: "checkmark")
                        }
                        Text("Save Call Window")
                            .fontWeight(.semibold)
                    }
                    .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .tint(Color.statusText(.purple))
                .controlSize(.large)
                .disabled(isSaving || !hasChanges || !hasValidWindow)
                .padding(.horizontal, 16)
                .padding(.vertical, 10)
                .background(.bar)
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
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
    }

    private var contextCard: some View {
        HStack(spacing: 12) {
            RoundedRectangle(cornerRadius: 2, style: .continuous)
                .fill(Color.statusText(.blue))
                .frame(width: 4, height: 58)

            VStack(alignment: .leading, spacing: 4) {
                Text(eventTitle)
                    .font(.headline)
                    .lineLimit(2)
                Text("\(shift.area.shiftAreaLabel) · \(workerClassLabel)")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(16)
        .background(Color.cardSurface, in: RoundedRectangle(cornerRadius: Brand.Radius.lg, style: .continuous))
        .accessibilityElement(children: .combine)
    }

    private var callWindowCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            VStack(alignment: .leading, spacing: 3) {
                Text("Call Window")
                    .font(.headline)
                Text("Applies only to this crew slot")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Divider()
            ShiftDateTimeRow(label: "Call", systemImage: "arrow.right", date: $startsAt)
                .disabled(isSaving)
            Divider()
            ShiftDateTimeRow(label: "End", systemImage: "arrow.left", date: $endsAt)
                .disabled(isSaving)

            if !hasValidWindow {
                Label("End time must be after call time.", systemImage: "exclamationmark.triangle.fill")
                    .font(.caption)
                    .foregroundStyle(Color.statusText(.red))
            } else {
                Text(windowSummary)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(16)
        .background(Color.cardSurface, in: RoundedRectangle(cornerRadius: Brand.Radius.lg, style: .continuous))
    }

    private func saveErrorCard(message: String) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(Color.statusText(.red))
            VStack(alignment: .leading, spacing: 4) {
                Text("Couldn't save call window")
                    .font(.subheadline.weight(.semibold))
                Text(message)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Button("Retry") { Task { await save() } }
                .font(.caption.weight(.semibold))
                .disabled(isSaving || !hasValidWindow)
        }
        .padding(14)
        .background(Color.statusBackground(.red), in: RoundedRectangle(cornerRadius: Brand.Radius.md, style: .continuous))
    }

    private var workerClassLabel: String {
        shift.workerType == "ST" ? "Student shift" : "Staff shift"
    }

    private var windowSummary: String {
        "\(shortDate(startsAt)) · \(startsAt.formatted(date: .omitted, time: .shortened)) to \(endsAt.formatted(date: .omitted, time: .shortened))"
    }

    private func shortDate(_ date: Date) -> String {
        let calendar = Calendar.current
        if calendar.component(.year, from: date) == calendar.component(.year, from: .now) {
            return date.formatted(.dateTime.weekday(.abbreviated).month(.abbreviated).day())
        }
        return date.formatted(.dateTime.weekday(.abbreviated).month(.abbreviated).day().year())
    }

    private func save() async {
        guard !isSaving, hasChanges, hasValidWindow else { return }
        isSaving = true
        saveError = nil
        let error = await onSave(startsAt, endsAt)
        isSaving = false
        if let error {
            saveError = error
        } else {
            dismiss()
        }
    }
}

#Preview {
    Text("Tap an event to see detail")
}
