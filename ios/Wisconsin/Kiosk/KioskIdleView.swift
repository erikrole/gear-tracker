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
            let compact = proxy.size.width < KioskLayout.compactBreakpoint || dynamicTypeSize.isAccessibilitySize
            let rosterWidth = KioskLayout.rosterWidth(for: proxy.size.width)

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
                    HIDScannerField { value in
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
            KioskCheckoutDetailSheet(context: context) {
                Task { await loadAll() }
            }
                .presentationDetents([.height(520), .large])
                .presentationDragIndicator(.visible)
        }
    }

    private var shouldShowSleepMode: Bool {
        #if DEBUG
        if debugForcesSleepMode { return true }
        #endif
        guard dashboard?.standby?.sleepMode == true else { return false }
        guard sleepModeReason != "active_window" else { return false }
        if let sleepDismissedUntil = store.sleepDismissedUntil, sleepDismissedUntil > Date() {
            return false
        }
        return true
    }

    private var sleepModeReason: String {
        #if DEBUG
        if debugForcesSleepMode { return "debug_night_mode" }
        #endif
        guard let dashboard, let standby = dashboard.standby else { return "idle_window" }
        if standby.reason == "night_hours", !Self.isLocalNightHours(Date()) {
            return isLocallyIdleWindow(dashboard, standby: standby) ? "idle_window" : "active_window"
        }
        return standby.reason
    }

    private func isLocallyIdleWindow(_ dashboard: KioskDashboard, standby: KioskDashboard.Standby) -> Bool {
        dashboard.stats.checkouts == 0 &&
        dashboard.stats.itemsOut == 0 &&
        standby.nearbyEventCount == 0 &&
        standby.nearbyBookingWindowCount == 0
    }

    private static func isLocalNightHours(_ date: Date) -> Bool {
        let hour = Calendar.current.component(.hour, from: date)
        return hour >= 22 || hour < 6
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
                store.clearSleepModeDismissal()
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
        store.deferSleepMode(for: sleepWakeDuration)
    }

    // MARK: - Left Panel

    private var leftPanel: some View {
        VStack(alignment: .leading, spacing: 18) {
            // Quiet overline band: device identity reads as a label, not a
            // title, so the clock below owns the hierarchy.
            HStack(spacing: 8) {
                Text((store.info?.name ?? "Gear Room").uppercased())
                    .font(.caption.weight(.bold))
                    .tracking(1.2)
                    .foregroundStyle(KioskText.secondary)
                if let location = store.info?.locationName {
                    Text("•")
                        .foregroundStyle(KioskText.muted)
                    Text(location.uppercased())
                        .font(.caption.weight(.bold))
                        .tracking(1.2)
                        .foregroundStyle(KioskText.tertiary)
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
                    HStack(spacing: 10) {
                        RoundedRectangle(cornerRadius: 1.5)
                            .fill(Color.kioskRed)
                            .frame(width: 3, height: 26)
                            .accessibilityHidden(true)
                        Text(context.date, format: .dateTime.weekday(.wide).month(.wide).day())
                            .font(.gothamBold(size: 32))
                            .foregroundStyle(KioskText.primary)
                            .lineLimit(1)
                            .minimumScaleFactor(0.75)
                    }
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
                VStack(spacing: 14) {
                    ZStack {
                        Circle()
                            .fill(Color.statusText(.green).opacity(0.12))
                            .frame(width: 88, height: 88)
                        Image(systemName: "checkmark.seal.fill")
                            .font(.system(size: 40))
                            .foregroundStyle(Color.statusText(.green))
                    }
                    .accessibilityHidden(true)
                    Text("All gear is home")
                        .font(.title3.bold())
                        .foregroundStyle(KioskText.primary)
                    Text("Nothing is checked out right now")
                        .font(.subheadline)
                        .foregroundStyle(KioskText.tertiary)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 28)
                .kioskCard(KioskSurface.low, radius: KioskRadius.lg, stroke: KioskStroke.hairline)
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
                KioskSectionIcon(systemImage: "barcode.viewfinder", size: 56)
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
                                store.deferSleepMode(for: sleepWakeDuration)
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
                ForEach(0..<12, id: \.self) { _ in
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
                        ActiveItemRow(group: group) { openCheckout(id: group.first.checkoutId, title: group.first.checkoutTitle, requesterId: group.first.requesterId, requesterName: group.first.requesterName, requesterAvatarUrl: group.first.requesterAvatarUrl, endsAt: group.first.endsAt, isOverdue: group.first.isOverdue) }
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
            requesterId: checkout.requesterId,
            requesterName: checkout.requesterName,
            requesterAvatarUrl: checkout.requesterAvatarUrl,
            endsAt: checkout.endsAt,
            isOverdue: checkout.isOverdue
        )
    }

    private func openCheckout(id: String, title: String, requesterId: String?, requesterName: String, requesterAvatarUrl: String?, endsAt: Date, isOverdue: Bool) {
        selectedCheckout = KioskCheckoutDrawerContext(
            checkoutId: id,
            title: title,
            requesterId: requesterId,
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
            let calendar = Calendar.current
            let today = calendar.startOfDay(for: Date())
            let tomorrow = calendar.date(byAdding: .day, value: 1, to: today) ?? today
            let todayEvents = dashboard.events.filter { $0.kioskOccurs(on: today, calendar: calendar) }
            let tomorrowEvents = dashboard.events.filter { $0.kioskOccurs(on: tomorrow, calendar: calendar) }
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
        var sawCancellation = false

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
        case .failure(let error) where isCancellation(error):
            sawCancellation = true
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
        case .failure(let error) where isCancellation(error):
            sawCancellation = true
        case .failure(let error):
            print("[KioskIdleView] users load failed: \(error.localizedDescription)")
            hitFailure = true
        }

        if loadedAnyData {
            lastLoadedAt = Date()
        }
        if hitFailure {
            loadFailedAt = Date()
        } else if loadedAnyData || !sawCancellation {
            loadFailedAt = nil
        }
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

    private func isCancellation(_ error: Error) -> Bool {
        if error is CancellationError {
            return true
        }
        if let apiError = error as? APIError,
           case .networkError(let underlying) = apiError {
            return isCancellation(underlying)
        }
        if let urlError = error as? URLError {
            return urlError.code == .cancelled
        }
        let nsError = error as NSError
        return nsError.domain == NSURLErrorDomain && nsError.code == NSURLErrorCancelled
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
                    .foregroundStyle(isSelected ? Color.kioskRed : accent)
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
            // Selection reads brand red — this gives red a real job on the
            // idle screen instead of another white-opacity rung.
            .kioskCard(
                isSelected ? KioskSurface.cardSelected : KioskSurface.cardRaised,
                radius: KioskRadius.xl,
                stroke: isSelected ? Color.kioskRed : KioskStroke.standard,
                lineWidth: isSelected ? 2 : 1
            )
            .overlay(alignment: .bottom) {
                if isSelected {
                    Capsule()
                        .fill(Color.kioskRed)
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

    var primaryTitle: String {
        guard isBulkGroup else { return first.itemListPrimaryTitle }
        let tags = unitNumbers.map { "#\($0)" }.joined(separator: " ")
        return tags.nonBlankText ?? first.itemListPrimaryTitle
    }

    var subtitle: String {
        guard isBulkGroup else { return [first.itemListSecondaryTitle, first.checkoutTitle].compactMap { $0 }.joined(separator: " · ") }
        let name = first.name.replacingOccurrences(of: #" #\d+$"#, with: "", options: .regularExpression)
        return "\(name) · \(count) unit\(count == 1 ? "" : "s")"
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
                        Text(group.primaryTitle)
                            .font(.gothamBold(size: 16))
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

                    Text(group.subtitle)
                        .font(.caption.weight(.medium))
                        .foregroundStyle(KioskText.secondary)
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)
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
            what = "\(group.primaryTitle), \(group.subtitle)"
        } else {
            what = "\(group.primaryTitle), \(group.subtitle)"
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
