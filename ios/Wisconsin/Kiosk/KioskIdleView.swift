import SwiftUI

struct KioskIdleView: View {
    @Environment(KioskStore.self) private var store
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @State private var dashboard: KioskDashboard?
    @State private var users: [KioskUser] = []
    @State private var isLoading = false
    @State private var lastLoadedAt: Date?
    @State private var loadFailedAt: Date?
    @State private var sleepDismissedUntil: Date?
    @State private var selectedSummary: KioskSummarySelection = .events
    @State private var selectedEvent: KioskEvent?
    @State private var identityScanFeedback: IdentityScanFeedback?
    @State private var isIdentifyingScan = false
    #if DEBUG
    @State private var debugForcesSleepMode = false
    #endif

    private let refreshInterval: TimeInterval = 30
    private let sleepWakeDuration: TimeInterval = 10 * 60

    var body: some View {
        GeometryReader { proxy in
            let compact = proxy.size.width < 880 || dynamicTypeSize.isAccessibilitySize
            let rosterWidth = min(max(proxy.size.width * 0.42, 430), 560)

            ZStack {
                Group {
                    if compact {
                        ScrollView {
                            VStack(spacing: 24) {
                                leftPanel
                                rosterPanel
                            }
                            .padding(28)
                        }
                        .scrollIndicators(.hidden)
                    } else {
                        HStack(spacing: 0) {
                            leftPanel
                                .frame(maxWidth: .infinity)
                                .padding(32)

                            Divider()
                                .background(Color.white.opacity(0.16))

                            rosterPanel
                                .frame(width: rosterWidth)
                                .padding(32)
                        }
                    }
                }

                if shouldShowSleepMode {
                    KioskSleepModeView(
                        deviceName: store.info?.name ?? "Gear Room",
                        reason: sleepModeReason,
                        onWake: dismissSleepMode
                    )
                    .transition(.opacity)
                }

                #if DEBUG
                debugSleepModeButton
                    .padding(24)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing)
                #endif

                KioskScannerField { value in
                    handleIdentityScan(value)
                }
                .frame(width: 1, height: 1)
                .opacity(0)
            }
        }
        .task { await loadAll() }
        .task(id: "refresh") {
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: UInt64(refreshInterval * 1_000_000_000))
                await loadAll()
            }
        }
        .sheet(item: $selectedEvent) { event in
            KioskEventDetailSheet(
                event: event,
                capabilities: dashboard?.capabilities ?? KioskDashboard.Capabilities()
            )
                .presentationDetents([.height(440), .large])
                .presentationDragIndicator(.visible)
        }
    }

    private var shouldShowSleepMode: Bool {
        #if DEBUG
        if debugForcesSleepMode { return true }
        #endif
        guard dashboard?.standby?.sleepMode == true else { return false }
        if let sleepDismissedUntil, sleepDismissedUntil > Date() {
            return false
        }
        return true
    }

    private var sleepModeReason: String {
        #if DEBUG
        if debugForcesSleepMode { return "debug_night_mode" }
        #endif
        return dashboard?.standby?.reason ?? "idle_window"
    }

    #if DEBUG
    private var debugSleepModeButton: some View {
        Button {
            debugForcesSleepMode.toggle()
            if debugForcesSleepMode {
                sleepDismissedUntil = nil
            }
        } label: {
            Image(systemName: debugForcesSleepMode ? "moon.zzz.fill" : "moon.zzz")
                .font(.callout.weight(.bold))
                .foregroundStyle(debugForcesSleepMode ? Color.black : Color.white)
                .frame(width: 40, height: 40)
                .background(debugForcesSleepMode ? Color.white : Color.white.opacity(0.12), in: Circle())
                .overlay(
                    Circle()
                        .stroke(Color.white.opacity(debugForcesSleepMode ? 0.9 : 0.2), lineWidth: 1)
                )
        }
        .buttonStyle(.plain)
        .opacity(debugForcesSleepMode ? 1 : 0.45)
        .accessibilityLabel(debugForcesSleepMode ? "Disable debug night mode" : "Enable debug night mode")
    }
    #endif

    private func dismissSleepMode() {
        sleepDismissedUntil = Date().addingTimeInterval(sleepWakeDuration)
        store.resetInactivity()
    }

    // MARK: - Left Panel

    private var leftPanel: some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack(spacing: 8) {
                Text(store.info?.name ?? "Gear Room")
                    .font(.callout.weight(.bold))
                    .foregroundStyle(Color.white.opacity(0.78))
                if let location = store.info?.locationName {
                    Text("•")
                        .foregroundStyle(Color.white.opacity(0.38))
                    Text(location)
                        .font(.callout.weight(.semibold))
                        .foregroundStyle(Color.white.opacity(0.66))
                }
            }

            TimelineView(.periodic(from: .now, by: 1)) { context in
                VStack(alignment: .leading, spacing: 4) {
                    KioskClockView(date: context.date)
                    Text(context.date, format: .dateTime.weekday(.wide).month(.wide).day())
                        .font(.gothamBold(size: 32))
                        .foregroundStyle(Color.white.opacity(0.86))
                        .lineLimit(1)
                        .minimumScaleFactor(0.75)
                    locationAndFreshness
                }
                .accessibilityElement(children: .combine)
            }

            // Stats row
            if let stats = dashboard?.stats {
                HStack(spacing: 16) {
                    StatTile(
                        value: stats.itemsOut,
                        label: "Items Out",
                        accent: .white,
                        isSelected: selectedSummary == .itemsOut,
                        reduceMotion: reduceMotion
                    ) { selectedSummary = .itemsOut }
                    StatTile(
                        value: stats.checkouts,
                        label: "Checkouts",
                        accent: .white,
                        isSelected: selectedSummary == .checkouts,
                        reduceMotion: reduceMotion
                    ) { selectedSummary = .checkouts }
                    StatTile(
                        value: stats.overdue,
                        label: "Overdue",
                        accent: stats.overdue > 0 ? Color.statusText(.red) : .white,
                        isSelected: selectedSummary == .overdue,
                        reduceMotion: reduceMotion
                    ) { selectedSummary = .overdue }
                }
            } else {
                HStack(spacing: 16) {
                    StatTilePlaceholder(label: "Items Out")
                    StatTilePlaceholder(label: "Checkouts")
                    StatTilePlaceholder(label: "Overdue")
                }
            }

            eventSections

            if selectedSummary != .events {
                dashboardDetailPanel
            }

            // Quiet-day state: without it the left panel is a black void
            // below the stat tiles whenever nothing is out and no events run.
            if let dashboard, selectedSummary != .events, dashboard.activeItems.isEmpty, dashboard.checkouts.isEmpty, dashboard.events.isEmpty {
                Spacer()
                VStack(spacing: 10) {
                    Image(systemName: "checkmark.seal.fill")
                        .font(.system(size: 44))
                        .foregroundStyle(Color.statusText(.green))
                        .accessibilityHidden(true)
                    Text("All gear is home")
                        .font(.title3.bold())
                        .foregroundStyle(.white)
                }
                .frame(maxWidth: .infinity)
                .accessibilityElement(children: .combine)
            }

            Spacer()
        }
    }

    /// Discreet "Updated Xm ago" stamp. Switches to
    /// orange when the last successful load is >5 min old so staff has a
    /// visual signal that the dashboard might be lying.
    @ViewBuilder
    private var locationAndFreshness: some View {
        HStack(spacing: 6) {
            if let last = lastLoadedAt {
                Text("Updated \(last.kioskFreshnessLabel(now: Date()))")
                    .font(.caption)
                    .foregroundStyle(isStale ? Color.statusText(.orange) : Color.white.opacity(0.48))
                    .monospacedDigit()
            }
        }
    }

    private var isStale: Bool {
        guard let last = lastLoadedAt else { return false }
        return Date().timeIntervalSince(last) > 300
    }

    // MARK: - Roster Panel

    private var rosterPanel: some View {
        VStack(alignment: .leading, spacing: 16) {
            VStack(alignment: .leading, spacing: 4) {
                Text("Scan Wiscard")
                    .font(.title2.bold())
                    .foregroundStyle(.white)
                Text("Or tap your name below")
                    .font(.subheadline)
                    .foregroundStyle(KioskText.tertiary)
            }

            if let feedback = identityScanFeedback {
                KioskFeedbackBanner(tone: feedback.tone, message: feedback.message)
                    .transition(.move(edge: .top).combined(with: .opacity))
            }

            if users.isEmpty && isLoading {
                ProgressView().tint(.white).frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                let labels = disambiguatedLabels(for: users)
                ScrollView {
                    LazyVGrid(columns: rosterColumns, spacing: 10) {
                        ForEach(users) { user in
                            UserTile(user: user, displayName: labels[user.id] ?? user.name) {
                                store.screen = .studentHub(user)
                            }
                        }
                    }
                }
            }
        }
    }

    private var rosterColumns: [GridItem] {
        if dynamicTypeSize.isAccessibilitySize {
            return [GridItem(.flexible(minimum: 150), spacing: 10)]
        }
        return [GridItem(.adaptive(minimum: 112, maximum: 148), spacing: 10)]
    }

    @ViewBuilder
    private var dashboardDetailPanel: some View {
        if let dashboard {
            switch selectedSummary {
            case .events:
                EmptyView()
            case .itemsOut:
                KioskDashboardList(title: "Items Out", emptyMessage: "No items are out.", isEmpty: dashboard.activeItems.isEmpty) {
                    ForEach(dashboard.activeItems) { item in
                        ActiveItemRow(item: item)
                    }
                }
            case .checkouts:
                KioskDashboardList(title: "Active Checkouts", emptyMessage: "No active checkouts.", isEmpty: dashboard.checkouts.isEmpty) {
                    ForEach(dashboard.checkouts) { checkout in
                        CheckoutRow(checkout: checkout)
                    }
                }
            case .overdue:
                let overdueCheckouts = dashboard.checkouts.filter(\.isOverdue)
                KioskDashboardList(title: "Overdue", emptyMessage: "No overdue checkouts.", isEmpty: overdueCheckouts.isEmpty) {
                    ForEach(overdueCheckouts) { checkout in
                        CheckoutRow(checkout: checkout)
                    }
                }
            }
        }
    }

    @ViewBuilder
    private var eventSections: some View {
        if let dashboard {
            let todayEvents = dashboard.events.filter { Calendar.current.isDateInToday($0.startsAt) }
            let tomorrowEvents = dashboard.events.filter { Calendar.current.isDateInTomorrow($0.startsAt) }
            VStack(alignment: .leading, spacing: 12) {
                KioskEventSection(
                    title: "Today",
                    events: todayEvents,
                    hasWorkerDetails: dashboard.capabilities.eventWorkerDetails
                ) { event in
                    selectedEvent = event
                }
                KioskEventSection(
                    title: "Tomorrow",
                    events: tomorrowEvents,
                    hasWorkerDetails: dashboard.capabilities.eventWorkerDetails
                ) { event in
                    selectedEvent = event
                }
            }
        }
    }

    private func loadAll() async {
        isLoading = true
        async let dashboardResult = fetchDashboard()
        async let usersResult = fetchUsers()

        let dashboardOutcome = await dashboardResult
        let usersOutcome = await usersResult
        var loadedAnyData = false
        var hitFailure = false

        switch dashboardOutcome {
        case .success(let value):
            dashboard = value
            #if DEBUG
            print("[KioskIdleView] dashboard capabilities: workerDetails=\(value.capabilities.eventWorkerDetails), callTimes=\(value.capabilities.eventCallTimes)")
            #endif
            loadedAnyData = true
        case .failure(let error) where isUnauthorized(error):
            store.deactivate()
            isLoading = false
            return
        case .failure(let error):
            print("[KioskIdleView] dashboard load failed: \(error.localizedDescription)")
            hitFailure = true
        }

        switch usersOutcome {
        case .success(let value):
            users = value
            loadedAnyData = true
        case .failure(let error) where isUnauthorized(error):
            store.deactivate()
            isLoading = false
            return
        case .failure(let error):
            print("[KioskIdleView] users load failed: \(error.localizedDescription)")
            hitFailure = true
        }

        if loadedAnyData {
            lastLoadedAt = Date()
        }
        loadFailedAt = hitFailure ? Date() : nil
        isLoading = false
    }

    private func fetchDashboard() async -> Result<KioskDashboard, Error> {
        do {
            return .success(try await KioskAPI.shared.kioskDashboard())
        } catch {
            return .failure(error)
        }
    }

    private func fetchUsers() async -> Result<[KioskUser], Error> {
        do {
            return .success(try await KioskAPI.shared.kioskUsers())
        } catch {
            return .failure(error)
        }
    }

    private func isUnauthorized(_ error: Error) -> Bool {
        guard let apiError = error as? APIError else { return false }
        if case .unauthorized = apiError {
            return true
        }
        return false
    }

    private func handleIdentityScan(_ value: String) {
        guard !isIdentifyingScan else { return }
        store.resetInactivity()
        isIdentifyingScan = true
        identityScanFeedback = .working("Reading Wiscard...")
        Task {
            do {
                let result = try await KioskAPI.shared.kioskIdentify(scanValue: value)
                if result.success, let user = result.data {
                    Haptics.success()
                    identityScanFeedback = .success(user.name)
                    store.screen = .studentHub(user)
                } else {
                    Haptics.warning()
                    identityScanFeedback = .error(result.error ?? "No user found for that Wiscard")
                }
            } catch {
                if isUnauthorized(error) {
                    store.deactivate()
                } else {
                    Haptics.error()
                    identityScanFeedback = .error((error as? APIError)?.errorDescription ?? "Could not read Wiscard")
                }
            }
            isIdentifyingScan = false
        }
    }
}

// MARK: - Sub-views

private enum IdentityScanFeedback: Equatable {
    case working(String)
    case success(String)
    case error(String)

    var message: String {
        switch self {
        case .working(let message), .success(let message), .error(let message):
            return message
        }
    }

    var tone: KioskBannerTone {
        switch self {
        case .working: .warning
        case .success: .success
        case .error: .error
        }
    }
}

private enum KioskSummarySelection {
    case events
    case itemsOut
    case checkouts
    case overdue
}

private struct KioskClockView: View {
    let date: Date

    private var parts: (time: String, seconds: String, meridiem: String) {
        date.kioskClockParts()
    }

    var body: some View {
        Text("\(parts.time)\(parts.seconds) \(parts.meridiem)")
            .font(.system(size: 118, weight: .black, design: .monospaced))
            .foregroundStyle(.white)
            .lineLimit(1)
            .minimumScaleFactor(0.5)
        .accessibilityLabel(date.formatted(date: .omitted, time: .standard))
    }
}

private struct StatTile: View {
    let value: Int
    let label: String
    let accent: Color
    let isSelected: Bool
    let reduceMotion: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 6) {
                Text("\(value)")
                    .font(.system(size: 44, weight: .bold, design: .rounded))
                    .foregroundStyle(accent)
                    .contentTransition(.numericText())
                    .animation(reduceMotion ? nil : .easeInOut(duration: 0.4), value: value)
                    .monospacedDigit()
                Text(label.uppercased())
                    .font(.caption.weight(.semibold))
                    .tracking(0.8)
                    .foregroundStyle(Color.white.opacity(0.72))
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 22)
            .background(Color.white.opacity(isSelected ? 0.13 : 0.075), in: RoundedRectangle(cornerRadius: 16))
            .overlay(
                RoundedRectangle(cornerRadius: 16)
                    .stroke(isSelected ? Color.white.opacity(0.5) : Color.white.opacity(0.14), lineWidth: isSelected ? 2 : 1)
            )
            .overlay(alignment: .bottom) {
                if isSelected {
                    Capsule()
                        .fill(Color.white.opacity(0.86))
                        .frame(width: 34, height: 3)
                        .padding(.bottom, 8)
                }
            }
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(value) \(label.lowercased())")
    }
}

private struct StatTilePlaceholder: View {
    let label: String

    var body: some View {
        VStack(spacing: 6) {
            Text("–")
                .font(.system(size: 44, weight: .bold, design: .rounded))
                .foregroundStyle(Color.white.opacity(0.42))
            Text(label.uppercased())
                .font(.caption.weight(.semibold))
                .tracking(0.8)
                .foregroundStyle(Color.white.opacity(0.46))
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 22)
        .background(Color.white.opacity(0.05), in: RoundedRectangle(cornerRadius: 16))
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(Color.white.opacity(0.1), lineWidth: 1)
        )
        .accessibilityHidden(true)
    }
}

private struct KioskDashboardList<Content: View>: View {
    let title: String
    let emptyMessage: String
    let isEmpty: Bool
    let content: Content

    init(title: String, emptyMessage: String, isEmpty: Bool, @ViewBuilder content: () -> Content) {
        self.title = title
        self.emptyMessage = emptyMessage
        self.isEmpty = isEmpty
        self.content = content()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title)
                .font(.callout.weight(.bold))
                .foregroundStyle(Color.white.opacity(0.78))

            ScrollView {
                LazyVStack(spacing: 8) {
                    content
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .frame(maxHeight: 210)
            .overlay {
                if isEmpty {
                    Text(emptyMessage)
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(Color.white.opacity(0.62))
                        .frame(maxWidth: .infinity, minHeight: 62)
                }
            }
        }
        .padding(12)
        .background(Color.white.opacity(0.045), in: RoundedRectangle(cornerRadius: 14))
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .stroke(Color.white.opacity(0.1), lineWidth: 1)
        )
    }
}

private struct ActiveItemRow: View {
    let item: KioskDashboard.ActiveItem

    var body: some View {
        HStack(spacing: 10) {
            assetImage
            VStack(alignment: .leading, spacing: 2) {
                Text(item.name)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.white)
                    .lineLimit(1)
                    .minimumScaleFactor(0.85)
                Text("\(item.tagName) · \(item.checkoutTitle)")
                    .font(.caption)
                    .foregroundStyle(Color.white.opacity(0.64))
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            }
            Spacer()
            if item.isOverdue {
                Image(systemName: "exclamationmark.triangle.fill")
                    .foregroundStyle(Color.statusText(.red))
                    .font(.caption)
                    .accessibilityLabel("Overdue")
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(Color.white.opacity(0.07), in: RoundedRectangle(cornerRadius: 10))
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .stroke(Color.white.opacity(0.11), lineWidth: 1)
        )
        .accessibilityElement(children: .combine)
    }

    @ViewBuilder
    private var assetImage: some View {
        if let urlString = item.imageUrl, let url = URL(string: urlString) {
            AsyncImage(url: url) { phase in
                switch phase {
                case .success(let image):
                    image.resizable().scaledToFill()
                default:
                    fallbackAssetImage
                }
            }
            .frame(width: 42, height: 42)
            .clipShape(RoundedRectangle(cornerRadius: 9))
        } else {
            fallbackAssetImage
        }
    }

    private var fallbackAssetImage: some View {
        RoundedRectangle(cornerRadius: 9)
            .fill(Color.white.opacity(0.12))
            .frame(width: 42, height: 42)
            .overlay {
                Image(systemName: "camera.fill")
                    .font(.caption)
                    .foregroundStyle(Color.white.opacity(0.68))
            }
    }
}

private struct KioskEventSection: View {
    let title: String
    let events: [KioskEvent]
    let hasWorkerDetails: Bool
    let onSelect: (KioskEvent) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.callout.weight(.bold))
                .tracking(1.2)
                .foregroundStyle(Color.white.opacity(0.74))

            if events.isEmpty {
                Text("No events")
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(Color.white.opacity(0.30))
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.vertical, 2)
            } else {
                ForEach(events) { event in
                    KioskEventRow(event: event, hasWorkerDetails: hasWorkerDetails) {
                        onSelect(event)
                    }
                }
            }
        }
    }
}

private struct KioskEventRow: View {
    let event: KioskEvent
    let hasWorkerDetails: Bool
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 12) {
                Text(timeLabel)
                    .font(.subheadline.weight(.semibold).monospacedDigit())
                    .foregroundStyle(Color.white.opacity(0.88))
                    .frame(minWidth: 88, alignment: .leading)
                    .fixedSize()
                Text(event.title)
                    .font(.body.weight(.semibold))
                    .foregroundStyle(.white)
                    .lineLimit(1)
                    .minimumScaleFactor(0.85)
                Spacer()
                if !event.assignedUsers.isEmpty {
                    KioskEventAvatarStack(users: event.assignedUsers, totalCount: event.assignedUserCount)
                } else if event.shiftCount > 0, !hasWorkerDetails {
                    Text("Details pending")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(Color.white.opacity(0.58))
                } else if event.shiftCount > 0 {
                    KioskEventShiftBadge(count: event.shiftCount)
                }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .background(Color.white.opacity(0.075), in: RoundedRectangle(cornerRadius: 12))
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(Color.white.opacity(0.13), lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityHint("Opens event details")
    }

    private var timeLabel: String {
        if Calendar.current.isDateInToday(event.startsAt) {
            return event.startsAt.formatted(.dateTime.hour().minute())
        }
        return event.startsAt.formatted(.dateTime.weekday(.abbreviated).hour().minute())
    }
}

private struct KioskEventAvatarStack: View {
    let users: [KioskEvent.AssignedUser]
    let totalCount: Int

    var body: some View {
        HStack(spacing: -8) {
            ForEach(users.prefix(4)) { user in
                eventAvatar(for: user)
            }
            if totalCount > 4 {
                Text("+\(totalCount - 4)")
                    .font(.caption2.weight(.bold))
                    .foregroundStyle(.white)
                    .frame(width: 30, height: 30)
                    .background(Color.white.opacity(0.18), in: Circle())
                    .overlay(Circle().stroke(Color.black.opacity(0.8), lineWidth: 1.5))
            }
        }
        .accessibilityLabel("\(totalCount) assigned")
    }

    @ViewBuilder
    private func eventAvatar(for user: KioskEvent.AssignedUser) -> some View {
        if let urlString = user.avatarUrl, let url = URL(string: urlString) {
            AsyncImage(url: url) { phase in
                switch phase {
                case .success(let image):
                    image.resizable().scaledToFill()
                default:
                    eventInitials(for: user)
                }
            }
            .frame(width: 30, height: 30)
            .clipShape(Circle())
            .overlay(Circle().stroke(Color.black.opacity(0.8), lineWidth: 1.5))
        } else {
            eventInitials(for: user)
        }
    }

    private func eventInitials(for user: KioskEvent.AssignedUser) -> some View {
        Text(user.initials)
            .font(.caption2.weight(.bold))
            .foregroundStyle(.white)
            .frame(width: 30, height: 30)
            .background(Color.white.opacity(0.16), in: Circle())
            .overlay(Circle().stroke(Color.black.opacity(0.8), lineWidth: 1.5))
    }
}

private struct KioskEventDetailSheet: View {
    @Environment(\.dismiss) private var dismiss
    let event: KioskEvent
    let capabilities: KioskDashboard.Capabilities

    var body: some View {
        ZStack {
            KioskSurface.base.ignoresSafeArea()
            VStack(alignment: .leading, spacing: 18) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 8) {
                        HStack(spacing: 10) {
                            Text(eventDayLabel)
                                .font(.caption.weight(.bold))
                                .tracking(1.4)
                                .foregroundStyle(Color.white.opacity(0.55))
                            KioskEventShiftBadge(count: event.shiftCount)
                        }
                        Text(event.title)
                            .font(.title.weight(.heavy))
                            .foregroundStyle(.white)
                            .lineLimit(2)
                            .minimumScaleFactor(0.74)
                    }
                    Spacer()
                    Button("Done") { dismiss() }
                        .font(.headline.weight(.semibold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 10)
                        .background(Color.white.opacity(0.12), in: Capsule())
                }

                VStack(spacing: 10) {
                    KioskEventTimeRow(label: "Event", value: eventTimeLabel)
                    KioskEventTimeRow(label: "Call", value: callTimeLabel)
                }

                VStack(alignment: .leading, spacing: 10) {
                    HStack(spacing: 8) {
                        Text("Working")
                            .font(.title3.weight(.bold))
                            .foregroundStyle(.white)
                        if !event.assignedUsers.isEmpty {
                            Text("\(event.assignedUserCount)")
                                .font(.caption.weight(.bold).monospacedDigit())
                                .foregroundStyle(Color.white.opacity(0.58))
                                .padding(.horizontal, 8)
                                .padding(.vertical, 4)
                                .background(Color.white.opacity(0.08), in: Capsule())
                        }
                    }

                    if event.assignedUsers.isEmpty {
                        Text(workerEmptyMessage)
                            .font(.body.weight(.medium))
                            .foregroundStyle(Color.white.opacity(0.6))
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(16)
                            .background(Color.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 14))
                    } else {
                        ScrollView {
                            LazyVStack(spacing: 8) {
                                ForEach(event.assignedUsers) { user in
                                    KioskEventWorkerRow(user: user)
                                }
                            }
                        }
                        .scrollIndicators(.hidden)
                    }
                }

                Spacer(minLength: 0)
            }
            .padding(28)
        }
    }

    private var eventDayLabel: String {
        if Calendar.current.isDateInToday(event.startsAt) {
            return "Today"
        }
        if Calendar.current.isDateInTomorrow(event.startsAt) {
            return "Tomorrow"
        }
        return event.startsAt.formatted(.dateTime.weekday(.wide).month().day())
    }

    private var eventTimeLabel: String {
        formatRange(start: event.startsAt, end: event.endsAt)
    }

    private var callTimeLabel: String {
        guard capabilities.eventCallTimes else { return "Pending API" }
        guard let callStartsAt = event.callStartsAt else { return "Not set" }
        return formatRange(start: callStartsAt, end: event.callEndsAt)
    }

    private var workerEmptyMessage: String {
        if !capabilities.eventWorkerDetails, event.shiftCount > 0 {
            return "Worker details are not available from this API version yet."
        }
        return "No assigned workers listed yet."
    }

    private func formatRange(start: Date, end: Date?) -> String {
        let startLabel = start.formatted(.dateTime.hour().minute())
        guard let end else { return startLabel }
        return "\(startLabel) - \(end.formatted(.dateTime.hour().minute()))"
    }
}

private struct KioskEventTimeRow: View {
    let label: String
    let value: String

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 14) {
            Text(label.uppercased())
                .font(.caption2.weight(.bold))
                .tracking(1)
                .foregroundStyle(Color.white.opacity(0.5))
                .frame(width: 48, alignment: .leading)
            Text(value)
                .font(.title2.weight(.bold).monospacedDigit())
                .foregroundStyle(.white)
                .lineLimit(1)
                .minimumScaleFactor(0.72)
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 14)
        .padding(.vertical, 13)
        .background(Color.white.opacity(0.07), in: RoundedRectangle(cornerRadius: 14))
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .stroke(Color.white.opacity(0.12), lineWidth: 1)
        )
    }
}

private struct KioskEventShiftBadge: View {
    let count: Int

    var body: some View {
        Text("\(count) shift\(count == 1 ? "" : "s")")
            .font(.caption.weight(.semibold))
            .foregroundStyle(Color.white.opacity(0.62))
            .lineLimit(1)
            .padding(.horizontal, 9)
            .padding(.vertical, 5)
            .background(Color.white.opacity(0.08), in: Capsule())
    }
}

private struct KioskEventWorkerRow: View {
    let user: KioskEvent.AssignedUser

    var body: some View {
        HStack(spacing: 10) {
            avatar
            VStack(alignment: .leading, spacing: 2) {
                Text(user.name)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.white)
                    .lineLimit(1)
                if let detail = workerDetail {
                    Text(detail)
                        .font(.caption.weight(.medium))
                        .foregroundStyle(Color.white.opacity(0.62))
                        .lineLimit(1)
                        .minimumScaleFactor(0.82)
                }
            }
            Spacer()
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(Color.white.opacity(0.07), in: RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color.white.opacity(0.12), lineWidth: 1)
        )
    }

    private var avatar: some View {
        KioskAvatar(url: user.avatarUrl, initials: user.initials, size: 38)
    }

    private var workerDetail: String? {
        let area = user.area?.capitalized
        guard let callStartsAt = user.callStartsAt else { return area }
        let callLabel = formatRange(start: callStartsAt, end: user.callEndsAt)
        if let area {
            return "\(area) · \(callLabel)"
        }
        return callLabel
    }

    private func formatRange(start: Date, end: Date?) -> String {
        let startLabel = start.formatted(.dateTime.hour().minute())
        guard let end else { return startLabel }
        return "\(startLabel) - \(end.formatted(.dateTime.hour().minute()))"
    }
}

private struct CheckoutRow: View {
    let checkout: KioskActiveCheckout

    var body: some View {
        HStack {
            // Real avatar when available; falls back to the existing initials
            // disc on missing/failed loads. Overdue ring stays as the visual
            // signal regardless of which path renders.
            ZStack {
                Circle()
                    .fill(checkout.isOverdue ? Color.kioskRed.opacity(0.3) : Color.white.opacity(0.1))
                    .frame(width: 36, height: 36)
                avatarInitialsLayer
            }

            VStack(alignment: .leading, spacing: 2) {
                Text(checkout.title)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.white)
                Text(itemSummary)
                    .font(.caption)
                    .foregroundStyle(Color.white.opacity(0.64))
                    .lineLimit(1)
                    .minimumScaleFactor(0.85)
            }
            Spacer()
            if checkout.isOverdue {
                Image(systemName: "exclamationmark.triangle.fill")
                    .foregroundStyle(Color.statusText(.red))
                    .font(.caption)
                    .accessibilityLabel("Overdue")
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(Color.white.opacity(0.07), in: RoundedRectangle(cornerRadius: 10))
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .stroke(Color.white.opacity(0.11), lineWidth: 1)
        )
        .accessibilityElement(children: .combine)
        .accessibilityLabel(accessibilitySummary)
    }

    @ViewBuilder
    private var avatarInitialsLayer: some View {
        if let urlString = checkout.requesterAvatarUrl, let url = URL(string: urlString) {
            AsyncImage(url: url) { phase in
                switch phase {
                case .success(let image):
                    image.resizable().scaledToFill()
                default:
                    initialsBubble
                }
            }
            .frame(width: 36, height: 36)
            .clipShape(Circle())
        } else {
            initialsBubble
        }
    }

    private var initialsBubble: some View {
        Text(checkout.requesterInitials)
            .font(.caption.bold())
            .foregroundStyle(.white)
    }

    private var itemSummary: String {
        let names = checkout.items.prefix(2).map(\.name)
        let head = names.joined(separator: ", ")
        let extra = checkout.itemCount - names.count
        if extra > 0, !head.isEmpty {
            return "\(head) · +\(extra) more"
        }
        return head
    }

    private var accessibilitySummary: String {
        let prefix = checkout.isOverdue ? "Overdue: " : ""
        return "\(prefix)\(checkout.title), \(itemSummary)"
    }
}

/// First name when unique in the visible roster, "First L." when another
/// user shares the same first name. Prevents misclick attribution.
private func disambiguatedLabels(for users: [KioskUser]) -> [String: String] {
    var firstNameCounts: [String: Int] = [:]
    for user in users {
        let first = user.name.components(separatedBy: " ").first ?? user.name
        firstNameCounts[first.lowercased(), default: 0] += 1
    }
    var result: [String: String] = [:]
    for user in users {
        let parts = user.name.components(separatedBy: " ").filter { !$0.isEmpty }
        let first = parts.first ?? user.name
        if firstNameCounts[first.lowercased(), default: 0] > 1, let last = parts.dropFirst().last,
           let lastInitial = last.first {
            result[user.id] = "\(first) \(lastInitial)."
        } else {
            result[user.id] = first
        }
    }
    return result
}

private struct UserTile: View {
    let user: KioskUser
    let displayName: String
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            VStack(spacing: 7) {
                avatar
                Text(displayName)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.white)
                    .lineLimit(1)
                    .multilineTextAlignment(.center)
                    .minimumScaleFactor(0.74)
            }
            .frame(maxWidth: .infinity)
            .frame(minHeight: 92)
            .padding(.horizontal, 8)
            .padding(.vertical, 10)
            .background(Color.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 12))
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(Color.white.opacity(0.16), lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(user.name)
        .accessibilityHint("Tap to start checkout for \(user.name)")
    }

    private var avatar: some View {
        KioskAvatar(url: user.avatarUrl, initials: user.initials, size: 42)
    }
}

private struct KioskSleepModeView: View {
    let deviceName: String
    let reason: String
    let onWake: () -> Void

    var body: some View {
        TimelineView(.periodic(from: .now, by: 30)) { context in
            ZStack {
                Color.black.ignoresSafeArea()
                VStack(alignment: .leading, spacing: 8) {
                    Text(context.date.kioskClockParts().time)
                        .font(.gothamBlack(size: 58))
                        .foregroundStyle(Color.white.opacity(0.18))
                        .lineLimit(1)
                        .minimumScaleFactor(0.6)
                    Text(sleepLabel)
                        .font(.gothamBold(size: 15))
                        .tracking(1.2)
                        .foregroundStyle(Color.white.opacity(0.13))
                        .textCase(.uppercase)
                    Text(deviceName)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(Color.white.opacity(0.1))
                }
                .offset(pixelShiftOffset(for: context.date))
                .accessibilityElement(children: .combine)
                .accessibilityLabel("Kiosk sleep mode. Tap to wake.")
            }
            .contentShape(Rectangle())
            .onTapGesture { onWake() }
        }
    }

    private var sleepLabel: String {
        if reason == "debug_night_mode" { return "Debug night mode" }
        return reason == "night_hours" ? "Night sleep mode" : "Idle sleep mode"
    }

    private func pixelShiftOffset(for date: Date) -> CGSize {
        let components = Calendar.current.dateComponents([.minute, .second], from: date)
        let minute = components.minute ?? 0
        let second = components.second ?? 0
        let slot = (minute * 2) + (second >= 30 ? 1 : 0)
        let x = CGFloat((slot % 9) - 4) * 38
        let y = CGFloat(((slot / 9) % 7) - 3) * 28
        return CGSize(width: x, height: y)
    }
}

// MARK: - Freshness label

private extension Date {
    func kioskClockParts() -> (time: String, seconds: String, meridiem: String) {
        let components = Calendar.current.dateComponents([.hour, .minute, .second], from: self)
        let rawHour = components.hour ?? 0
        let hour = rawHour % 12 == 0 ? 12 : rawHour % 12
        let minute = components.minute ?? 0
        let second = components.second ?? 0
        let meridiem = rawHour < 12 ? "AM" : "PM"
        return (
            time: "\(hour):\(String(format: "%02d", minute))",
            seconds: String(format: ":%02d", second),
            meridiem: meridiem
        )
    }

    /// Compact "Just now / Xs ago / Xm ago" string for the kiosk header
    /// freshness stamp. iOS's `RelativeDateTimeFormatter` is overkill for
    /// the sub-minute range; this matches the rest of the app's gear-shift
    /// vocabulary at small sizes.
    func kioskFreshnessLabel(now: Date) -> String {
        let seconds = max(0, now.timeIntervalSince(self))
        if seconds < 5 { return "just now" }
        if seconds < 60 { return "\(Int(seconds))s ago" }
        let minutes = Int(seconds / 60)
        if minutes < 60 { return "\(minutes)m ago" }
        let hours = minutes / 60
        return "\(hours)h ago"
    }
}
