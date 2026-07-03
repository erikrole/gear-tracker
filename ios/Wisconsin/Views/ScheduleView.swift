import SwiftUI
import UIKit

// MARK: - View Mode

enum ScheduleViewMode: String, CaseIterable, Hashable {
    case list = "List"
    case calendar = "Calendar"
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
    /// When true, the load also pulls events whose end time is in the past —
    /// matches the "Past" toggle the web schedule's list view exposes.
    var includePast = false
    private var hasLoaded = false

    var shiftsByEventId: [String: MyShift] = [:]
    var lastLoadedAt: Date?

    var isStale: Bool {
        guard let t = lastLoadedAt else { return true }
        return Date.now.timeIntervalSince(t) > scheduleStaleAfter
    }

    /// Lower bound for expanding multi-day events: when "Past" is off we don't
    /// want a long-running event to spawn day groups before today.
    private var spanLowerBound: Date {
        includePast ? .distantPast : Calendar.current.startOfDay(for: .now)
    }

    var groupedEvents: [(date: Date, events: [ScheduleEvent])] {
        var byDay: [Date: [ScheduleEvent]] = [:]
        let lowerBound = spanLowerBound
        for event in events {
            // A multi-day event appears under each calendar day it covers, so
            // it stays visible while it's still in progress.
            for day in event.spannedDays where day >= lowerBound {
                byDay[day, default: []].append(event)
            }
        }
        return byDay
            .sorted { $0.key < $1.key }
            .map { (date: $0.key, events: $0.value.sorted { $0.startsAt < $1.startsAt }) }
    }

    var eventsByDay: [Date: [ScheduleEvent]] {
        var dict: [Date: [ScheduleEvent]] = [:]
        for event in events {
            for day in event.spannedDays {
                dict[day, default: []].append(event)
            }
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
            async let eventsTask = APIClient.shared.calendarEvents(includePast: includePast)
            async let shiftsTask = APIClient.shared.myShifts()
            let (fetchedEvents, fetchedShifts) = try await (eventsTask, shiftsTask)
            events = fetchedEvents
            myShifts = fetchedShifts
            shiftsByEventId = Dictionary(uniqueKeysWithValues: fetchedShifts.map { ($0.event.id, $0) })
            hasLoaded = true
            lastLoadedAt = .now
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
    case neutral = "Neutral"
}

// MARK: - Main View

struct ScheduleView: View {
    @State private var vm = ScheduleViewModel()
    @State private var selectedEvent: ScheduleEvent?
    @State private var myShiftsOnly = false
    @State private var homeAwayFilter: HomeAwayFilter = .all
    /// nil = all sports. Cuts the all-team firehose down to the sport a student
    /// or staffer actually works, without hiding open shifts the way a
    /// my-shifts-only default would.
    @State private var sportFilter: String?
    @State private var viewMode: ScheduleViewMode = .list
    @State private var calendarSelectedDate: Date = .now
    @State private var showTradeBoard = false
    @State private var showFilters = false
    @State private var toast: Toast?
    @State private var isSubscribing = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(SessionStore.self) private var session
    @Environment(AppState.self) private var appState
    @Environment(\.scenePhase) private var scenePhase

    private var canSeePastEvents: Bool {
        let role = session.currentUser?.role ?? ""
        return role == "STAFF" || role == "ADMIN"
    }

    private var displayedGroups: [(date: Date, events: [ScheduleEvent])] {
        vm.groupedEvents.compactMap { group in
            var filtered = group.events
            if myShiftsOnly { filtered = filtered.filter { vm.shiftsByEventId[$0.id] != nil } }
            switch homeAwayFilter {
            case .home: filtered = filtered.filter { $0.isHome == true }
            case .away: filtered = filtered.filter { $0.isHome == false }
            case .neutral: filtered = filtered.filter { $0.isHome == nil }
            case .all: break
            }
            if let sportFilter { filtered = filtered.filter { $0.sportCode == sportFilter } }
            return filtered.isEmpty ? nil : (date: group.date, events: filtered)
        }
    }

    /// Distinct sport codes present in the loaded events, ordered by display
    /// name — drives the sport filter chips (only shown when 2+ sports appear).
    private var availableSportCodes: [String] {
        let codes = Set(vm.events.compactMap { $0.sportCode })
        return codes.sorted { scheduleSportLabel($0) < scheduleSportLabel($1) }
    }

    private var activeFilterCount: Int {
        var count = 0
        if myShiftsOnly { count += 1 }
        if canSeePastEvents && vm.includePast { count += 1 }
        if homeAwayFilter != .all { count += 1 }
        if sportFilter != nil { count += 1 }
        return count
    }

    private var activeFilterSummary: String {
        var parts: [String] = []
        if myShiftsOnly { parts.append("My shifts") }
        if homeAwayFilter != .all { parts.append(homeAwayFilter.rawValue) }
        if let sportFilter { parts.append(scheduleSportLabel(sportFilter)) }
        if canSeePastEvents && vm.includePast { parts.append("Past") }
        return parts.isEmpty ? "All upcoming events" : parts.joined(separator: " · ")
    }

    var body: some View {
        NavigationStack {
            Group {
                if vm.isLoading && vm.events.isEmpty {
                    List {
                        ForEach(0..<6, id: \.self) { _ in
                            EventRowSkeleton()
                                .listRowSeparator(.hidden)
                                .listRowBackground(Color.clear)
                                .listRowInsets(EdgeInsets(top: 5, leading: 16, bottom: 5, trailing: 16))
                        }
                    }
                    .listStyle(.plain)
                    .scrollContentBackground(.hidden)
                    .background(Color(.systemGroupedBackground))
                    .allowsHitTesting(false)
                    .accessibilityHidden(true)
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
                    VStack(spacing: 0) {
                        scheduleControlStrip

                        switch viewMode {
                        case .list:
                            eventList
                        case .calendar:
                            ScheduleCalendarView(
                                selectedDate: $calendarSelectedDate,
                                eventsByDay: vm.eventsByDay,
                                myShiftsOnly: myShiftsOnly,
                                homeAwayFilter: homeAwayFilter,
                                sportFilter: sportFilter,
                                shiftsByEventId: vm.shiftsByEventId,
                                onSelectEvent: { selectedEvent = $0 }
                            )
                        }
                    }
                    .background(Color(.systemGroupedBackground))
                }
            }
            .overlay(alignment: .top) {
                // Stale data indicator — shown when last load was > 5 min ago and no error.
                if vm.isStale && !vm.events.isEmpty && !vm.isLoading && vm.refreshError == nil,
                   let loadedAt = vm.lastLoadedAt {
                    HStack(spacing: 6) {
                        Image(systemName: "clock")
                            .font(.caption2)
                        Text("Updated \(loadedAt.formatted(.relative(presentation: .named)))")
                            .font(.caption2)
                    }
                    .foregroundStyle(.secondary)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(.regularMaterial, in: Capsule())
                    .padding(.top, 4)
                    .shadow(color: Color.primary.opacity(0.06), radius: 6, y: 2)
                    .transition(.move(edge: .top).combined(with: .opacity))
                }
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
            .toast($toast)
            .animation(reduceMotion ? nil : .easeInOut(duration: 0.2), value: vm.refreshError)
            .navigationTitle("Schedule")
            // Inline title reclaims the tall, empty large-title band on this
            // pushed view, pulling the content up under the nav bar.
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItemGroup(placement: .topBarTrailing) {
                    Button {
                        showTradeBoard = true
                    } label: {
                        ZStack(alignment: .topTrailing) {
                            Image(systemName: "arrow.left.arrow.right")
                                .font(.body.weight(.semibold))
                                .frame(width: 44, height: 44)
                            if appState.openTradeCount > 0 {
                                Text("\(appState.openTradeCount)")
                                    .font(.caption2.weight(.semibold).monospacedDigit())
                                    .padding(.horizontal, 5)
                                    .padding(.vertical, 1)
                                    .background(Color.statusText(.orange), in: Capsule())
                                    .foregroundStyle(.white)
                                    .offset(x: 4, y: -2)
                            }
                        }
                        .foregroundStyle(Color.primary)
                    }
                    .accessibilityLabel(appState.openTradeCount > 0
                        ? "Trade Board, \(appState.openTradeCount) open"
                        : "Trade Board")

                    Button {
                        Task { await subscribeToCalendar() }
                    } label: {
                        Image(systemName: isSubscribing ? "calendar" : "calendar.badge.plus")
                            .font(.body.weight(.semibold))
                            .frame(width: 44, height: 44)
                            .foregroundStyle(Color.primary)
                    }
                    .disabled(isSubscribing)
                    .accessibilityLabel("Subscribe to shifts in Calendar")
                }
            }
            .task {
                if !canSeePastEvents {
                    vm.includePast = false
                }
                await vm.load()
            }
            .refreshable { await vm.load(forceRefresh: true) }
            .onChange(of: canSeePastEvents) { _, canSee in
                if !canSee, vm.includePast {
                    vm.includePast = false
                    Task { await vm.load(forceRefresh: true) }
                }
            }
            .onChange(of: appState.tabResetToken) { _, _ in
                guard appState.resetTab == 4 else { return }
                selectedEvent = nil
                myShiftsOnly = false
                homeAwayFilter = .all
                sportFilter = nil
                viewMode = .list
                calendarSelectedDate = .now
                showFilters = false
                showTradeBoard = false
                if vm.includePast {
                    vm.includePast = false
                    Task { await vm.load(forceRefresh: true) }
                }
            }
            .onChange(of: scenePhase) { _, phase in
                if phase == .active {
                    Task { await vm.load() }
                }
            }
            .onChange(of: appState.pendingPushEventId) { _, eventId in
                guard let eventId else { return }
                appState.pendingPushEventId = nil
                if let event = vm.events.first(where: { $0.id == eventId }) {
                    selectedEvent = event
                } else {
                    // Events not loaded yet — force a load then open once ready.
                    Task {
                        await vm.load(forceRefresh: true)
                        if let event = vm.events.first(where: { $0.id == eventId }) {
                            selectedEvent = event
                        }
                    }
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
            .sheet(isPresented: $showFilters) {
                ScheduleFilterSheet(
                    myShiftsOnly: $myShiftsOnly,
                    homeAwayFilter: $homeAwayFilter,
                    sportFilter: $sportFilter,
                    includePast: vm.includePast,
                    canSeePastEvents: canSeePastEvents,
                    availableSportCodes: availableSportCodes,
                    activeFilterCount: activeFilterCount,
                    onTogglePast: togglePastEvents,
                    onClear: clearScheduleFilters
                )
                .presentationDetents([.medium, .large])
                .presentationDragIndicator(.visible)
            }
            .sheet(isPresented: $showTradeBoard, onDismiss: {
                Task { await appState.refresh(forceRefresh: true) }
            }) {
                TradeBoardSheet(
                    myShifts: vm.myShifts,
                    currentUserId: session.currentUser?.id ?? "",
                    currentUserRole: session.currentUser?.role ?? "",
                    onTradePosted: { area in
                        toast = Toast(message: "Posted \(area) shift to the trade board", icon: "checkmark.circle.fill", role: .success)
                    },
                    onTradeClaimed: { area, when in
                        toast = Toast(message: "You picked up \(area) on \(when)", icon: "hand.thumbsup.fill", role: .success)
                    }
                )
            }
        }
    }

    private func togglePastEvents() {
        vm.includePast.toggle()
        Task { await vm.load(forceRefresh: true) }
    }

    private func clearScheduleFilters() {
        let shouldReload = vm.includePast
        myShiftsOnly = false
        homeAwayFilter = .all
        sportFilter = nil
        if shouldReload {
            vm.includePast = false
            Task { await vm.load(forceRefresh: true) }
        }
    }

    private var scheduleControlStrip: some View {
        VStack(alignment: .leading, spacing: 10) {
            // The segmented control is self-explanatory (List / Calendar), so it
            // stands on its own — no "View" label, matching Apple's own switchers.
            Picker("Schedule view", selection: $viewMode) {
                ForEach(ScheduleViewMode.allCases, id: \.self) { mode in
                    Text(mode.rawValue).tag(mode)
                }
            }
            .pickerStyle(.segmented)
            .accessibilityLabel("Schedule view")

            HStack(spacing: 12) {
                Text(activeFilterSummary)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                    .frame(maxWidth: .infinity, alignment: .leading)

                Button {
                    showFilters = true
                } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "line.3.horizontal.decrease.circle")
                            .font(.subheadline.weight(.semibold))
                        Text("Filters")
                        if activeFilterCount > 0 {
                            Text("\(activeFilterCount)")
                                .font(.caption2.weight(.semibold).monospacedDigit())
                                .foregroundStyle(.white)
                                .padding(.horizontal, 5)
                                .padding(.vertical, 1)
                                .background(Color.brandPrimary, in: Capsule())
                                .accessibilityHidden(true)
                        }
                    }
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Color.primary)
                    .padding(.horizontal, 12)
                    .frame(minHeight: 44)
                    .background(Color.cardSurfaceRaised, in: Capsule())
                    .overlay(Capsule().strokeBorder(Color.hairline, lineWidth: 0.5))
                }
                .buttonStyle(.plain)
                .accessibilityLabel(activeFilterCount > 0 ? "Filters, \(activeFilterCount) active" : "Filters")
            }
        }
        .padding(.horizontal, Brand.Space.md)
        .padding(.top, Brand.Space.sm)
        .padding(.bottom, Brand.Space.xs)
        .background(Color(.systemGroupedBackground))
        .sensoryFeedback(.selection, trigger: viewMode)
        .sensoryFeedback(.selection, trigger: activeFilterCount)
    }

    private func subscribeToCalendar() async {
        isSubscribing = true
        defer { isSubscribing = false }
        do {
            // Fetch existing token; generate one if the user doesn't have one yet.
            let existing = try await APIClient.shared.icsToken()
            let token: String
            if let t = existing {
                token = t
            } else {
                token = try await APIClient.shared.generateICSToken()
            }
            guard let url = AppEnvironment.webcalURL(path: "/api/shifts/ics/\(token)") else { return }
            let opened = await UIApplication.shared.open(url)
            if opened {
                toast = Toast(message: "Opening Apple Calendar…", icon: "calendar.badge.checkmark", role: .info)
            }
        } catch {
            toast = Toast(message: error.localizedDescription, icon: "exclamationmark.triangle", role: .error)
        }
    }

    @ViewBuilder
    private var eventList: some View {
        if displayedGroups.isEmpty {
            ContentUnavailableView {
                Label(filteredEmptyTitle, systemImage: "calendar")
            } description: {
                Text(filteredEmptyDescription)
            } actions: {
                if activeFilterCount > 0 {
                    Button("Clear Filters") { clearScheduleFilters() }
                        .buttonStyle(.borderedProminent)
                }
            }
        } else {
            List {
                ForEach(displayedGroups, id: \.date) { group in
                    Section {
                        ForEach(group.events) { event in
                            Button {
                                selectedEvent = event
                            } label: {
                                EventRow(
                                    event: event,
                                    myShift: vm.shiftsByEventId[event.id],
                                    contextDay: group.date
                                )
                            }
                            .buttonStyle(ScalePressStyle())
                            .listRowInsets(EdgeInsets(top: 5, leading: 16, bottom: 5, trailing: 16))
                            .listRowSeparator(.hidden)
                            .listRowBackground(Color.clear)
                        }
                    } header: {
                        ScheduleDateHeader(date: group.date, eventCount: group.events.count)
                            .listRowInsets(EdgeInsets(top: 0, leading: 0, bottom: 0, trailing: 0))
                    }
                    .listSectionSeparator(.hidden)
                }
            }
            .listStyle(.plain)
            .listSectionSpacing(.compact)
            .scrollContentBackground(.hidden)
            .contentMargins(.bottom, 96, for: .scrollContent)
            .background(Color(.systemGroupedBackground))
        }
    }

    private var filteredEmptyTitle: String {
        if myShiftsOnly && activeFilterCount == 1 {
            return "No shifts assigned to you"
        }
        return "No matching events"
    }

    private var filteredEmptyDescription: String {
        if myShiftsOnly && activeFilterCount == 1 {
            return "Your schedule will show up here when staff confirm."
        }
        return "Clear filters or try a broader sport or venue."
    }
}

// MARK: - Filter Sheet

private struct ScheduleFilterSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Binding var myShiftsOnly: Bool
    @Binding var homeAwayFilter: HomeAwayFilter
    @Binding var sportFilter: String?
    let includePast: Bool
    let canSeePastEvents: Bool
    let availableSportCodes: [String]
    let activeFilterCount: Int
    let onTogglePast: () -> Void
    let onClear: () -> Void

    private static let allSports = "__all_sports__"

    private var sportSelection: Binding<String> {
        Binding {
            sportFilter ?? Self.allSports
        } set: { newValue in
            sportFilter = newValue == Self.allSports ? nil : newValue
        }
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Scope") {
                    Toggle(isOn: $myShiftsOnly) {
                        Label("My shifts", systemImage: myShiftsOnly ? "person.fill" : "person")
                            .foregroundStyle(.primary)
                    }

                    if canSeePastEvents {
                        Toggle(isOn: Binding(get: { includePast }, set: { _ in onTogglePast() })) {
                            Label("Past events", systemImage: includePast ? "clock.arrow.circlepath" : "clock")
                                .foregroundStyle(.primary)
                        }
                    }
                }

                Section("Venue") {
                    Picker("Venue", selection: $homeAwayFilter) {
                        ForEach(HomeAwayFilter.allCases, id: \.self) { filter in
                            Text(filter.rawValue).tag(filter)
                        }
                    }
                    .pickerStyle(.segmented)
                }

                if availableSportCodes.count > 1 {
                    Section("Sport") {
                        Picker("Sport", selection: sportSelection) {
                            Text("All Sports").tag(Self.allSports)
                            ForEach(availableSportCodes, id: \.self) { code in
                                Text(scheduleSportLabel(code)).tag(code)
                            }
                        }
                    }
                }
            }
            .navigationTitle("Filters")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Clear") { onClear() }
                        .disabled(activeFilterCount == 0)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
}

// MARK: - Calendar View

struct ScheduleCalendarView: View {
    @Binding var selectedDate: Date
    let eventsByDay: [Date: [ScheduleEvent]]
    let myShiftsOnly: Bool
    let homeAwayFilter: HomeAwayFilter
    var sportFilter: String?
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
        filteredEvents(on: selectedDate)
    }

    private func filteredEvents(on date: Date) -> [ScheduleEvent] {
        let day = calendar.startOfDay(for: date)
        var all = eventsByDay[day] ?? []
        if myShiftsOnly { all = all.filter { shiftsByEventId[$0.id] != nil } }
        switch homeAwayFilter {
        case .home: all = all.filter { $0.isHome == true }
        case .away: all = all.filter { $0.isHome == false }
        case .neutral: all = all.filter { $0.isHome == nil }
        case .all: break
        }
        if let sportFilter { all = all.filter { $0.sportCode == sportFilter } }
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
                        let visibleEvents = filteredEvents(on: day)
                        let dots = dotInfo(for: day)
                        Button {
                            withAnimation(.easeInOut(duration: 0.15)) {
                                selectedDate = day
                                // Also follow selection across months.
                                displayedMonth = calendar.date(from: calendar.dateComponents([.year, .month], from: day)) ?? displayedMonth
                            }
                        } label: {
                            DayCell(
                                date: day,
                                isToday: calendar.isDateInToday(day),
                                isSelected: calendar.isDate(day, inSameDayAs: selectedDate),
                                dots: dots,
                                eventCount: visibleEvents.count
                            )
                        }
                        .buttonStyle(.plain)
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
            LegendDot(color: Color.statusText(.blue), label: "My shift")
            LegendDot(color: Color.statusText(.green), label: "Home")
            LegendDot(color: Color.statusText(.orange), label: "Away")
        }
        .frame(maxWidth: .infinity, alignment: .center)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Legend: my shift, home, away")
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
                    .background(Color.cardSurfaceRaised, in: Circle())
                    .overlay(Circle().strokeBorder(Color.hairline, lineWidth: 0.5))
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
                        .foregroundStyle(Color.brandPrimary)
                        .buttonStyle(.plain)
                }
            }

            Spacer()

            Button { changeMonth(by: 1) } label: {
                Image(systemName: "chevron.right")
                    .font(.body.weight(.semibold))
                    .frame(width: 44, height: 44)
                    .background(Color.cardSurfaceRaised, in: Circle())
                    .overlay(Circle().strokeBorder(Color.hairline, lineWidth: 0.5))
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
                        EventRow(
                            event: event,
                            myShift: shiftsByEventId[event.id],
                            contextDay: calendar.startOfDay(for: selectedDate)
                        )
                    }
                    .buttonStyle(ScalePressStyle())
                    .listRowInsets(EdgeInsets(top: 5, leading: 16, bottom: 5, trailing: 16))
                    .listRowSeparator(.hidden)
                    .listRowBackground(Color.clear)
                }
            }
            .listStyle(.plain)
            .scrollContentBackground(.hidden)
            .contentMargins(.bottom, 96, for: .scrollContent)
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
        let visible = filteredEvents(on: date)
        return visible.prefix(3).map { event in
            let isShift = shiftsByEventId[event.id] != nil
            let color: Color
            if isShift {
                color = Color.statusText(.blue)
            } else {
                switch event.isHome {
                case true:  color = Color.statusText(.green)
                case false: color = Color.statusText(.orange)
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
                .accessibilityHidden(true)
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
    let eventCount: Int

    var body: some View {
        VStack(spacing: 4) {
            ZStack {
                if isSelected {
                    Circle()
                        .fill(isToday ? Color.brandPrimary : Color.brandPrimary.opacity(0.18))
                        .frame(width: 34, height: 34)
                } else if isToday {
                    Circle()
                        .strokeBorder(Color.brandPrimary, lineWidth: 1.5)
                        .frame(width: 34, height: 34)
                }
                Text(date.formatted(.dateTime.day()))
                    .font(.subheadline)
                    .fontWeight(isToday ? .semibold : .regular)
                    .foregroundStyle(
                        isSelected && isToday ? .white :
                        isSelected ? Color.brandPrimary :
                        isToday ? Color.brandPrimary : .primary
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
        .frame(minWidth: 44, minHeight: 52)
        .contentShape(Rectangle())
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(accessibilityLabel)
        .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
    }

    private var accessibilityLabel: String {
        var parts: [String] = []
        parts.append(date.formatted(.dateTime.weekday(.wide).month(.wide).day()))
        if isToday { parts.append("today") }
        let hasMyShift = dots.contains(where: \.isShift)
        if eventCount == 0 {
            parts.append("no events")
        } else if eventCount == 1 {
            parts.append(hasMyShift ? "1 event including my shift" : "1 event")
        } else {
            parts.append(hasMyShift ? "\(eventCount) events including my shift" : "\(eventCount) events")
        }
        return parts.joined(separator: ", ")
    }
}

// MARK: - Date Header

private struct ScheduleDateHeader: View {
    let date: Date
    let eventCount: Int

    private var cal: Calendar { .current }
    private var isToday: Bool { cal.isDateInToday(date) }
    private var isTomorrow: Bool { cal.isDateInTomorrow(date) }

    private var primaryLabel: String {
        if isToday { return "Today" }
        if isTomorrow { return "Tomorrow" }
        return date.formatted(.dateTime.weekday(.wide))
    }

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            VStack(alignment: .leading, spacing: 1) {
                Text(primaryLabel)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(isToday ? Color.brandPrimary : .primary)
                Text(date.formatted(.dateTime.weekday(.abbreviated).month(.abbreviated).day().year()))
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            if eventCount > 1 {
                Label("\(eventCount)", systemImage: "calendar")
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(.secondary)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Color.cardSurfaceRaised, in: Capsule())
                    .accessibilityHidden(true)
            }
        }
        .padding(.horizontal, 16)
        .padding(.top, Brand.Space.md)
        .padding(.bottom, 6)
        .background(Color(.systemGroupedBackground))
        .accessibilityElement(children: .ignore)
        .accessibilityAddTraits(.isHeader)
        .accessibilityLabel(headerAccessibilityLabel)
    }

    private var headerAccessibilityLabel: String {
        var parts: [String] = []
        if isToday {
            parts.append("Today")
        } else if isTomorrow {
            parts.append("Tomorrow")
        } else {
            parts.append(date.formatted(.dateTime.month(.wide).year()))
        }
        parts.append(date.formatted(.dateTime.weekday(.wide).day()))
        if eventCount > 1 {
            parts.append("\(eventCount) events")
        } else if eventCount == 1 {
            parts.append("1 event")
        }
        return parts.joined(separator: ", ")
    }
}

// MARK: - Event Row

struct EventRow: View {
    let event: ScheduleEvent
    let myShift: MyShift?
    /// The day this row is rendered under. For a multi-day event it drives the
    /// "Day n/m" marker and the segment-aware time line.
    var contextDay: Date? = nil

    /// When this row represents one day of a multi-day event, its 1-based
    /// position and the total span length.
    private var segment: (index: Int, total: Int)? {
        guard event.isMultiDay, let day = contextDay, let idx = event.dayIndex(for: day) else { return nil }
        return (idx, event.dayCount)
    }

    /// Segment-aware time line: the first day shows the start, the last day the
    /// end, interior days read "All day".
    private var timeRowText: String {
        if let seg = segment {
            if event.displayAllDay { return "All day" }
            if seg.index == 1 { return "From \(event.startsAt.formatted(.dateTime.hour().minute()))" }
            if seg.index == seg.total { return "Until \(event.endsAt.formatted(.dateTime.hour().minute()))" }
            return "All day"
        }
        return event.displayAllDay ? "All day" : eventTimeLabel
    }

    private var eventDisplayTitle: String {
        scheduleEventDisplayTitle(event)
    }

    var body: some View {
        HStack(spacing: 12) {
            StatusRail(color: barColor)

            VStack(alignment: .leading, spacing: 3) {
                Text(eventDisplayTitle)
                    .font(.body.weight(.semibold))
                    .lineLimit(2)
                    .fixedSize(horizontal: false, vertical: true)

                // One calm secondary line carries the rest, so the title no
                // longer competes with a cluster of pills.
                metaLine
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            // Crew fill is the one at-a-glance signal worth a trailing chip.
            if let cov = event.coverage, cov.total > 0 {
                coverageChip(cov)
            }

            // Disclosure chevron — the row opens the event detail sheet, so per
            // the HIG it carries a disclosure indicator to read as navigable.
            Image(systemName: "chevron.right")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(.tertiary)
                .accessibilityHidden(true)
        }
        .padding(.vertical, 12)
        .padding(.horizontal, 14)
        .background(Color.cardSurface)
        .clipShape(RoundedRectangle(cornerRadius: Brand.Radius.md, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Brand.Radius.md, style: .continuous)
                .strokeBorder(Color.hairline, lineWidth: 0.5)
        )
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(rowAccessibilityLabel)
    }

    /// A single, quiet secondary line: home/away · time · multi-day · my-shift —
    /// replacing the old stack of pills that crowded the title.
    private var metaLine: some View {
        HStack(spacing: 5) {
            if let isHome = event.isHome {
                Text(isHome ? "Home" : "Away")
                    .foregroundStyle(.secondary)
                metaDot
            }
            Text(timeRowText)
                .foregroundStyle(.secondary)
                .monospacedDigit()
            if let seg = segment {
                metaDot
                Text("Day \(seg.index) of \(seg.total)")
                    .foregroundStyle(.secondary)
            }
            if myShift != nil {
                metaDot
                Text("My shift")
                    .foregroundStyle(Color.statusText(.blue))
            }
        }
        .font(.subheadline)
        .lineLimit(1)
        .minimumScaleFactor(0.8)
    }

    private var metaDot: some View {
        Text("·").foregroundStyle(.tertiary)
    }

    private var rowAccessibilityLabel: String {
        var parts: [String] = []
        if myShift != nil { parts.append("My shift") }
        parts.append(eventDisplayTitle)
        if let cov = event.coverage, cov.total > 0 {
            parts.append("Crew \(cov.filled) of \(cov.total)")
        }
        if let isHome = event.isHome {
            parts.append(isHome ? "Home" : "Away")
        }
        if event.displayAllDay {
            parts.append("All day")
        } else if let shift = myShift {
            let callTime = shift.startsAt.formatted(.dateTime.hour().minute())
            let eventTime = event.startsAt.formatted(.dateTime.hour().minute())
            let endTime = shift.endsAt.formatted(.dateTime.hour().minute())
            if calendarSame(shift.startsAt, event.startsAt) {
                parts.append("Event \(eventTime) to \(endTime)")
            } else {
                parts.append("Call \(callTime), event \(eventTime), end \(endTime)")
            }
        } else {
            parts.append(eventTimeLabel)
        }
        if let segment {
            parts.append("Day \(segment.index) of \(segment.total)")
        }
        if let location = event.location {
            parts.append(location.name)
        }
        return parts.joined(separator: ", ")
    }

    @ViewBuilder
    private func coverageChip(_ cov: ShiftCoverage) -> some View {
        HStack(spacing: 3) {
            Image(systemName: "person.2.fill")
                .font(.caption.weight(.semibold))
            Text("\(cov.filled)/\(cov.total)")
                .font(.caption.weight(.semibold).monospacedDigit())
        }
        .foregroundStyle(Color.statusText(coverageTone(cov)))
        .padding(.horizontal, 6)
        .padding(.vertical, 2)
        .background(Color.statusBackground(coverageTone(cov)), in: Capsule())
        .accessibilityHidden(true) // surfaced via the combined row label
    }

    private func coverageTone(_ cov: ShiftCoverage) -> StatusTone {
        if cov.percentage >= 100 { return .green }
        if cov.percentage > 0 { return .orange }
        return .red
    }

    /// The left rail now always encodes the venue (home/away/neutral); "my shift"
    /// is signalled by the card's accent stroke instead, so the two don't fight.
    private var barColor: Color {
        switch event.isHome {
        case true:  return Color.statusText(.green)
        case false: return Color.statusText(.orange)
        default:    return Color(.systemGray4)
        }
    }

    private var eventTimeLabel: String {
        if event.displayAllDay { return "All day" }
        let start = event.startsAt.formatted(.dateTime.hour().minute())
        let end = event.endsAt.formatted(.dateTime.hour().minute())
        return "\(start) – \(end)"
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
