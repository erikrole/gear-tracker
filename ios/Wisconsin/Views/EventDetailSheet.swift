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

    // Shifts grouped by area, sorted area name → workerType → call time
    var shiftsByArea: [(area: String, shifts: [EventShift])] {
        guard let group = shiftGroup else { return [] }
        var byArea: [String: [EventShift]] = [:]
        for shift in group.shifts {
            byArea[shift.area, default: []].append(shift)
        }
        return byArea
            .sorted { $0.key < $1.key }
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
    @State private var prepGearOpen = false

    init(event: ScheduleEvent, myShift: MyShift?) {
        self.event = event
        self.myShift = myShift
        _vm = State(initialValue: EventDetailViewModel(event: event, myShift: myShift))
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
            .sheet(isPresented: $prepGearOpen) {
                CreateBookingSheet(vm: makePrepGearVM()) { _ in }
            }
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
                    Label(isHome ? "Home" : "Away", systemImage: isHome ? "house" : "airplane.departure")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                if vm.shiftGroup?.isPremier == true {
                    Label("Premier", systemImage: "star.fill")
                        .font(.caption)
                        .foregroundStyle(.yellow)
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
            VStack(spacing: 6) {
                Image(systemName: "person.2.slash")
                    .font(.largeTitle)
                    .foregroundStyle(.tertiary)
                Text("No crew scheduled")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
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
                    currentUserId: session.currentUser?.id
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
                        currentUserId: currentUserId
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
                .frame(width: 50)

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
    }

    @ViewBuilder
    private var assignedPersonView: some View {
        if shift.isOpen {
            Text("Open")
                .font(.subheadline)
                .foregroundStyle(.tertiary)
                .italic()
        } else {
            VStack(alignment: .leading, spacing: 1) {
                ForEach(shift.assignments, id: \.id) { assignment in
                    let isMe = currentUserId.map { $0 == assignment.user.id } ?? false
                    HStack(spacing: 4) {
                        Text(assignment.user.name)
                            .font(.subheadline)
                            .foregroundStyle(isMe ? Color.primary : Color.secondary)
                        if isMe {
                            Image(systemName: "person.fill")
                                .font(.caption2)
                                .foregroundStyle(Color.accentColor)
                        }
                    }
                }
            }
        }
    }

    private var workerTypeLabel: String {
        switch shift.workerType {
        case "STUDENT": return "Student"
        case "STAFF":   return "Staff"
        default:        return shift.workerType
        }
    }

    private var workerTypeColor: Color {
        shift.workerType == "STAFF" ? .orange : .blue
    }
}

#Preview {
    Text("Tap an event to see detail")
}
