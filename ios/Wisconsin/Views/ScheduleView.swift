import SwiftUI

// MARK: - View Mode

enum ScheduleViewMode: String, CaseIterable {
    case list = "List"
    case calendar = "Calendar"
}

// MARK: - View Model

@MainActor
@Observable
final class ScheduleViewModel {
    var events: [ScheduleEvent] = []
    var myShifts: [MyShift] = []
    var isLoading = false
    var error: String?
    private var hasLoaded = false

    var shiftsByEventId: [String: MyShift] = [:]

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

    var eventsByDay: [Date: [ScheduleEvent]] {
        let calendar = Calendar.current
        var dict: [Date: [ScheduleEvent]] = [:]
        for event in events {
            let day = calendar.startOfDay(for: event.startsAt)
            dict[day, default: []].append(event)
        }
        return dict
    }

    func load(forceRefresh: Bool = false) async {
        guard !isLoading else { return }
        guard !hasLoaded || forceRefresh else { return }
        isLoading = true
        error = nil
        do {
            async let eventsTask = APIClient.shared.calendarEvents()
            async let shiftsTask = APIClient.shared.myShifts()
            let (fetchedEvents, fetchedShifts) = try await (eventsTask, shiftsTask)
            events = fetchedEvents
            myShifts = fetchedShifts
            shiftsByEventId = Dictionary(uniqueKeysWithValues: fetchedShifts.map { ($0.event.id, $0) })
            hasLoaded = true
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
    @State private var viewMode: ScheduleViewMode = .list
    @State private var calendarSelectedDate: Date = .now

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
                    switch viewMode {
                    case .list:
                        eventList
                    case .calendar:
                        ScheduleCalendarView(
                            selectedDate: $calendarSelectedDate,
                            eventsByDay: vm.eventsByDay,
                            myShiftsOnly: myShiftsOnly,
                            shiftsByEventId: vm.shiftsByEventId,
                            onSelectEvent: { selectedEvent = $0 }
                        )
                    }
                }
            }
            .navigationTitle("Schedule")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Picker("View", selection: $viewMode) {
                        ForEach(ScheduleViewMode.allCases, id: \.self) { mode in
                            Text(mode.rawValue).tag(mode)
                        }
                    }
                    .pickerStyle(.segmented)
                    .frame(width: 150)
                }
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
            .refreshable { await vm.load(forceRefresh: true) }
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

// MARK: - Calendar View

struct ScheduleCalendarView: View {
    @Binding var selectedDate: Date
    let eventsByDay: [Date: [ScheduleEvent]]
    let myShiftsOnly: Bool
    let shiftsByEventId: [String: MyShift]
    let onSelectEvent: (ScheduleEvent) -> Void

    @State private var displayedMonth: Date = {
        let c = Calendar.current
        return c.date(from: c.dateComponents([.year, .month], from: .now)) ?? .now
    }()

    private let calendar = Calendar.current
    private let columns = Array(repeating: GridItem(.flexible(), spacing: 0), count: 7)
    private let weekdayLabels = ["S", "M", "T", "W", "T", "F", "S"]

    private var selectedDayEvents: [ScheduleEvent] {
        let day = calendar.startOfDay(for: selectedDate)
        let all = eventsByDay[day] ?? []
        if myShiftsOnly { return all.filter { shiftsByEventId[$0.id] != nil } }
        return all
    }

    var body: some View {
        VStack(spacing: 0) {
            monthHeader
                .padding(.horizontal)
                .padding(.vertical, 10)

            HStack(spacing: 0) {
                ForEach(weekdayLabels, id: \.self) { label in
                    Text(label)
                        .font(.caption2.weight(.medium))
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity)
                }
            }
            .padding(.horizontal, 4)
            .padding(.bottom, 4)

            LazyVGrid(columns: columns, spacing: 2) {
                ForEach(Array(daysInMonth().enumerated()), id: \.offset) { _, day in
                    if let day {
                        let dots = dotInfo(for: day)
                        DayCell(
                            date: day,
                            isToday: calendar.isDateInToday(day),
                            isSelected: calendar.isDate(day, inSameDayAs: selectedDate),
                            dots: dots
                        )
                        .onTapGesture {
                            withAnimation(.easeInOut(duration: 0.15)) {
                                selectedDate = day
                            }
                        }
                    } else {
                        Color.clear.frame(height: 48)
                    }
                }
            }
            .padding(.horizontal, 4)
            .padding(.bottom, 8)

            Divider()

            dayEventList
        }
    }

    // MARK: Month header

    private var monthHeader: some View {
        HStack {
            Button {
                withAnimation(.easeInOut(duration: 0.2)) {
                    displayedMonth = calendar.date(byAdding: .month, value: -1, to: displayedMonth) ?? displayedMonth
                }
            } label: {
                Image(systemName: "chevron.left")
                    .font(.body.weight(.semibold))
                    .frame(width: 36, height: 36)
                    .background(.quaternary, in: Circle())
            }

            Spacer()

            Text(displayedMonth.formatted(.dateTime.month(.wide).year()))
                .font(.headline)

            Spacer()

            Button {
                withAnimation(.easeInOut(duration: 0.2)) {
                    displayedMonth = calendar.date(byAdding: .month, value: 1, to: displayedMonth) ?? displayedMonth
                }
            } label: {
                Image(systemName: "chevron.right")
                    .font(.body.weight(.semibold))
                    .frame(width: 36, height: 36)
                    .background(.quaternary, in: Circle())
            }
        }
    }

    // MARK: Day event list

    @ViewBuilder
    private var dayEventList: some View {
        if selectedDayEvents.isEmpty {
            VStack {
                Spacer()
                Text("No events on \(selectedDate.formatted(.dateTime.month(.abbreviated).day()))")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                Spacer()
            }
            .frame(maxWidth: .infinity)
        } else {
            List {
                ForEach(selectedDayEvents) { event in
                    Button { onSelectEvent(event) } label: {
                        EventRow(event: event, myShift: shiftsByEventId[event.id])
                    }
                    .buttonStyle(.plain)
                    .listRowInsets(EdgeInsets(top: 10, leading: 16, bottom: 10, trailing: 16))
                }
            }
            .listStyle(.plain)
        }
    }

    // MARK: Helpers

    private func daysInMonth() -> [Date?] {
        guard let range = calendar.range(of: .day, in: .month, for: displayedMonth),
              let firstDay = calendar.date(from: calendar.dateComponents([.year, .month], from: displayedMonth))
        else { return [] }
        let offset = calendar.component(.weekday, from: firstDay) - 1
        let empties: [Date?] = Array(repeating: nil, count: offset)
        let days: [Date?] = range.compactMap { calendar.date(byAdding: .day, value: $0 - 1, to: firstDay) }
        return empties + days
    }

    // Returns up to 3 dot descriptors for a given day.
    // Dot color encodes home (green) / away (orange) / neutral (secondary).
    // My-shift events get an accent-colored dot regardless of home/away.
    private func dotInfo(for date: Date) -> [DotInfo] {
        let events = eventsByDay[date] ?? []
        let visible = myShiftsOnly ? events.filter { shiftsByEventId[$0.id] != nil } : events
        return visible.prefix(3).map { event in
            let isShift = shiftsByEventId[event.id] != nil
            let color: Color
            if isShift {
                color = .accentColor
            } else {
                switch event.isHome {
                case true:  color = .green
                case false: color = .orange
                default:    color = Color(.systemGray3)
                }
            }
            return DotInfo(color: color, isShift: isShift)
        }
    }
}

struct DotInfo {
    let color: Color
    let isShift: Bool
}

// MARK: - Day Cell

private struct DayCell: View {
    let date: Date
    let isToday: Bool
    let isSelected: Bool
    let dots: [DotInfo]

    var body: some View {
        VStack(spacing: 4) {
            ZStack {
                if isSelected {
                    Circle()
                        .fill(isToday ? Color.accentColor : Color.accentColor.opacity(0.18))
                        .frame(width: 34, height: 34)
                } else if isToday {
                    Circle()
                        .strokeBorder(Color.accentColor, lineWidth: 1.5)
                        .frame(width: 34, height: 34)
                }
                Text(date.formatted(.dateTime.day()))
                    .font(.subheadline)
                    .fontWeight(isToday ? .semibold : .regular)
                    .foregroundStyle(
                        isSelected && isToday ? .white :
                        isSelected ? Color.accentColor :
                        isToday ? Color.accentColor : .primary
                    )
            }
            .frame(width: 34, height: 34)

            // Dots row — always reserve space so grid rows stay even
            HStack(spacing: 3) {
                ForEach(dots.indices, id: \.self) { i in
                    Circle()
                        .fill(dots[i].color)
                        .frame(width: 5, height: 5)
                }
            }
            .frame(height: 5)
        }
        .frame(height: 52)
        .contentShape(Rectangle())
    }
}

// MARK: - Event Row

struct EventRow: View {
    let event: ScheduleEvent
    let myShift: MyShift?

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
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
