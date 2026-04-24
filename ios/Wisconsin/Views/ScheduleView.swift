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
        // Seed from cache for instant display before the network response arrives
        if !hasLoaded {
            let cached = GearStore.shared.cachedScheduleEvents()
            if !cached.isEmpty { events = cached.map(\.asScheduleEvent) }
        }
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
            GearStore.shared.seedScheduleEvents(fetchedEvents)
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
    @State private var showTradeBoard = false
    @Environment(SessionStore.self) private var session
    @Environment(AppState.self) private var appState

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
                        ForEach(0..<6, id: \.self) { _ in
                            EventRowSkeleton()
                                .listRowSeparator(.hidden)
                                .listRowInsets(EdgeInsets(top: 5, leading: 16, bottom: 5, trailing: 16))
                        }
                    }
                    .listStyle(.plain)
                    .scrollContentBackground(.hidden)
                    .background(Color(.systemGroupedBackground))
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
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showTradeBoard = true
                    } label: {
                        ZStack(alignment: .topTrailing) {
                            Image(systemName: "arrow.triangle.2.circlepath")
                            if appState.openTradeCount > 0 {
                                Text("\(min(appState.openTradeCount, 9))")
                                    .font(.system(size: 9, weight: .bold))
                                    .foregroundStyle(.white)
                                    .frame(width: 14, height: 14)
                                    .background(Color.accentColor, in: Circle())
                                    .offset(x: 8, y: -8)
                            }
                        }
                    }
                    .accessibilityLabel("Trade Board")
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
            .sheet(isPresented: $showTradeBoard, onDismiss: {
                Task { await appState.refresh() }
            }) {
                TradeBoardSheet(
                    myShifts: vm.myShifts,
                    currentUserId: session.currentUser?.id ?? ""
                )
            }
        }
    }

    private var eventList: some View {
        List {
            ForEach(displayedGroups, id: \.date) { group in
                Section {
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
                        .listRowInsets(EdgeInsets(top: 5, leading: 16, bottom: 5, trailing: 16))
                        .listRowSeparator(.hidden)
                    }
                } header: {
                    ScheduleDateHeader(date: group.date)
                        .listRowInsets(EdgeInsets(top: 0, leading: 0, bottom: 0, trailing: 0))
                }
                .listSectionSeparator(.hidden)
            }
        }
        .listStyle(.plain)
        .scrollContentBackground(.hidden)
        .background(Color(.systemGroupedBackground))
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
                    .frame(width: 44, height: 44)
                    .background(.quaternary, in: Circle())
                    .contentShape(Circle())
            }
            .buttonStyle(ScalePressStyle())

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
                    .frame(width: 44, height: 44)
                    .background(.quaternary, in: Circle())
                    .contentShape(Circle())
            }
            .buttonStyle(ScalePressStyle())
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
                    .listRowInsets(EdgeInsets(top: 5, leading: 16, bottom: 5, trailing: 16))
                    .listRowSeparator(.hidden)
                }
            }
            .listStyle(.plain)
            .scrollContentBackground(.hidden)
            .background(Color(.systemGroupedBackground))
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

// MARK: - Date Header

private struct ScheduleDateHeader: View {
    let date: Date

    private var cal: Calendar { .current }
    private var isToday: Bool { cal.isDateInToday(date) }
    private var isTomorrow: Bool { cal.isDateInTomorrow(date) }

    var body: some View {
        HStack(alignment: .center, spacing: 10) {
            VStack(alignment: .center, spacing: 0) {
                Text(date.formatted(.dateTime.weekday(.abbreviated)).uppercased())
                    .font(.system(size: 9, weight: .bold))
                    .kerning(0.5)
                    .foregroundStyle(isToday ? Color.accentColor : .secondary)
                Text(date.formatted(.dateTime.day()))
                    .font(.system(size: 24, weight: .black))
                    .monospacedDigit()
                    .fixedSize()
                    .foregroundStyle(isToday ? Color.accentColor : .primary)
            }
            .frame(width: 36)

            VStack(alignment: .leading, spacing: 0) {
                Text(
                    isToday ? "Today" :
                    isTomorrow ? "Tomorrow" :
                    date.formatted(.dateTime.month(.wide).year())
                )
                .font(.caption.weight(.medium))
                .foregroundStyle(isToday ? Color.accentColor.opacity(0.8) : .secondary)
            }

            Spacer()
        }
        .padding(.horizontal, 16)
        .padding(.top, 14)
        .padding(.bottom, 4)
        .background(Color(.systemGroupedBackground))
    }
}

// MARK: - Event Row

struct EventRow: View {
    let event: ScheduleEvent
    let myShift: MyShift?

    var body: some View {
        HStack(spacing: 0) {
            Rectangle()
                .fill(barColor)
                .frame(width: 3)

            VStack(alignment: .leading, spacing: 5) {
                // Title row
                HStack(alignment: .firstTextBaseline, spacing: 6) {
                    Text(event.summary)
                        .font(.subheadline.weight(.semibold))
                        .lineLimit(2)
                        .fixedSize(horizontal: false, vertical: true)
                    Spacer(minLength: 0)
                    if myShift != nil {
                        Text("My Shift")
                            .font(.system(size: 9, weight: .semibold))
                            .foregroundStyle(Color.accentColor)
                            .kerning(0.3)
                    }
                }

                // Time row
                HStack(spacing: 8) {
                    if let isHome = event.isHome {
                        Text(isHome ? "Home" : "Away")
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundStyle(isHome ? Color.green : Color.orange)
                    }

                    if let shift = myShift {
                        HStack(spacing: 10) {
                            TimeBlock(label: "CALL", time: shift.startsAt)
                            TimeBlock(label: "EVENT", time: event.startsAt)
                            TimeBlock(label: "END", time: shift.endsAt)
                        }
                    } else if !event.allDay {
                        Text(eventTimeLabel)
                            .font(.caption.monospacedDigit())
                            .foregroundStyle(.secondary)
                    } else if event.allDay {
                        Text("All day")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }

                if let location = event.location {
                    Label(location.name, systemImage: "mappin")
                        .font(.caption)
                        .foregroundStyle(.tertiary)
                        .lineLimit(1)
                }
            }
            .padding(.leading, 12)
            .padding(.vertical, 10)
            .padding(.trailing, 12)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(.background)
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .shadow(color: .black.opacity(0.04), radius: 1, y: 1)
        .shadow(color: .black.opacity(0.06), radius: 6, y: 3)
    }

    private var barColor: Color {
        if myShift != nil { return .accentColor }
        switch event.isHome {
        case true:  return .green
        case false: return .orange
        default:    return Color(.systemGray4)
        }
    }

    private var eventTimeLabel: String {
        if event.allDay { return "All day" }
        let start = event.startsAt.formatted(.dateTime.hour().minute())
        let end = event.endsAt.formatted(.dateTime.hour().minute())
        return "\(start) – \(end)"
    }
}

private struct TimeBlock: View {
    let label: String
    let time: Date

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label)
                .font(.system(size: 8, weight: .semibold))
                .foregroundStyle(.tertiary)
                .kerning(0.4)
            Text(time.formatted(.dateTime.hour().minute()))
                .font(.caption.weight(.medium).monospacedDigit())
                .foregroundStyle(.primary)
        }
    }
}


#Preview {
    ScheduleView()
}
