import SwiftUI

// MARK: - View Model

@MainActor
@Observable
final class ScheduleViewModel {
    var events: [ScheduleEvent] = []
    var myShifts: [MyShift] = []
    var isLoading = false
    var error: String?

    // Keyed by event ID for O(1) lookup
    var shiftsByEventId: [String: MyShift] = [:]

    // Events grouped by calendar day
    var groupedEvents: [(date: Date, events: [ScheduleEvent])] {
        let calendar = Calendar.current
        var byDay: [Date: [ScheduleEvent]] = [:]
        for event in events {
            let day = calendar.startOfDay(for: event.startsAt)
            byDay[day, default: []].append(event)
        }
        return byDay
            .sorted { $0.key < $1.key }
            .map { (date: $0.key, events: $0.value) }
    }

    func load() async {
        guard !isLoading else { return }
        isLoading = true
        error = nil
        do {
            async let eventsTask = APIClient.shared.calendarEvents()
            async let shiftsTask = APIClient.shared.myShifts()
            let (fetchedEvents, fetchedShifts) = try await (eventsTask, shiftsTask)
            events = fetchedEvents
            myShifts = fetchedShifts
            shiftsByEventId = Dictionary(uniqueKeysWithValues: fetchedShifts.map { ($0.event.id, $0) })
        } catch APIError.unauthorized {
            error = "Session expired — please sign in again."
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }
}

// MARK: - Main View

struct ScheduleView: View {
    @State private var vm = ScheduleViewModel()
    @State private var selectedEvent: ScheduleEvent?
    @State private var myShiftsOnly = false

    private var displayedGroups: [(date: Date, events: [ScheduleEvent])] {
        guard myShiftsOnly else { return vm.groupedEvents }
        return vm.groupedEvents.compactMap { group in
            let filtered = group.events.filter { vm.shiftsByEventId[$0.id] != nil }
            return filtered.isEmpty ? nil : (date: group.date, events: filtered)
        }
    }

    var body: some View {
        NavigationStack {
            Group {
                if vm.isLoading && vm.events.isEmpty {
                    List {
                        Section {
                            ForEach(0..<6, id: \.self) { _ in
                                EventRowSkeleton().listRowSeparator(.hidden)
                            }
                        }
                    }
                    .listStyle(.insetGrouped)
                    .allowsHitTesting(false)
                } else if let err = vm.error {
                    ContentUnavailableView {
                        Label("Couldn't load schedule", systemImage: "exclamationmark.triangle")
                    } description: {
                        Text(err)
                    } actions: {
                        Button("Retry") { Task { await vm.load() } }
                    }
                } else if vm.events.isEmpty {
                    ContentUnavailableView(
                        "No upcoming events",
                        systemImage: "calendar",
                        description: Text("Check back later for new events.")
                    )
                } else {
                    eventList
                }
            }
            .navigationTitle("Schedule")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Toggle(isOn: $myShiftsOnly) {
                        Label("My Shifts", systemImage: "person.fill")
                    }
                    .toggleStyle(.button)
                    .tint(.accentColor)
                    .buttonBorderShape(.capsule)
                    .controlSize(.small)
                    .sensoryFeedback(.selection, trigger: myShiftsOnly)
                }
            }
            .task { await vm.load() }
            .refreshable { await vm.load() }
            .sheet(item: $selectedEvent) { event in
                EventDetailSheet(
                    event: event,
                    myShift: vm.shiftsByEventId[event.id]
                )
                .presentationDetents([.large])
                .presentationDragIndicator(.visible)
            }
        }
    }

    private var eventList: some View {
        List {
            ForEach(displayedGroups, id: \.date) { group in
                Section(header: sectionHeader(for: group.date)) {
                    ForEach(group.events) { event in
                        Button {
                            selectedEvent = event
                        } label: {
                            EventRow(
                                event: event,
                                myShift: vm.shiftsByEventId[event.id]
                            )
                        }
                        .buttonStyle(.plain)
                        .listRowInsets(EdgeInsets(top: 10, leading: 16, bottom: 10, trailing: 16))
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
    }

    private func sectionHeader(for date: Date) -> some View {
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: .now)
        let tomorrow = calendar.date(byAdding: .day, value: 1, to: today)!

        let label: String
        if calendar.isDate(date, inSameDayAs: today) {
            label = "Today"
        } else if calendar.isDate(date, inSameDayAs: tomorrow) {
            label = "Tomorrow"
        } else {
            label = date.formatted(.dateTime.weekday(.wide).month(.abbreviated).day())
        }

        return Text(label)
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(.primary)
    }
}

// MARK: - Event Row

struct EventRow: View {
    let event: ScheduleEvent
    let myShift: MyShift?

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            // Title + home/away indicator
            HStack(spacing: 6) {
                if let isHome = event.isHome {
                    Image(systemName: isHome ? "house" : "airplane.departure")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
                Text(event.summary)
                    .font(.body.weight(.medium))
                    .lineLimit(2)
            }

            // Time row
            HStack(spacing: 10) {
                Label(timeLabel, systemImage: "clock")
                    .font(.caption)
                    .foregroundStyle(.secondary)

                if let location = event.location {
                    Label(location.name, systemImage: "mappin")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            }

            // Badges row
            HStack(spacing: 6) {
                if let sport = sportLabel(event.sportCode) {
                    SportBadge(label: sport)
                }
                if let shift = myShift {
                    MyShiftBadge(shift: shift)
                }
            }
        }
    }

    private var timeLabel: String {
        if event.allDay { return "All day" }
        let start = event.startsAt.formatted(.dateTime.hour().minute())
        let end = event.endsAt.formatted(.dateTime.hour().minute())
        return "\(start) – \(end)"
    }
}

// MARK: - Badges

struct SportBadge: View {
    let label: String

    var body: some View {
        Text(label)
            .font(.caption2.weight(.medium))
            .padding(.horizontal, 7)
            .padding(.vertical, 3)
            .background(.tint.opacity(0.12))
            .foregroundStyle(.tint)
            .clipShape(Capsule())
    }
}

struct MyShiftBadge: View {
    let shift: MyShift

    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: "person.fill")
                .font(.system(size: 9))
            Text(shift.area)
                .font(.caption2.weight(.medium))
            if shift.gear.hasGear {
                Image(systemName: gearIcon)
                    .font(.system(size: 9))
                    .foregroundStyle(gearColor)
            }
        }
        .padding(.horizontal, 7)
        .padding(.vertical, 3)
        .background(Color.green.opacity(0.12))
        .foregroundStyle(Color.green)
        .clipShape(Capsule())
    }

    private var gearIcon: String {
        switch shift.gear.status {
        case "checked_out": return "tray.and.arrow.up.fill"
        case "reserved":    return "checkmark.circle.fill"
        default:            return "doc.fill"
        }
    }

    private var gearColor: Color {
        switch shift.gear.status {
        case "checked_out": return .blue
        case "reserved":    return .green
        default:            return .secondary
        }
    }
}

#Preview {
    ScheduleView()
}
