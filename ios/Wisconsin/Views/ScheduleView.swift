import SwiftUI

// MARK: - View Mode

enum ScheduleViewMode: String, CaseIterable {
    case list = "List"
    case calendar = "Calendar"
}

/// Lightweight transient banner state. Auto-clears after 2.5s.
struct ScheduleToast: Equatable {
    let message: String
    let icon: String
}

// MARK: - View Model

enum MyShiftStatus: String {
    case active = "ACTIVE"
    case cancelled = "CANCELLED"
    case completed = "COMPLETED"
    case unknown
}

extension MyShift {
    var statusValue: MyShiftStatus {
        MyShiftStatus(rawValue: status) ?? .unknown
    }
}

/// Considered fresh while younger than this; older triggers a background refresh.
private let scheduleStaleAfter: TimeInterval = 5 * 60 // 5 minutes

@MainActor
@Observable
final class ScheduleViewModel {
    var events: [ScheduleEvent] = []
    var myShifts: [MyShift] = []
    var isLoading = false
    var error: String?
    var refreshError: String?
    private var hasLoaded = false

    var shiftsByEventId: [String: MyShift] = [:]

    var isStale: Bool {
        return true
    }

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
        // Allow first load, explicit refresh, or staleness-driven refresh.
        guard !hasLoaded || forceRefresh || isStale else { return }
        isLoading = true
        if events.isEmpty { error = nil }
        refreshError = nil
        do {
            async let eventsTask = APIClient.shared.calendarEvents()
            async let shiftsTask = APIClient.shared.myShifts()
            let (fetchedEvents, fetchedShifts) = try await (eventsTask, shiftsTask)
            events = fetchedEvents
            myShifts = fetchedShifts
            shiftsByEventId = Dictionary(uniqueKeysWithValues: fetchedShifts.map { ($0.event.id, $0) })
            hasLoaded = true
            error = nil
            GearStore.shared.seedScheduleEvents(fetchedEvents)
        } catch APIError.unauthorized {
            // SessionStore listens for the global notification and routes the
            // user to login; nothing to do here besides cleaning up loading state.
            isLoading = false
            return
        } catch {
            // Refresh failure must not blank an already-populated screen.
            if events.isEmpty {
                self.error = error.localizedDescription
            } else {
                self.refreshError = error.localizedDescription
            }
        }
        isLoading = false
    }
}

// MARK: - HomeAwayFilter

enum HomeAwayFilter: String, CaseIterable {
    case all = "All"
    case home = "Home"
    case away = "Away"
}

// MARK: - Main View

struct ScheduleView: View {
    @State private var vm = ScheduleViewModel()
    @State private var selectedEvent: ScheduleEvent?
    @State private var myShiftsOnly = false
    @State private var homeAwayFilter: HomeAwayFilter = .all
    @State private var viewMode: ScheduleViewMode = .list
    @State private var calendarSelectedDate: Date = .now
    @State private var showTradeBoard = false
    @State private var toast: ScheduleToast?
    @Environment(SessionStore.self) private var session
    @Environment(AppState.self) private var appState
    @Environment(\.scenePhase) private var scenePhase

    private var displayedGroups: [(date: Date, events: [ScheduleEvent])] {
        vm.groupedEvents.compactMap { group in
            var filtered = group.events
            if myShiftsOnly { filtered = filtered.filter { vm.shiftsByEventId[$0.id] != nil } }
            switch homeAwayFilter {
            case .home: filtered = filtered.filter { $0.isHome == true }
            case .away: filtered = filtered.filter { $0.isHome == false }
            case .all: break
            }
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
                } else if vm.events.isEmpty, let err = vm.error {
                    // Only blank the screen when we have nothing to show.
                    ContentUnavailableView {
                        Label("Couldn't load schedule", systemImage: "exclamationmark.triangle")
                    } description: {
                        Text(err)
                    } actions: {
                        Button("Retry") { Task { await vm.load(forceRefresh: true) } }
                            .buttonStyle(.borderedProminent)
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
            .overlay(alignment: .top) {
                // Non-blocking refresh-failed banner — lets the user keep using stale data.
                if !vm.events.isEmpty, let refreshError = vm.refreshError {
                    HStack(spacing: 8) {
                        Image(systemName: "wifi.exclamationmark")
                        Text(refreshError)
                            .font(.footnote)
                            .lineLimit(2)
                        Spacer(minLength: 8)
                        Button("Retry") { Task { await vm.load(forceRefresh: true) } }
                            .font(.footnote.weight(.semibold))
                    }
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 12))
                    .padding(.horizontal, 12)
                    .padding(.top, 4)
                    .shadow(color: Color.primary.opacity(0.08), radius: 8, y: 2)
                    .transition(.move(edge: .top).combined(with: .opacity))
                }
            }
            .overlay(alignment: .bottom) {
                if let toast {
                    HStack(spacing: 10) {
                        Image(systemName: toast.icon)
                            .foregroundStyle(Color.accentColor)
                        Text(toast.message)
                            .font(.subheadline.weight(.medium))
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 12)
                    .background(.regularMaterial, in: Capsule())
                    .shadow(color: Color.primary.opacity(0.12), radius: 10, y: 4)
                    .padding(.bottom, 24)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                }
            }
            .animation(.spring(duration: 0.3), value: toast)
            .animation(.easeInOut(duration: 0.2), value: vm.refreshError)
            .navigationTitle("Schedule")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Picker("View", selection: $viewMode) {
                        Image(systemName: "list.bullet").tag(ScheduleViewMode.list)
                        Image(systemName: "calendar").tag(ScheduleViewMode.calendar)
                    }
                    .pickerStyle(.segmented)
                    .frame(width: 96)
                    .accessibilityLabel("Schedule view")
                }
                ToolbarItemGroup(placement: .topBarTrailing) {
                    Button {
                        myShiftsOnly.toggle()
                    } label: {
                        Image(systemName: myShiftsOnly ? "person.fill" : "person")
                            .foregroundStyle(myShiftsOnly ? Color.accentColor : .primary)
                            .frame(minWidth: 44, minHeight: 44)
                    }
                    .accessibilityLabel(myShiftsOnly ? "Showing my shifts only" : "Show my shifts only")
                    .sensoryFeedback(.selection, trigger: myShiftsOnly)

                    Button {
                        showTradeBoard = true
                    } label: {
                        HStack(spacing: 4) {
                            Image(systemName: "arrow.triangle.2.circlepath")
                            if appState.openTradeCount > 0 {
                                Text("\(appState.openTradeCount)")
                                    .font(.caption2.weight(.semibold).monospacedDigit())
                                    .padding(.horizontal, 5)
                                    .padding(.vertical, 1)
                                    .background(Color.accentColor, in: Capsule())
                                    .foregroundStyle(.white)
                            }
                        }
                        .frame(minHeight: 44)
                    }
                    .accessibilityLabel(appState.openTradeCount > 0
                        ? "Trade Board, \(appState.openTradeCount) open"
                        : "Trade Board")
                }
            }
            .task { await vm.load() }
            .refreshable { await vm.load(forceRefresh: true) }
            .onChange(of: scenePhase) { _, phase in
                if phase == .active {
                    Task { await vm.load() }
                }
            }
            .onChange(of: toast) { _, newToast in
                guard newToast != nil else { return }
                Task {
                    try? await Task.sleep(for: .seconds(2.5))
                    if toast == newToast { toast = nil }
                }
            }
            .sheet(item: $selectedEvent) { event in
                EventDetailSheet(
                    event: event,
                    myShift: vm.shiftsByEventId[event.id]
                )
                .presentationDetents([.medium, .large])
                .presentationDragIndicator(.visible)
            }
            .sheet(isPresented: $showTradeBoard, onDismiss: {
                Task { await appState.refresh() }
            }) {
                TradeBoardSheet(
                    myShifts: vm.myShifts,
                    currentUserId: session.currentUser?.id ?? "",
                    onTradePosted: { area in
                        toast = ScheduleToast(message: "Posted \(area) shift to the trade board", icon: "checkmark.circle.fill")
                    },
                    onTradeClaimed: { area, when in
                        toast = ScheduleToast(message: "You picked up \(area) on \(when)", icon: "hand.thumbsup.fill")
                    }
                )
            }
        }
    }

    @ViewBuilder
    private var eventList: some View {
        if displayedGroups.isEmpty && myShiftsOnly {
            ContentUnavailableView(
                "No shifts assigned to you",
                systemImage: "person",
                description: Text("Your schedule will show up here when staff confirm.")
            )
        } else {
            List {
                Section {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            ForEach(HomeAwayFilter.allCases, id: \.self) { filter in
                                Button {
                                    homeAwayFilter = filter
                                } label: {
                                    Text(filter.rawValue)
                                        .font(.caption.weight(.semibold))
                                        .padding(.horizontal, 10)
                                        .padding(.vertical, 5)
                                        .background(
                                            homeAwayFilter == filter
                                                ? Color.accentColor
                                                : Color(.tertiarySystemFill),
                                            in: Capsule()
                                        )
                                        .foregroundStyle(
                                            homeAwayFilter == filter ? AnyShapeStyle(.white) : AnyShapeStyle(.secondary)
                                        )
                                }
                                .buttonStyle(.plain)
                                .sensoryFeedback(.selection, trigger: homeAwayFilter)
                            }
                        }
                        .padding(.horizontal, 2)
                        .padding(.vertical, 2)
                    }
                }
                .listRowSeparator(.hidden)
                .listRowBackground(Color.clear)
                .listRowInsets(EdgeInsets(top: 4, leading: 14, bottom: 0, trailing: 14))
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
                        ScheduleDateHeader(date: group.date, eventCount: group.events.count)
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
                // Use a single weekday letter but disambiguated by position via accessibility.
                ForEach(Array(weekdayLabels.enumerated()), id: \.offset) { idx, label in
                    Text(label)
                        .font(.caption2.weight(.medium))
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity)
                        .accessibilityLabel(weekdayFullNames[idx])
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
                                // Also follow selection across months.
                                displayedMonth = calendar.date(from: calendar.dateComponents([.year, .month], from: day)) ?? displayedMonth
                            }
                        }
                    } else {
                        Color.clear.frame(height: 48)
                    }
                }
            }
            .padding(.horizontal, 4)
            .padding(.bottom, 8)
            .gesture(
                DragGesture(minimumDistance: 24)
                    .onEnded { value in
                        let dx = value.translation.width
                        guard abs(dx) > 50 else { return }
                        changeMonth(by: dx > 0 ? -1 : 1)
                    }
            )

            dotLegend
                .padding(.horizontal, 16)
                .padding(.bottom, 6)

            Divider()

            dayEventList
        }
    }

    private var weekdayFullNames: [String] {
        ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
    }

    private var dotLegend: some View {
        HStack(spacing: 12) {
            LegendDot(color: .accentColor, label: "My Shift")
            LegendDot(color: .green, label: "Home")
            LegendDot(color: .orange, label: "Away")
        }
        .frame(maxWidth: .infinity, alignment: .center)
    }

    private func changeMonth(by delta: Int) {
        withAnimation(.easeInOut(duration: 0.2)) {
            let next = calendar.date(byAdding: .month, value: delta, to: displayedMonth) ?? displayedMonth
            displayedMonth = next
            // Move selection along — keep the same day-of-month if valid, else clamp to first.
            let dayComponent = calendar.component(.day, from: selectedDate)
            let yearMonth = calendar.dateComponents([.year, .month], from: next)
            var components = yearMonth
            components.day = dayComponent
            if let candidate = calendar.date(from: components),
               calendar.component(.month, from: candidate) == yearMonth.month {
                selectedDate = candidate
            } else if let firstOfMonth = calendar.date(from: yearMonth) {
                selectedDate = firstOfMonth
            }
        }
    }

    private func goToToday() {
        let today = Date()
        withAnimation(.easeInOut(duration: 0.25)) {
            selectedDate = today
            displayedMonth = calendar.date(from: calendar.dateComponents([.year, .month], from: today)) ?? today
        }
    }

    // MARK: Month header

    private var monthHeader: some View {
        HStack {
            Button { changeMonth(by: -1) } label: {
                Image(systemName: "chevron.left")
                    .font(.body.weight(.semibold))
                    .frame(width: 44, height: 44)
                    .background(.quaternary, in: Circle())
                    .contentShape(Circle())
            }
            .buttonStyle(ScalePressStyle())
            .accessibilityLabel("Previous month")

            Spacer()

            VStack(spacing: 2) {
                Text(displayedMonth.formatted(.dateTime.month(.wide).year()))
                    .font(.headline)
                if !calendar.isDate(displayedMonth, equalTo: Date(), toGranularity: .month) {
                    Button("Today") { goToToday() }
                        .font(.caption.weight(.medium))
                        .foregroundStyle(Color.accentColor)
                        .buttonStyle(.plain)
                }
            }

            Spacer()

            Button { changeMonth(by: 1) } label: {
                Image(systemName: "chevron.right")
                    .font(.body.weight(.semibold))
                    .frame(width: 44, height: 44)
                    .background(.quaternary, in: Circle())
                    .contentShape(Circle())
            }
            .buttonStyle(ScalePressStyle())
            .accessibilityLabel("Next month")
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

private struct LegendDot: View {
    let color: Color
    let label: String

    var body: some View {
        HStack(spacing: 4) {
            Circle()
                .fill(color)
                .frame(width: 6, height: 6)
            Text(label)
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
    }
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
    let eventCount: Int

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

            if eventCount > 1 {
                Text("\(eventCount) events")
                    .font(.system(.caption2, design: .monospaced))
                    .foregroundStyle(.tertiary)
                    .padding(.trailing, 16)
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

    private var eventDisplayTitle: String {
        var parts: [String] = []
        if let code = event.sportCode {
            parts.append(scheduleSportLabel(code))
        }
        if let opponent = event.opponent, !opponent.isEmpty {
            switch event.isHome {
            case true:  parts.append("vs"); parts.append(opponent)
            case false: parts.append("at"); parts.append(opponent)
            case nil:   parts.append(opponent)
            }
        }
        let title = parts.isEmpty ? event.summary : parts.joined(separator: " ")
        return title.components(separatedBy: .whitespaces)
            .filter { !$0.isEmpty }
            .joined(separator: " ")
    }

    var body: some View {
        HStack(spacing: 0) {
            Rectangle()
                .fill(barColor)
                .frame(width: 3)

            VStack(alignment: .leading, spacing: 5) {
                // Title row
                HStack(alignment: .firstTextBaseline, spacing: 6) {
                    Text(eventDisplayTitle)
                        .font(.subheadline.weight(.semibold))
                        .lineLimit(2)
                        .fixedSize(horizontal: false, vertical: true)
                    Spacer(minLength: 0)
                    if myShift != nil {
                        Text("My Shift")
                            .font(.system(size: 9, weight: .bold))
                            .tracking(0.4)
                            .padding(.horizontal, 5)
                            .padding(.vertical, 2)
                            .background(Color.accentColor.opacity(0.12), in: Capsule())
                            .foregroundStyle(Color.accentColor)
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
                            // Hide redundant CALL when call time == event start.
                            if !calendarSame(shift.startsAt, event.startsAt) {
                                TimeBlock(label: "CALL", time: shift.startsAt)
                            }
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
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .strokeBorder(Color(.separator).opacity(0.5), lineWidth: 0.5)
        )
        .shadow(color: Color.primary.opacity(0.05), radius: 4, y: 2)
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


private func calendarSame(_ a: Date, _ b: Date) -> Bool {
    abs(a.timeIntervalSince(b)) < 60
}

// MARK: - Sport labels (mirrors src/lib/sports.ts)

private func scheduleSportLabel(_ code: String) -> String {
    let labels: [String: String] = [
        "MBB": "Men's Basketball", "MXC": "Men's Cross Country", "FB": "Football",
        "MGOLF": "Men's Golf", "MHKY": "Men's Hockey", "MROW": "Men's Rowing",
        "MSOC": "Men's Soccer", "MSWIM": "Men's Swimming & Diving", "MTEN": "Men's Tennis",
        "MTRACK": "Men's Track & Field", "WRES": "Wrestling",
        "WBB": "Women's Basketball", "WXC": "Women's Cross Country", "WGOLF": "Women's Golf",
        "WHKY": "Women's Hockey", "LROW": "Lightweight Rowing", "WROW": "Women's Rowing",
        "WSOC": "Women's Soccer", "SB": "Softball", "WSWIM": "Women's Swimming & Diving",
        "WTEN": "Women's Tennis", "WTRACK": "Women's Track & Field", "VB": "Volleyball",
        // Legacy codes
        "SWIM": "Swimming & Diving", "TF": "Track & Field", "XC": "Cross Country",
        "GOLF": "Golf", "ROW": "Rowing", "TEN": "Tennis", "GYM": "Gymnastics", "BASE": "Baseball",
    ]
    return labels[code] ?? code
}

#Preview {
    ScheduleView()
}
