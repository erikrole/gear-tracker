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
    @State private var selectedCheckout: KioskCheckoutDrawerContext?
    @State private var rosterLetter: Character?
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
                                .background(KioskSurface.placeholder)

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

                // Only capture Wiscard scans when the roster is actually the
                // active surface. While a detail sheet is open or the kiosk is
                // asleep, unmount the hidden HID field so it can't swallow input
                // or fight a presented view for first responder.
                if !isScannerPaused {
                    KioskScannerField { value in
                        handleIdentityScan(value)
                    }
                    .frame(width: 1, height: 1)
                    .opacity(0)
                }
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
        .sheet(item: $selectedCheckout) { context in
            KioskCheckoutDetailSheet(context: context)
                .presentationDetents([.height(520), .large])
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

    /// Pause Wiscard capture while a detail sheet is open or the kiosk is
    /// asleep — those surfaces own the screen and the hidden field should not
    /// be grabbing keystrokes or first responder underneath them.
    private var isScannerPaused: Bool {
        selectedEvent != nil || selectedCheckout != nil || shouldShowSleepMode
    }

    /// The last refresh hit a failure (and we have no fresh data to mask it).
    private var hasConnectionIssue: Bool {
        loadFailedAt != nil
    }

    /// Connection health for the quiet status dot: green when a refresh landed
    /// recently, orange when the data is going stale, red when refreshes fail.
    private var connectionTone: Color {
        if hasConnectionIssue { return Color.statusText(.red) }
        if isStale { return Color.statusText(.orange) }
        return Color.statusText(.green)
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
                    .foregroundStyle(KioskText.secondary)
                if let location = store.info?.locationName {
                    Text("•")
                        .foregroundStyle(KioskText.muted)
                    Text(location)
                        .font(.callout.weight(.semibold))
                        .foregroundStyle(KioskText.secondary)
                }
                Spacer(minLength: 8)
                kioskHealthDot
            }

            if hasConnectionIssue {
                connectionBanner
            }

            TimelineView(.periodic(from: .now, by: 1)) { context in
                VStack(alignment: .leading, spacing: 4) {
                    KioskClockView(date: context.date)
                    Text(context.date, format: .dateTime.weekday(.wide).month(.wide).day())
                        .font(.gothamBold(size: 32))
                        .foregroundStyle(KioskText.primary)
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
                    ) { toggleSummary(.itemsOut) }
                    StatTile(
                        value: stats.checkouts,
                        label: "Checkouts",
                        accent: .white,
                        isSelected: selectedSummary == .checkouts,
                        reduceMotion: reduceMotion
                    ) { toggleSummary(.checkouts) }
                    StatTile(
                        value: stats.overdue,
                        label: "Overdue",
                        accent: stats.overdue > 0 ? Color.statusText(.red) : .white,
                        isSelected: selectedSummary == .overdue,
                        reduceMotion: reduceMotion
                    ) { toggleSummary(.overdue) }
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
                        .foregroundStyle(KioskText.primary)
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
                    .foregroundStyle(isStale ? Color.statusText(.orange) : KioskText.tertiary)
                    .monospacedDigit()
            }
        }
    }

    private var isStale: Bool {
        guard let last = lastLoadedAt else { return false }
        return Date().timeIntervalSince(last) > 300
    }

    /// Quiet at-a-glance signal for staff that the kiosk is up and talking to
    /// the server — green/online, orange/stale, red/offline.
    private var kioskHealthDot: some View {
        HStack(spacing: 6) {
            Circle()
                .fill(connectionTone)
                .frame(width: 8, height: 8)
            Text(hasConnectionIssue ? "Offline" : (isStale ? "Stale" : "Active"))
                .font(.caption2.weight(.bold))
                .tracking(0.6)
                .foregroundStyle(KioskText.tertiary)
                .textCase(.uppercase)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Kiosk \(hasConnectionIssue ? "offline" : (isStale ? "data stale" : "active and online"))")
    }

    private var connectionBanner: some View {
        HStack(spacing: 10) {
            Image(systemName: "wifi.exclamationmark")
                .foregroundStyle(Color.statusText(.orange))
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 1) {
                Text("Can't reach the server")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(KioskText.primary)
                if let last = lastLoadedAt {
                    Text("Showing data from \(last.kioskFreshnessLabel(now: Date()))")
                        .font(.caption2)
                        .foregroundStyle(KioskText.muted)
                } else {
                    Text("No data loaded yet")
                        .font(.caption2)
                        .foregroundStyle(KioskText.muted)
                }
            }
            Spacer()
            Button {
                Task { await loadAll() }
            } label: {
                Text(isLoading ? "Retrying…" : "Retry")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(KioskText.primary)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 8)
                    .background(Color.kioskRed.opacity(0.85), in: Capsule())
            }
            .buttonStyle(.plain)
            .disabled(isLoading)
            .accessibilityLabel("Retry loading kiosk data")
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .background(Color.statusText(.orange).opacity(0.12), in: RoundedRectangle(cornerRadius: KioskRadius.md))
        .overlay(
            RoundedRectangle(cornerRadius: KioskRadius.md)
                .stroke(Color.statusText(.orange).opacity(0.4), lineWidth: 1)
        )
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Can't reach the server. \(lastLoadedAt != nil ? "Showing cached data." : "No data yet.") Retry available.")
    }

    // MARK: - Roster Panel

    private var rosterPanel: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(spacing: 14) {
                Image(systemName: "barcode.viewfinder")
                    .font(.system(size: 34, weight: .semibold))
                    .foregroundStyle(Color.kioskRed)
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 4) {
                    Text("Scan Wiscard")
                        .font(.title2.bold())
                        .foregroundStyle(KioskText.primary)
                    Text("Or tap your name below")
                        .font(.subheadline)
                        .foregroundStyle(KioskText.tertiary)
                }
            }

            if let feedback = identityScanFeedback {
                KioskFeedbackBanner(tone: feedback.tone, message: feedback.message)
                    .transition(.move(edge: .top).combined(with: .opacity))
            }

            if users.isEmpty && isLoading {
                rosterSkeleton
            } else {
                if showsLetterFilter {
                    rosterLetterFilter
                }
                let labels = disambiguatedLabels(for: users)
                ScrollView {
                    LazyVGrid(columns: rosterColumns, spacing: 10) {
                        ForEach(filteredUsers) { user in
                            UserTile(user: user, displayName: labels[user.id] ?? user.name) {
                                store.screen = .studentHub(user)
                            }
                        }
                    }
                }
            }
        }
    }

    /// First letters present in the roster, for the A–Z quick filter.
    private var rosterLetters: [Character] {
        let set = Set(users.compactMap { user -> Character? in
            guard let first = user.name.trimmingCharacters(in: .whitespaces).first else { return nil }
            return Character(first.uppercased())
        })
        return set.sorted()
    }

    /// Only worth showing the filter once the grid is big enough to hunt through.
    private var showsLetterFilter: Bool {
        users.count > 12 && rosterLetters.count > 1
    }

    private var filteredUsers: [KioskUser] {
        guard let rosterLetter else { return users }
        let matches = users.filter {
            $0.name.trimmingCharacters(in: .whitespaces).first?.uppercased().first == rosterLetter
        }
        // A stale selection (roster changed on refresh) falls back to everyone.
        return matches.isEmpty ? users : matches
    }

    private var rosterLetterFilter: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 6) {
                letterChip(title: "All", isSelected: rosterLetter == nil) { rosterLetter = nil }
                ForEach(rosterLetters, id: \.self) { letter in
                    letterChip(title: String(letter), isSelected: rosterLetter == letter) {
                        rosterLetter = (rosterLetter == letter) ? nil : letter
                        store.resetInactivity()
                    }
                }
            }
            .padding(.vertical, 2)
        }
        .scrollIndicators(.hidden)
        .accessibilityLabel("Filter roster by first letter")
    }

    private func letterChip(title: String, isSelected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(.subheadline.weight(.bold))
                .foregroundStyle(isSelected ? .white : KioskText.secondary)
                .frame(minWidth: 38, minHeight: 38)
                .background(
                    isSelected ? Color.kioskRed : KioskSurface.cardRaised,
                    in: RoundedRectangle(cornerRadius: KioskRadius.sm)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: KioskRadius.sm)
                        .stroke(isSelected ? Color.clear : KioskStroke.standard, lineWidth: 1)
                )
        }
        .buttonStyle(KioskPressStyle())
        .accessibilityLabel(title == "All" ? "Show all names" : "Names starting with \(title)")
        .accessibilityAddTraits(isSelected ? [.isSelected] : [])
    }

    private var rosterSkeleton: some View {
        ScrollView {
            LazyVGrid(columns: rosterColumns, spacing: 10) {
                ForEach(0..<9, id: \.self) { _ in
                    KioskSkeletonBox(cornerRadius: KioskRadius.md)
                        .frame(height: 92)
                }
            }
        }
        .scrollDisabled(true)
        .accessibilityLabel("Loading roster")
    }

    private var rosterColumns: [GridItem] {
        if dynamicTypeSize.isAccessibilitySize {
            return [GridItem(.flexible(minimum: 150), spacing: 10)]
        }
        return [GridItem(.adaptive(minimum: 112, maximum: 148), spacing: 10)]
    }

    private func toggleSummary(_ summary: KioskSummarySelection) {
        selectedSummary = selectedSummary == summary ? .events : summary
        store.resetInactivity()
    }

    @ViewBuilder
    private var dashboardDetailPanel: some View {
        if let dashboard {
            switch selectedSummary {
            case .events:
                EmptyView()
            case .itemsOut:
                let itemGroups = ActiveItemGroup.groups(from: dashboard.activeItems)
                KioskDashboardList(title: "Items Out", emptyMessage: "No items are out.", isEmpty: dashboard.activeItems.isEmpty, onClose: { toggleSummary(.itemsOut) }) {
                    ForEach(itemGroups) { group in
                        ActiveItemRow(group: group) { openCheckout(id: group.first.checkoutId, title: group.first.checkoutTitle, requesterName: group.first.requesterName, requesterAvatarUrl: group.first.requesterAvatarUrl, endsAt: group.first.endsAt, isOverdue: group.first.isOverdue) }
                    }
                }
            case .checkouts:
                KioskDashboardList(title: "Active Checkouts", emptyMessage: "No active checkouts.", isEmpty: dashboard.checkouts.isEmpty, onClose: { toggleSummary(.checkouts) }) {
                    ForEach(dashboard.checkouts) { checkout in
                        CheckoutRow(checkout: checkout) { openCheckout(checkout) }
                    }
                }
            case .overdue:
                let overdueCheckouts = dashboard.checkouts.filter(\.isOverdue)
                KioskDashboardList(title: "Overdue", emptyMessage: "No overdue checkouts.", isEmpty: overdueCheckouts.isEmpty, onClose: { toggleSummary(.overdue) }) {
                    ForEach(overdueCheckouts) { checkout in
                        CheckoutRow(checkout: checkout) { openCheckout(checkout) }
                    }
                }
            }
        }
    }

    private func openCheckout(_ checkout: KioskActiveCheckout) {
        openCheckout(
            id: checkout.id,
            title: checkout.title,
            requesterName: checkout.requesterName,
            requesterAvatarUrl: checkout.requesterAvatarUrl,
            endsAt: checkout.endsAt,
            isOverdue: checkout.isOverdue
        )
    }

    private func openCheckout(id: String, title: String, requesterName: String, requesterAvatarUrl: String?, endsAt: Date, isOverdue: Bool) {
        selectedCheckout = KioskCheckoutDrawerContext(
            checkoutId: id,
            title: title,
            requesterName: requesterName,
            requesterAvatarUrl: requesterAvatarUrl,
            endsAt: endsAt,
            isOverdue: isOverdue
        )
        store.resetInactivity()
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
            .foregroundStyle(KioskText.primary)
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
                    .foregroundStyle(KioskText.secondary)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 22)
            .background((isSelected ? KioskSurface.cardSelected : KioskSurface.cardRaised), in: RoundedRectangle(cornerRadius: KioskRadius.xl))
            .overlay(
                RoundedRectangle(cornerRadius: KioskRadius.xl)
                    .stroke(isSelected ? KioskStroke.selected : KioskStroke.standard, lineWidth: isSelected ? 2 : 1)
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
        .buttonStyle(KioskPressStyle())
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
                .foregroundStyle(KioskText.muted)
            Text(label.uppercased())
                .font(.caption.weight(.semibold))
                .tracking(0.8)
                .foregroundStyle(KioskText.tertiary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 22)
        .background(KioskSurface.low, in: RoundedRectangle(cornerRadius: KioskRadius.xl))
        .overlay(
            RoundedRectangle(cornerRadius: KioskRadius.xl)
                .stroke(KioskStroke.divider, lineWidth: 1)
        )
        .accessibilityHidden(true)
    }
}

private struct KioskDashboardList<Content: View>: View {
    let title: String
    let emptyMessage: String
    let isEmpty: Bool
    var onClose: (() -> Void)?
    let content: Content

    init(title: String, emptyMessage: String, isEmpty: Bool, onClose: (() -> Void)? = nil, @ViewBuilder content: () -> Content) {
        self.title = title
        self.emptyMessage = emptyMessage
        self.isEmpty = isEmpty
        self.onClose = onClose
        self.content = content()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text(title)
                    .font(.callout.weight(.bold))
                    .foregroundStyle(KioskText.secondary)
                Spacer()
                if let onClose {
                    Button(action: onClose) {
                        Image(systemName: "xmark.circle.fill")
                            .font(.body)
                            .foregroundStyle(KioskText.muted)
                            .frame(width: 44, height: 44)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Close \(title)")
                }
            }

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
                        .foregroundStyle(KioskText.secondary)
                        .frame(maxWidth: .infinity, minHeight: 62)
                }
            }
        }
        .padding(12)
        .background(KioskSurface.low, in: RoundedRectangle(cornerRadius: KioskRadius.lg))
        .overlay(
            RoundedRectangle(cornerRadius: KioskRadius.lg)
                .stroke(KioskStroke.divider, lineWidth: 1)
        )
    }
}

/// Groups the flat active-item list so a holder's numbered battery units
/// collapse into one row with unit chips, mirroring the checkout cart.
/// Units are keyed by SKU *and* checkout so two students holding the same
/// battery type stay on separate rows.
private struct ActiveItemGroup: Identifiable {
    let id: String
    var items: [KioskDashboard.ActiveItem]

    var first: KioskDashboard.ActiveItem { items[0] }
    var isBulkGroup: Bool { first.isNumberedBulk }
    var count: Int { items.count }
    var isOverdue: Bool { first.isOverdue }
    var unitNumbers: [Int] { items.compactMap(\.unitNumber).sorted() }

    var title: String {
        guard isBulkGroup else { return first.name }
        return first.name.replacingOccurrences(of: #" #\d+$"#, with: "", options: .regularExpression)
    }

    static func groups(from items: [KioskDashboard.ActiveItem]) -> [ActiveItemGroup] {
        var groups: [ActiveItemGroup] = []
        var bulkIndex: [String: Int] = [:]
        for item in items {
            if item.isNumberedBulk, let bulkSkuId = item.bulkSkuId {
                let key = "bulk-\(bulkSkuId)-\(item.checkoutId)"
                if let index = bulkIndex[key] {
                    groups[index].items.append(item)
                } else {
                    bulkIndex[key] = groups.count
                    groups.append(ActiveItemGroup(id: key, items: [item]))
                }
            } else {
                groups.append(ActiveItemGroup(id: item.id, items: [item]))
            }
        }
        return groups
    }
}

private struct ActiveItemRow: View {
    let group: ActiveItemGroup
    let onTap: () -> Void
    private var item: KioskDashboard.ActiveItem { group.first }

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 10) {
                assetImage
                VStack(alignment: .leading, spacing: 3) {
                    HStack(spacing: 6) {
                        Text(group.title)
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(KioskText.primary)
                            .lineLimit(1)
                            .minimumScaleFactor(0.85)
                        if group.count > 1 {
                            Text("x\(group.count)")
                                .font(.caption2.weight(.bold))
                                .foregroundStyle(Color.kioskRed)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(Color.kioskRed.opacity(0.16), in: Capsule())
                        }
                    }

                    if group.isBulkGroup, !group.unitNumbers.isEmpty {
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 4) {
                                ForEach(group.unitNumbers, id: \.self) { unitNumber in
                                    Text("#\(unitNumber)")
                                        .font(.caption2.monospacedDigit().weight(.semibold))
                                        .foregroundStyle(KioskText.secondary)
                                        .padding(.horizontal, 6)
                                        .padding(.vertical, 3)
                                        .background(KioskSurface.placeholder, in: Capsule())
                                }
                            }
                        }
                    } else {
                        Text("\(item.tagName) · \(item.checkoutTitle)")
                            .font(.caption)
                            .foregroundStyle(KioskText.secondary)
                            .lineLimit(1)
                            .minimumScaleFactor(0.8)
                    }
                }
                Spacer(minLength: 6)
                KioskAvatar(url: item.requesterAvatarUrl, initials: item.requesterInitials, size: 30)
                    .accessibilityHidden(true)
                if group.isOverdue {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .foregroundStyle(Color.statusText(.red))
                        .font(.caption)
                        .accessibilityLabel("Overdue")
                }
                Image(systemName: "chevron.right")
                    .font(.caption2.weight(.bold))
                    .foregroundStyle(KioskText.muted)
                    .accessibilityHidden(true)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .background(KioskSurface.cardRaised, in: RoundedRectangle(cornerRadius: KioskRadius.sm))
            .overlay(
                RoundedRectangle(cornerRadius: KioskRadius.sm)
                    .stroke(KioskStroke.standard, lineWidth: 1)
            )
        }
        .buttonStyle(KioskPressStyle())
        .accessibilityElement(children: .combine)
        .accessibilityLabel(accessibilityLabel)
        .accessibilityHint("Opens checkout details")
    }

    private var accessibilityLabel: String {
        let prefix = group.isOverdue ? "Overdue: " : ""
        let what: String
        if group.isBulkGroup {
            let units = group.unitNumbers.map { "#\($0)" }.joined(separator: ", ")
            what = "\(group.title), \(group.count) unit\(group.count == 1 ? "" : "s"), \(units)"
        } else {
            what = "\(group.title), \(item.tagName)"
        }
        return "\(prefix)\(what), held by \(item.requesterName) for \(item.checkoutTitle)"
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
            .clipShape(RoundedRectangle(cornerRadius: KioskRadius.sm))
        } else {
            fallbackAssetImage
        }
    }

    private var fallbackAssetImage: some View {
        RoundedRectangle(cornerRadius: KioskRadius.sm)
            .fill(KioskSurface.placeholder)
            .frame(width: 42, height: 42)
            .overlay {
                Image(systemName: item.isNumberedBulk ? "battery.100percent" : "camera.fill")
                    .font(.caption)
                    .foregroundStyle(KioskText.secondary)
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
                .foregroundStyle(KioskText.secondary)

            if events.isEmpty {
                Text("No events")
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(KioskText.muted)
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
                    .foregroundStyle(KioskText.primary)
                    .frame(minWidth: 88, alignment: .leading)
                    .fixedSize()
                Text(event.title)
                    .font(.body.weight(.semibold))
                    .foregroundStyle(KioskText.primary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.85)
                Spacer()
                if !event.assignedUsers.isEmpty {
                    KioskEventAvatarStack(users: event.assignedUsers, totalCount: event.assignedUserCount)
                } else if event.shiftCount > 0, !hasWorkerDetails {
                    Text("Details pending")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(KioskText.tertiary)
                } else if event.shiftCount > 0 {
                    KioskEventShiftBadge(count: event.shiftCount)
                }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .background(KioskSurface.cardRaised, in: RoundedRectangle(cornerRadius: KioskRadius.md))
            .overlay(
                RoundedRectangle(cornerRadius: KioskRadius.md)
                    .stroke(KioskStroke.standard, lineWidth: 1)
            )
        }
        .buttonStyle(KioskPressStyle())
        .accessibilityElement(children: .combine)
        .accessibilityHint("Opens event details")
    }

    private var timeLabel: String {
        if event.allDay {
            return "All day"
        }
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
                    .foregroundStyle(KioskText.primary)
                    .frame(width: 30, height: 30)
                    .background(KioskSurface.placeholder, in: Circle())
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
            .foregroundStyle(KioskText.primary)
            .frame(width: 30, height: 30)
            .background(KioskSurface.placeholder, in: Circle())
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
                                .foregroundStyle(KioskText.tertiary)
                            KioskEventShiftBadge(count: event.shiftCount)
                        }
                        Text(event.title)
                            .font(.title.weight(.heavy))
                            .foregroundStyle(KioskText.primary)
                            .lineLimit(2)
                            .minimumScaleFactor(0.74)
                    }
                    Spacer()
                    Button("Done") { dismiss() }
                        .font(.headline.weight(.semibold))
                        .foregroundStyle(KioskText.primary)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 10)
                        .background(KioskSurface.cardSelected, in: Capsule())
                }

                VStack(spacing: 10) {
                    KioskEventTimeRow(label: "Event", value: eventTimeLabel)
                    if !event.allDay {
                        KioskEventTimeRow(label: "Call", value: callTimeLabel)
                    }
                }

                VStack(alignment: .leading, spacing: 10) {
                    HStack(spacing: 8) {
                        Text("Working")
                            .font(.title3.weight(.bold))
                            .foregroundStyle(KioskText.primary)
                        if !event.assignedUsers.isEmpty {
                            Text("\(event.assignedUserCount)")
                                .font(.caption.weight(.bold).monospacedDigit())
                                .foregroundStyle(KioskText.tertiary)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 4)
                                .background(KioskSurface.cardRaised, in: Capsule())
                        }
                    }

                    if event.assignedUsers.isEmpty {
                        Text(workerEmptyMessage)
                            .font(.body.weight(.medium))
                            .foregroundStyle(KioskText.secondary)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(16)
                            .background(KioskSurface.card, in: RoundedRectangle(cornerRadius: KioskRadius.lg))
                    } else {
                        ScrollView {
                            LazyVStack(spacing: 8) {
                                ForEach(event.assignedUsers) { user in
                                    KioskEventWorkerRow(user: user, eventAllDay: event.allDay)
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
        if event.allDay {
            return allDayDateLabel
        }
        return formatRange(start: event.startsAt, end: event.endsAt)
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

    private var allDayDateLabel: String {
        guard let end = event.endsAt else {
            return event.startsAt.formatted(.dateTime.month(.abbreviated).day())
        }
        let inclusiveEnd = end.addingTimeInterval(-1)
        if Calendar.current.isDate(event.startsAt, inSameDayAs: inclusiveEnd) {
            return event.startsAt.formatted(.dateTime.month(.abbreviated).day())
        }
        return "\(event.startsAt.formatted(.dateTime.month(.abbreviated).day())) - \(inclusiveEnd.formatted(.dateTime.month(.abbreviated).day()))"
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
                .foregroundStyle(KioskText.tertiary)
                .frame(width: 48, alignment: .leading)
            Text(value)
                .font(.title2.weight(.bold).monospacedDigit())
                .foregroundStyle(KioskText.primary)
                .lineLimit(1)
                .minimumScaleFactor(0.72)
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 14)
        .padding(.vertical, 13)
        .background(KioskSurface.cardRaised, in: RoundedRectangle(cornerRadius: KioskRadius.lg))
        .overlay(
            RoundedRectangle(cornerRadius: KioskRadius.lg)
                .stroke(KioskStroke.standard, lineWidth: 1)
        )
    }
}

private struct KioskEventShiftBadge: View {
    let count: Int

    var body: some View {
        Text("\(count) shift\(count == 1 ? "" : "s")")
            .font(.caption.weight(.semibold))
            .foregroundStyle(KioskText.secondary)
            .lineLimit(1)
            .padding(.horizontal, 9)
            .padding(.vertical, 5)
            .background(KioskSurface.cardRaised, in: Capsule())
    }
}

private struct KioskEventWorkerRow: View {
    let user: KioskEvent.AssignedUser
    let eventAllDay: Bool

    var body: some View {
        HStack(spacing: 10) {
            avatar
            VStack(alignment: .leading, spacing: 2) {
                Text(user.name)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(KioskText.primary)
                    .lineLimit(1)
                if let detail = workerDetail {
                    Text(detail)
                        .font(.caption.weight(.medium))
                        .foregroundStyle(KioskText.secondary)
                        .lineLimit(1)
                        .minimumScaleFactor(0.82)
                }
            }
            Spacer()
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(KioskSurface.cardRaised, in: RoundedRectangle(cornerRadius: KioskRadius.md))
        .overlay(
            RoundedRectangle(cornerRadius: KioskRadius.md)
                .stroke(KioskStroke.standard, lineWidth: 1)
        )
    }

    private var avatar: some View {
        KioskAvatar(url: user.avatarUrl, initials: user.initials, size: 38)
    }

    private var workerDetail: String? {
        let area = user.area?.capitalized
        if eventAllDay {
            return area
        }
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
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack {
                // Real avatar when available; falls back to the existing initials
                // disc on missing/failed loads. Overdue ring stays as the visual
                // signal regardless of which path renders.
                ZStack {
                    Circle()
                        .fill(checkout.isOverdue ? Color.kioskRed.opacity(0.3) : KioskSurface.cardRaised)
                        .frame(width: 36, height: 36)
                    avatarInitialsLayer
                }

                VStack(alignment: .leading, spacing: 2) {
                    Text(checkout.title)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(KioskText.primary)
                    Text(itemSummary)
                        .font(.caption)
                        .foregroundStyle(KioskText.secondary)
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
                Image(systemName: "chevron.right")
                    .font(.caption2.weight(.bold))
                    .foregroundStyle(KioskText.muted)
                    .accessibilityHidden(true)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .background(KioskSurface.cardRaised, in: RoundedRectangle(cornerRadius: KioskRadius.sm))
            .overlay(
                RoundedRectangle(cornerRadius: KioskRadius.sm)
                    .stroke(KioskStroke.standard, lineWidth: 1)
            )
        }
        .buttonStyle(KioskPressStyle())
        .accessibilityElement(children: .combine)
        .accessibilityLabel(accessibilitySummary)
        .accessibilityHint("Opens checkout details")
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
            .foregroundStyle(KioskText.primary)
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

// MARK: - Checkout Detail Drawer

/// Lightweight context captured from the tapped row so the drawer can render
/// its header (who/what/when) immediately while the item list loads.
private struct KioskCheckoutDrawerContext: Identifiable {
    let checkoutId: String
    let title: String
    let requesterName: String
    let requesterAvatarUrl: String?
    let endsAt: Date
    let isOverdue: Bool

    var id: String { checkoutId }

    var requesterInitials: String {
        requesterName.split(separator: " ").prefix(2)
            .compactMap { $0.first }
            .map { String($0) }
            .joined()
            .uppercased()
    }
}

private struct KioskCheckoutDetailSheet: View {
    @Environment(\.dismiss) private var dismiss
    let context: KioskCheckoutDrawerContext

    @State private var detail: KioskCheckoutDetail?
    @State private var isLoading = true
    @State private var loadError: String?

    private struct ItemGroup: Identifiable {
        let id: String
        var items: [KioskCheckoutDetail.ReturnItem]
        var first: KioskCheckoutDetail.ReturnItem { items[0] }
        var isBulkGroup: Bool { first.isNumberedBulk }
        var count: Int { items.count }
        var title: String {
            guard isBulkGroup else { return first.name }
            return (first.bulkSkuName ?? first.name)
                .replacingOccurrences(of: #" #\d+$"#, with: "", options: .regularExpression)
        }
        var unitNumbers: [Int] { items.compactMap(\.unitNumber).sorted() }
        var returnedCount: Int { items.filter(\.returned).count }
    }

    private var groups: [ItemGroup] {
        guard let items = detail?.items else { return [] }
        var groups: [ItemGroup] = []
        var bulkIndex: [String: Int] = [:]
        for item in items {
            if item.isNumberedBulk, let bulkSkuId = item.bulkSkuId {
                if let index = bulkIndex[bulkSkuId] {
                    groups[index].items.append(item)
                } else {
                    bulkIndex[bulkSkuId] = groups.count
                    groups.append(ItemGroup(id: "bulk-\(bulkSkuId)", items: [item]))
                }
            } else {
                groups.append(ItemGroup(id: item.id, items: [item]))
            }
        }
        return groups
    }

    var body: some View {
        ZStack {
            KioskSurface.base.ignoresSafeArea()
            VStack(alignment: .leading, spacing: 18) {
                header

                timingRow

                VStack(alignment: .leading, spacing: 10) {
                    Text("Items")
                        .font(.title3.weight(.bold))
                        .foregroundStyle(KioskText.primary)

                    if isLoading {
                        ProgressView().tint(KioskText.primary)
                            .frame(maxWidth: .infinity, minHeight: 80)
                    } else if let loadError {
                        KioskErrorState(title: loadError) { Task { await load() } }
                    } else {
                        ScrollView {
                            LazyVStack(spacing: 8) {
                                ForEach(groups) { group in
                                    itemRow(group)
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
        .task { await load() }
    }

    private var header: some View {
        HStack(alignment: .top, spacing: 14) {
            KioskAvatar(url: context.requesterAvatarUrl, initials: context.requesterInitials, size: 48)
            VStack(alignment: .leading, spacing: 4) {
                Text(context.title)
                    .font(.title2.weight(.heavy))
                    .foregroundStyle(KioskText.primary)
                    .lineLimit(2)
                    .minimumScaleFactor(0.78)
                Text(context.requesterName)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(KioskText.secondary)
            }
            Spacer()
            Button("Done") { dismiss() }
                .font(.headline.weight(.semibold))
                .foregroundStyle(KioskText.primary)
                .padding(.horizontal, 16)
                .padding(.vertical, 10)
                .background(KioskSurface.cardSelected, in: Capsule())
        }
    }

    private var timingRow: some View {
        HStack(spacing: 10) {
            Image(systemName: context.isOverdue ? "exclamationmark.triangle.fill" : "clock.badge.checkmark")
                .foregroundStyle(context.isOverdue ? Color.statusText(.red) : Color.kioskRed)
                .accessibilityHidden(true)
            Text(context.isOverdue ? "Overdue" : "Due")
                .font(.caption.weight(.bold))
                .tracking(0.8)
                .foregroundStyle(context.isOverdue ? Color.statusText(.red) : KioskText.tertiary)
                .textCase(.uppercase)
            Text(context.endsAt.formatted(date: .abbreviated, time: .shortened))
                .font(.subheadline.weight(.semibold).monospacedDigit())
                .foregroundStyle(KioskText.primary)
            Text(relativeDue)
                .font(.caption.weight(.semibold))
                .foregroundStyle(context.isOverdue ? Color.statusText(.red) : KioskText.tertiary)
                .padding(.horizontal, 8)
                .padding(.vertical, 3)
                .background(
                    (context.isOverdue ? Color.statusText(.red) : KioskText.tertiary).opacity(0.14),
                    in: Capsule()
                )
            Spacer()
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .background(KioskSurface.cardRaised, in: RoundedRectangle(cornerRadius: KioskRadius.lg))
        .overlay(
            RoundedRectangle(cornerRadius: KioskRadius.lg)
                .stroke(KioskStroke.standard, lineWidth: 1)
        )
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(context.isOverdue ? "Overdue, due" : "Due") \(context.endsAt.formatted(date: .abbreviated, time: .shortened))")
    }

    private var relativeDue: String {
        let rel = Self.relativeFormatter.localizedString(for: context.endsAt, relativeTo: Date())
        return context.isOverdue ? "\(rel)" : rel
    }

    private static let relativeFormatter: RelativeDateTimeFormatter = {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return formatter
    }()

    @ViewBuilder
    private func itemRow(_ group: ItemGroup) -> some View {
        HStack(spacing: 12) {
            itemThumbnail(group)
                .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 6) {
                    Text(group.title)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(KioskText.primary)
                        .lineLimit(1)
                    if group.count > 1 {
                        Text("x\(group.count)")
                            .font(.caption2.weight(.bold))
                            .foregroundStyle(Color.kioskRed)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Color.kioskRed.opacity(0.16), in: Capsule())
                    }
                }
                if group.isBulkGroup, !group.unitNumbers.isEmpty {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 4) {
                            ForEach(group.unitNumbers, id: \.self) { unit in
                                Text("#\(unit)")
                                    .font(.caption2.monospacedDigit().weight(.semibold))
                                    .foregroundStyle(KioskText.secondary)
                                    .padding(.horizontal, 6)
                                    .padding(.vertical, 3)
                                    .background(KioskSurface.cardRaised, in: Capsule())
                            }
                        }
                    }
                } else {
                    Text(group.first.tagName)
                        .font(.caption.monospaced())
                        .foregroundStyle(KioskText.secondary)
                }
            }
            Spacer()
            if group.returnedCount > 0 {
                Text(group.returnedCount == group.count ? "Returned" : "\(group.returnedCount)/\(group.count) back")
                    .font(.caption2.weight(.bold))
                    .foregroundStyle(Color.statusText(.green))
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .background(KioskSurface.card, in: RoundedRectangle(cornerRadius: KioskRadius.md))
        .overlay(
            RoundedRectangle(cornerRadius: KioskRadius.md)
                .stroke(KioskStroke.hairline, lineWidth: 1)
        )
    }

    @ViewBuilder
    private func itemThumbnail(_ group: ItemGroup) -> some View {
        let fallbackIcon = group.isBulkGroup ? "battery.100percent" : "camera.fill"
        Group {
            if let urlString = group.first.imageUrl, let url = URL(string: urlString) {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let image):
                        image.resizable().scaledToFill()
                    default:
                        thumbnailFallback(icon: fallbackIcon)
                    }
                }
            } else {
                thumbnailFallback(icon: fallbackIcon)
            }
        }
        .frame(width: 40, height: 40)
        .clipShape(RoundedRectangle(cornerRadius: KioskRadius.sm))
        .overlay(
            RoundedRectangle(cornerRadius: KioskRadius.sm)
                .stroke(KioskStroke.hairline, lineWidth: 1)
        )
    }

    private func thumbnailFallback(icon: String) -> some View {
        RoundedRectangle(cornerRadius: KioskRadius.sm)
            .fill(KioskSurface.placeholder)
            .overlay {
                Image(systemName: icon)
                    .font(.headline)
                    .foregroundStyle(KioskText.secondary)
            }
    }

    private func load() async {
        isLoading = true
        loadError = nil
        do {
            detail = try await KioskAPI.shared.kioskCheckoutDetail(id: context.checkoutId)
        } catch {
            loadError = (error as? APIError)?.errorDescription ?? "Could not load checkout details."
        }
        isLoading = false
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
                    .foregroundStyle(KioskText.primary)
                    .lineLimit(1)
                    .multilineTextAlignment(.center)
                    .minimumScaleFactor(0.74)
            }
            .frame(maxWidth: .infinity)
            .frame(minHeight: 92)
            .padding(.horizontal, 8)
            .padding(.vertical, 10)
            .background(KioskSurface.cardRaised, in: RoundedRectangle(cornerRadius: KioskRadius.md))
            .overlay(
                RoundedRectangle(cornerRadius: KioskRadius.md)
                    .stroke(KioskStroke.strong, lineWidth: 1)
            )
        }
        .buttonStyle(KioskPressStyle())
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
                    HStack(spacing: 6) {
                        Image(systemName: "hand.tap.fill")
                            .font(.caption2)
                        Text("Tap anywhere to wake")
                            .font(.caption2.weight(.semibold))
                    }
                    .foregroundStyle(Color.white.opacity(0.09))
                    .padding(.top, 6)
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
