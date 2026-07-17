import SwiftUI

enum BookingScope: String, CaseIterable, Identifiable {
    case mine
    case all
    case needsAttention

    var id: String { rawValue }

    var title: String {
        switch self {
        case .mine: return "Mine"
        case .all: return "All"
        case .needsAttention: return "Attention"
        }
    }

    var accessibilityLabel: String {
        switch self {
        case .mine: return "Mine"
        case .all: return "All visible bookings"
        case .needsAttention: return "Needs attention"
        }
    }
}

@MainActor
@Observable
final class BookingsViewModel {
    var checkouts: [Booking] = []
    var reservations: [Booking] = []
    var isLoading = false
    var error: String?
    var pageError: String?
    var lastLoadedAt: Date?
    var searchText = ""
    var hasMoreCheckouts = true
    var hasMoreReservations = true
    /// Native list scope. Students default to Mine; staff/admin can quickly
    /// switch between personal work, all visible work, and urgent work.
    var scope: BookingScope = .all
    var currentUserId: String?
    var currentUserRole = ""

    var mineOnly: Bool {
        get { scope == .mine }
        set { scope = newValue ? .mine : .all }
    }

    private var checkoutOffset = 0
    private var reservationOffset = 0
    private let limit = 30
    private var searchTask: Task<Void, Never>?
    private var loadTask: Task<Void, Never>?
    private var didApplyUserDefault = false

    var isEmpty: Bool { checkouts.isEmpty && reservations.isEmpty }
    var hasMore: Bool { hasMoreCheckouts || hasMoreReservations }
    var isRefreshingVisibleRows: Bool { isLoading && !isEmpty }

    var sortedCheckouts: [Booking] {
        checkouts.sorted(by: bookingSort)
    }

    var sortedReservations: [Booking] {
        reservations.sorted(by: bookingSort)
    }

    func applyUserContext(id: String?, role: String?) {
        currentUserId = id
        currentUserRole = role ?? ""
        guard !didApplyUserDefault else { return }
        scope = currentUserRole == "STUDENT" || currentUserRole == "COLLABORATOR" ? .mine : .all
        didApplyUserDefault = true
    }

    func load(reset: Bool = false, clearExistingRows: Bool = false) async {
        if reset {
            // Cancel any in-flight load so a tab switch / refresh wins.
            loadTask?.cancel()
        } else if isLoading {
            // Pagination: ignore if a load is already running.
            return
        }
        let task = Task { await performLoad(reset: reset, clearExistingRows: clearExistingRows) }
        loadTask = task
        await task.value
    }

    private func performLoad(reset: Bool, clearExistingRows: Bool) async {
        if reset {
            checkoutOffset = 0
            reservationOffset = 0
            hasMoreCheckouts = true
            hasMoreReservations = true
            pageError = nil
            if clearExistingRows {
                checkouts = []
                reservations = []
            }
        }
        isLoading = true
        if reset { error = nil }
        do {
            let search = searchText.isEmpty ? nil : searchText
            let requesterId = mineOnly ? currentUserId : nil
            let checkoutResult: PaginatedResponse<Booking>
            let reservationResult: PaginatedResponse<Booking>
            if scope == .needsAttention {
                let attention = try await fetchNeedsAttention(search: search, requesterId: requesterId)
                checkoutResult = PaginatedResponse(data: attention.checkouts, total: attention.checkouts.count, limit: limit, offset: 0)
                reservationResult = PaginatedResponse(data: attention.reservations, total: attention.reservations.count, limit: limit, offset: 0)
            } else {
                async let checkoutPage = fetchCheckouts(search: search, requesterId: requesterId)
                async let reservationPage = fetchReservations(search: search, requesterId: requesterId)
                (checkoutResult, reservationResult) = try await (checkoutPage, reservationPage)
            }
            if Task.isCancelled { isLoading = false; return }
            if reset {
                checkouts = checkoutResult.data
                reservations = reservationResult.data
            } else {
                checkouts += checkoutResult.data
                reservations += reservationResult.data
            }
            checkoutOffset += checkoutResult.data.count
            reservationOffset += reservationResult.data.count
            hasMoreCheckouts = scope == .needsAttention ? false : checkoutOffset < checkoutResult.total
            hasMoreReservations = scope == .needsAttention ? false : reservationOffset < reservationResult.total
            pageError = nil
            lastLoadedAt = Date()
            if reset && searchText.isEmpty && scope == .all {
                GearStore.shared.seedBookings(checkoutResult.data + reservationResult.data)
            }
            await CheckoutReturnLiveActivityManager.shared.reconcileCurrentUserCheckouts(
                requesterId: currentUserId
            )
        } catch is CancellationError {
            // Superseded by a newer load; leave state alone.
        } catch {
            if reset {
                self.error = error.localizedDescription
            } else {
                self.pageError = error.localizedDescription
                hasMoreCheckouts = false
                hasMoreReservations = false
            }
        }
        isLoading = false
    }

    private func fetchCheckouts(search: String?, requesterId: String?, filter: String? = nil) async throws -> PaginatedResponse<Booking> {
        guard hasMoreCheckouts else {
            return PaginatedResponse(data: [], total: checkoutOffset, limit: limit, offset: checkoutOffset)
        }
        return try await APIClient.shared.checkouts(
            activeOnly: true,
            search: search,
            requesterId: requesterId,
            filter: filter,
            limit: limit,
            offset: checkoutOffset
        )
    }

    private func fetchReservations(search: String?, requesterId: String?, filter: String? = nil) async throws -> PaginatedResponse<Booking> {
        guard hasMoreReservations else {
            return PaginatedResponse(data: [], total: reservationOffset, limit: limit, offset: reservationOffset)
        }
        return try await APIClient.shared.reservations(
            activeOnly: true,
            search: search,
            requesterId: requesterId,
            filter: filter,
            limit: limit,
            offset: reservationOffset
        )
    }

    private func fetchNeedsAttention(search: String?, requesterId: String?) async throws -> (checkouts: [Booking], reservations: [Booking]) {
        async let overdueCheckouts = APIClient.shared.checkouts(activeOnly: true, search: search, requesterId: requesterId, filter: "overdue", limit: limit, offset: 0)
        async let dueTodayCheckouts = APIClient.shared.checkouts(activeOnly: true, search: search, requesterId: requesterId, filter: "due-today", limit: limit, offset: 0)
        async let activeCheckouts = APIClient.shared.checkouts(activeOnly: true, search: search, requesterId: requesterId, limit: limit, offset: 0)
        async let overdueReservations = APIClient.shared.reservations(activeOnly: true, search: search, requesterId: requesterId, filter: "overdue", limit: limit, offset: 0)
        async let dueTodayReservations = APIClient.shared.reservations(activeOnly: true, search: search, requesterId: requesterId, filter: "due-today", limit: limit, offset: 0)
        async let activeReservations = APIClient.shared.reservations(activeOnly: true, search: search, requesterId: requesterId, limit: limit, offset: 0)

        let (overdueCheckoutPage, dueTodayCheckoutPage, activeCheckoutPage, overdueReservationPage, dueTodayReservationPage, activeReservationPage) = try await (
            overdueCheckouts,
            dueTodayCheckouts,
            activeCheckouts,
            overdueReservations,
            dueTodayReservations,
            activeReservations
        )
        let now = Date()
        return (
            uniqueBookings([
                overdueCheckoutPage.data,
                dueTodayCheckoutPage.data,
                activeCheckoutPage.data.filter { $0.needsBookingAttention(now: now) },
            ]).sorted(by: bookingSort),
            uniqueBookings([
                overdueReservationPage.data,
                dueTodayReservationPage.data,
                activeReservationPage.data.filter { $0.needsBookingAttention(now: now) },
            ]).filter { $0.needsBookingAttention(now: now) }.sorted(by: bookingSort)
        )
    }

    private func uniqueBookings(_ groups: [[Booking]]) -> [Booking] {
        var seen = Set<String>()
        var result: [Booking] = []
        for booking in groups.flatMap({ $0 }) where seen.insert(booking.id).inserted {
            result.append(booking)
        }
        return result
    }

    private func bookingSort(_ lhs: Booking, _ rhs: Booking) -> Bool {
        if scope == .needsAttention {
            let now = Date()
            let leftPriority = lhs.attentionPriority(now: now)
            let rightPriority = rhs.attentionPriority(now: now)
            if leftPriority != rightPriority { return leftPriority < rightPriority }
            let leftDate = lhs.attentionDate
            let rightDate = rhs.attentionDate
            if leftDate != rightDate { return leftDate < rightDate }
            return lhs.id < rhs.id
        }
        if lhs.startsAt != rhs.startsAt { return lhs.startsAt > rhs.startsAt }
        return lhs.id < rhs.id
    }

    func retryPage() async {
        pageError = nil
        hasMoreCheckouts = true
        hasMoreReservations = true
        await load()
    }

    func onSearchChange() {
        searchTask?.cancel()
        searchTask = Task {
            try? await Task.sleep(for: .milliseconds(350))
            guard !Task.isCancelled else { return }
            await load(reset: true, clearExistingRows: true)
        }
    }

    func resetDefaults() {
        searchTask?.cancel()
        loadTask?.cancel()
        searchText = ""
        scope = currentUserRole == "STUDENT" || currentUserRole == "COLLABORATOR" ? .mine : .all
        checkouts = []
        reservations = []
        checkoutOffset = 0
        reservationOffset = 0
        hasMoreCheckouts = true
        hasMoreReservations = true
        error = nil
        pageError = nil
    }
}

struct BookingsView: View {
    @State private var vm = BookingsViewModel()
    @State private var showCreate = false
    @State private var navigationPath = NavigationPath()
    @Environment(SessionStore.self) private var session
    @Environment(AppState.self) private var appState

    private var canCreateForOthers: Bool {
        let role = session.currentUser?.role ?? ""
        return role == "STAFF" || role == "ADMIN"
    }

    private var canCreate: Bool {
        guard let user = session.currentUser else { return false }
        return user.role != "COLLABORATOR" || (user.capabilities ?? []).contains("RESERVATION_CREATE")
    }

    private var isCollaborator: Bool {
        session.currentUser?.role == "COLLABORATOR"
    }

    private var showsEmptyCreateAction: Bool {
        canCreate
            && vm.isEmpty
            && !vm.isLoading
            && vm.error == nil
            && vm.searchText.isEmpty
            && vm.scope == .all
    }

    private var emptyTitle: String {
        guard vm.searchText.isEmpty else { return "No Results" }
        switch vm.scope {
        case .mine: return "No Bookings"
        case .all: return "No Active Bookings"
        case .needsAttention: return "Nothing Needs Attention"
        }
    }

    /// An empty Attention queue is good news; don't give it an archive box.
    private var emptyIcon: String {
        guard vm.searchText.isEmpty else { return "magnifyingglass" }
        return vm.scope == .needsAttention ? "checkmark.circle" : "archivebox"
    }

    private var emptyDescription: String {
        if !vm.searchText.isEmpty { return "No results for \"\(vm.searchText)\"." }
        if vm.scope == .mine {
            return "Your active checkouts and reservations will appear here together."
        }
        if vm.scope == .needsAttention {
            return "Overdue, due-today, and pickup work will appear here when it needs action."
        }
        return "Active checkouts and reservations appear here in one chronological list."
    }

    /// Apply a dashboard scope hint (e.g. Overdue tile → Attention scope).
    /// Setting `vm.scope` triggers the existing onChange reload.
    private func consumePendingScope() {
        guard let hint = appState.pendingBookingsScope else { return }
        appState.pendingBookingsScope = nil
        if let scope = BookingScope(rawValue: hint), vm.scope != scope {
            vm.scope = scope
        }
    }

    private var searchPrompt: String {
        "Search bookings..."
    }

    var body: some View {
        // Apple's recommended pattern for binding to an @Observable model.
        @Bindable var vm = vm
        return NavigationStack(path: $navigationPath) {
            VStack(spacing: 0) {
                if !isCollaborator {
                    Picker("Booking scope", selection: $vm.scope) {
                        ForEach(BookingScope.allCases) { scope in
                            Text(scope.title).tag(scope)
                        }
                    }
                    .pickerStyle(.segmented)
                    .padding(.horizontal, 16)
                    .padding(.top, 8)
                    .padding(.bottom, 6)
                    .background(Color(.systemGroupedBackground))
                    .accessibilityLabel("Booking scope")
                    .accessibilityValue(vm.scope.accessibilityLabel)
                }

                Group {
                    if let error = vm.error, vm.isEmpty {
                        ContentUnavailableView {
                            Label("Couldn't load bookings", systemImage: "exclamationmark.triangle")
                        } description: {
                            Text(error)
                        } actions: {
                            Button("Retry") { Task { await vm.load(reset: true, clearExistingRows: true) } }
                                .buttonStyle(.borderedProminent)
                        }
                    } else if vm.isEmpty && vm.isLoading {
                        List {
                            ForEach(0..<8, id: \.self) { _ in
                                BookingRowSkeleton()
                                    .listRowSeparator(.hidden)
                                    .listRowBackground(Color.clear)
                                    .listRowInsets(EdgeInsets(top: 5, leading: 16, bottom: 5, trailing: 16))
                            }
                        }
                        .listStyle(.plain)
                        .scrollContentBackground(.hidden)
                        .background(Color(.systemGroupedBackground))
                        .allowsHitTesting(false)
                        .accessibilityHidden(true)  // Don't pollute VO with placeholder shapes.
                    } else if vm.isEmpty {
                        ContentUnavailableView {
                            Label(emptyTitle, systemImage: emptyIcon)
                        } description: {
                            Text(emptyDescription)
                        } actions: {
                            emptyStateActions
                        }
                    } else {
                        List {
                            if !vm.sortedCheckouts.isEmpty {
                                BookingListSection(title: "Checkouts", count: vm.sortedCheckouts.count) {
                                    ForEach(vm.sortedCheckouts) { booking in
                                        BookingRowLink(booking: booking)
                                    }
                                }
                            }
                            if !vm.sortedReservations.isEmpty {
                                BookingListSection(title: "Reservations", count: vm.sortedReservations.count) {
                                    ForEach(vm.sortedReservations) { booking in
                                        BookingRowLink(booking: booking)
                                    }
                                }
                            }
                            if let pageError = vm.pageError {
                                VStack(spacing: 8) {
                                    Text(pageError)
                                        .font(.footnote)
                                        .foregroundStyle(.secondary)
                                        .multilineTextAlignment(.center)
                                    Button("Retry") { Task { await vm.retryPage() } }
                                        .buttonStyle(.bordered)
                                }
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 8)
                                .listRowSeparator(.hidden)
                                .listRowBackground(Color.clear)
                            } else if vm.hasMore {
                                ProgressView()
                                    .frame(maxWidth: .infinity)
                                    .listRowSeparator(.hidden)
                                    .listRowBackground(Color.clear)
                                    .task(id: "\(vm.scope.rawValue)-\(vm.checkouts.count)-\(vm.reservations.count)") {
                                        await vm.load()
                                    }
                            }
                            if let lastLoadedAt = vm.lastLoadedAt {
                                BookingFreshnessFooter(lastLoadedAt: lastLoadedAt, isRefreshing: vm.isRefreshingVisibleRows)
                                    .listRowSeparator(.hidden)
                                    .listRowBackground(Color.clear)
                            }
                        }
                        .listStyle(.plain)
                        .scrollContentBackground(.hidden)
                        .background(Color(.systemGroupedBackground))
                    }
                }
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle(isCollaborator ? "My Gear" : "Bookings")
            .searchable(text: $vm.searchText, prompt: searchPrompt)
            .onChange(of: vm.searchText) { vm.onSearchChange() }
            .onChange(of: vm.scope) { _, _ in
                Haptics.selection()
                Task { await vm.load(reset: true, clearExistingRows: true) }
            }
            .toolbar {
                if canCreate && !showsEmptyCreateAction {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button { showCreate = true } label: {
                            Label("New Reservation", systemImage: "plus")
                                .labelStyle(.titleAndIcon)
                        }
                        .accessibilityLabel("New Reservation")
                    }
                }
            }
            .sheet(isPresented: $showCreate) {
                CreateBookingSheet { newId in
                    Task {
                        await vm.load(reset: true, clearExistingRows: true)
                        navigationPath.append(newId)
                    }
                }
            }
            .refreshable { await vm.load(reset: true) }
            .task {
                vm.applyUserContext(id: session.currentUser?.id, role: session.currentUser?.role)
                consumePendingScope()
                consumePendingAppIntent()
                await vm.load(reset: true)
            }
            .onChange(of: appState.pendingBookingsScope) { _, _ in
                // A scope hint arrived while this tab was already alive (e.g.
                // the dashboard "Overdue" tile tapped after the list loaded).
                consumePendingScope()
            }
            .onChange(of: appState.pendingAppIntentDestination) { _, _ in
                consumePendingAppIntent()
            }
            .onChange(of: appState.tabResetToken) { _, _ in
                guard appState.resetTab == 1 else { return }
                showCreate = false
                navigationPath = NavigationPath()
                vm.resetDefaults()
                Task { await vm.load(reset: true, clearExistingRows: true) }
            }
            .navigationDestination(for: Booking.self) { booking in
                BookingDetailView(bookingId: booking.id)
            }
            .navigationDestination(for: String.self) { id in
                BookingDetailView(bookingId: id)
            }
        }
    }

    @ViewBuilder
    private var emptyStateActions: some View {
        if !vm.searchText.isEmpty {
            Button {
                vm.searchText = ""
                Task { await vm.load(reset: true, clearExistingRows: true) }
            } label: {
                Label("Clear search", systemImage: "xmark.circle")
            }
            .buttonStyle(.borderedProminent)
        } else if vm.scope != .all {
            Button {
                vm.scope = .all
                Task { await vm.load(reset: true, clearExistingRows: true) }
            } label: {
                Label("Show all visible bookings", systemImage: "person.2")
            }
            .buttonStyle(.borderedProminent)
        } else if canCreate {
            Button {
                showCreate = true
            } label: {
                Label("New Reservation", systemImage: "plus")
            }
            .buttonStyle(.borderedProminent)
        }
    }

    private func consumePendingAppIntent() {
        if appState.consumeAppIntentDestination(.createReservation) {
            if canCreate { showCreate = true }
        } else if appState.consumeAppIntentDestination(.myGear) {
            navigationPath = NavigationPath()
        }
    }
}

private struct BookingListSection<Content: View>: View {
    let title: String
    let count: Int
    @ViewBuilder let content: () -> Content

    var body: some View {
        Section {
            content()
        } header: {
            HStack(spacing: 6) {
                Text(title)
                Text("\(count)")
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(.secondary)
            }
            .textCase(.none)
            .font(.caption.weight(.semibold))
            .foregroundStyle(.secondary)
        }
    }
}

private struct BookingRowLink: View {
    let booking: Booking

    var body: some View {
        ZStack {
            NavigationLink(value: booking) { EmptyView() }.opacity(0)
            BookingRow(booking: booking)
        }
        .listRowSeparator(.hidden)
        .listRowBackground(Color.clear)
        .listRowInsets(EdgeInsets(top: 5, leading: 16, bottom: 5, trailing: 16))
    }
}

private struct BookingFreshnessFooter: View {
    let lastLoadedAt: Date
    let isRefreshing: Bool

    var body: some View {
        HStack(spacing: 6) {
            if isRefreshing {
                ProgressView()
                    .controlSize(.small)
                    .accessibilityHidden(true)
                Text("Refreshing")
            } else {
                Image(systemName: "arrow.triangle.2.circlepath")
                    .font(.caption2.weight(.semibold))
                    .accessibilityHidden(true)
                Text("Updated \(lastLoadedAt.formatted(.relative(presentation: .named)))")
            }
        }
        .font(.caption2)
        .monospacedDigit()
        .foregroundStyle(.secondary)
        .frame(maxWidth: .infinity)
        .padding(.vertical, 8)
        .accessibilityLabel(isRefreshing ? "Refreshing bookings" : "Bookings updated \(lastLoadedAt.formatted(.relative(presentation: .named)))")
    }
}

struct BookingRow: View {
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    let booking: Booking

    private var isOverdue: Bool {
        booking.status == .open && booking.endsAt < .now
    }

    private var itemCount: Int {
        booking.serializedItems.count + booking.bulkItems.count
    }

    /// The section and rail already communicate a normal active checkout.
    /// Keep a pill only when it adds a distinct lifecycle or urgency signal.
    private var showsStatusBadge: Bool {
        isOverdue || booking.kind != .checkout || booking.status != .open
    }

    /// Accent tone for the leading bar — overdue shouts red, otherwise the
    /// status' own tone (reservation purple, checkout blue, pickup orange).
    private var accentTone: StatusTone {
        if isOverdue { return .red }
        switch booking.status {
        case .booked: return booking.kind == .reservation ? .purple : .blue
        case .pendingPickup: return .orange
        case .open: return .blue
        default: return .gray
        }
    }

    var body: some View {
        Group {
            if dynamicTypeSize.isAccessibilitySize {
                accessibilityRow
            } else {
                compactRow
            }
        }
        .padding(.vertical, 12)
        .padding(.horizontal, 14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.cardSurface)
        .clipShape(RoundedRectangle(cornerRadius: Brand.Radius.md, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Brand.Radius.md, style: .continuous)
                .strokeBorder(Color.hairline, lineWidth: 0.5)
        )
        .shadow(color: Color.black.opacity(0.05), radius: 8, x: 0, y: 3)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(rowAccessibilityLabel)
    }

    private var compactRow: some View {
        HStack(spacing: 12) {
            StatusRail(tone: accentTone)
            UserAvatarView(name: booking.requester.name, avatarUrl: booking.requester.avatarUrl, size: 40)
            VStack(alignment: .leading, spacing: 4) {
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    bookingTitle.lineLimit(1)
                    Spacer(minLength: 8)
                    if showsStatusBadge {
                        statusBadge
                    }
                }
                timingLine(lineLimit: 1)
                metadataLine(lineLimit: 1)
            }
            disclosureIndicator
        }
    }

    private var accessibilityRow: some View {
        HStack(alignment: .top, spacing: 12) {
            StatusRail(tone: accentTone)
            VStack(alignment: .leading, spacing: 10) {
                HStack(alignment: .top, spacing: 10) {
                    UserAvatarView(name: booking.requester.name, avatarUrl: booking.requester.avatarUrl, size: 40)
                    bookingTitle
                        .fixedSize(horizontal: false, vertical: true)
                    Spacer(minLength: 4)
                    disclosureIndicator
                }
                if showsStatusBadge {
                    statusBadge
                }
                timingLine(lineLimit: nil)
                metadataLine(lineLimit: nil)
            }
        }
    }

    private var bookingTitle: some View {
        Text(booking.title)
            .font(.gothamBold(size: 16))
    }

    private var statusBadge: some View {
        StatusBadge(status: booking.status, kind: booking.kind, isOverdue: isOverdue)
    }

    private var disclosureIndicator: some View {
        Image(systemName: "chevron.right")
            .font(.caption2.weight(.semibold))
            .foregroundStyle(.tertiary)
            .accessibilityHidden(true)
    }

    private func timingLine(lineLimit: Int?) -> some View {
        TimelineView(.periodic(from: .now, by: 60)) { context in
            let info = timing(now: context.date)
            Text(info.text)
                .font(.caption.weight(.semibold))
                .lineLimit(lineLimit)
                .fixedSize(horizontal: false, vertical: true)
                .foregroundStyle(info.urgent ? AnyShapeStyle(Color.statusText(.red)) : AnyShapeStyle(Color.statusText(accentTone)))
        }
    }

    private func metadataLine(lineLimit: Int?) -> some View {
        HStack(spacing: 4) {
            Text(booking.requester.name)
            Text("·")
            Text(booking.location.name)
            if itemCount > 0 {
                Text("·")
                Text("\(itemCount) item\(itemCount == 1 ? "" : "s")")
                    .monospacedDigit()
            }
        }
        .font(.caption)
        .foregroundStyle(.secondary)
        .lineLimit(lineLimit)
        .fixedSize(horizontal: false, vertical: true)
    }

    /// Live timing line: a real clock time first ("Due today at 11:30 AM"),
    /// with the compact relative magnitude only where urgency needs it
    /// ("2h overdue · due 11:30 AM"). Checkouts speak to their return (OPEN)
    /// or pickup window; reservations to their start.
    private func timing(now: Date) -> (text: String, urgent: Bool) {
        if booking.kind == .checkout {
            switch booking.status {
            case .open:
                if booking.endsAt < now {
                    return ("\(booking.endsAt.compactMagnitude(now: now)) overdue · due \(shortWhen(booking.endsAt, now: now))", true)
                }
                return ("Due \(dayAndTime(booking.endsAt, now: now))", false)
            case .pendingPickup, .booked:
                if booking.startsAt < now {
                    return ("Pickup late · was \(shortWhen(booking.startsAt, now: now))", true)
                }
                return ("Pickup \(dayAndTime(booking.startsAt, now: now))", false)
            default:
                return ("Due \(dayAndTime(booking.endsAt, now: now))", false)
            }
        }
        // Reservation: speak to its start, then read as underway.
        return booking.startsAt > now
            ? ("Starts \(dayAndTime(booking.startsAt, now: now))", false)
            : ("Started \(dayPhrase(booking.startsAt, now: now))", false)
    }

    /// "today", "tomorrow", "yesterday", a weekday within a week ("Friday"),
    /// otherwise a short date ("Jul 12").
    private func dayPhrase(_ date: Date, now: Date) -> String {
        let cal = Calendar.current
        if cal.isDate(date, inSameDayAs: now) { return "today" }
        if let tomorrow = cal.date(byAdding: .day, value: 1, to: now), cal.isDate(date, inSameDayAs: tomorrow) { return "tomorrow" }
        if let yesterday = cal.date(byAdding: .day, value: -1, to: now), cal.isDate(date, inSameDayAs: yesterday) { return "yesterday" }
        let days = cal.dateComponents([.day], from: cal.startOfDay(for: now), to: cal.startOfDay(for: date)).day ?? 0
        if days > 0 && days < 7 { return date.formatted(.dateTime.weekday(.wide)) }
        return date.formatted(date: .abbreviated, time: .omitted)
    }

    /// "today at 11:30 AM" nearby, just "Jul 12" once the clock time stops
    /// being the useful part.
    private func dayAndTime(_ date: Date, now: Date) -> String {
        let phrase = dayPhrase(date, now: now)
        let days = abs(Calendar.current.dateComponents([.day], from: Calendar.current.startOfDay(for: now), to: Calendar.current.startOfDay(for: date)).day ?? 0)
        guard days < 7 else { return phrase }
        return "\(phrase) at \(date.formatted(date: .omitted, time: .shortened))"
    }

    /// For past references: the clock time when it was today, else the day.
    private func shortWhen(_ date: Date, now: Date) -> String {
        Calendar.current.isDate(date, inSameDayAs: now)
            ? date.formatted(date: .omitted, time: .shortened)
            : dayPhrase(date, now: now)
    }

    private var rowAccessibilityLabel: String {
        var parts: [String] = []
        if isOverdue { parts.append("Overdue") }
        parts.append(booking.title)
        parts.append(booking.requester.name)
        parts.append(booking.location.name)
        if itemCount > 0 { parts.append("\(itemCount) item\(itemCount == 1 ? "" : "s")") }
        parts.append(StatusBadge.label(for: booking.status, kind: booking.kind, isOverdue: isOverdue))
        if booking.kind == .checkout {
            parts.append("Due \(booking.endsAt.formatted(date: .abbreviated, time: .shortened))")
        } else {
            parts.append("From \(booking.startsAt.formatted(date: .abbreviated, time: .omitted))")
        }
        return parts.joined(separator: ", ")
    }
}

private extension Booking {
    func needsBookingAttention(now: Date) -> Bool {
        let calendar = Calendar.current
        let todayStart = calendar.startOfDay(for: now)
        let todayEnd = calendar.date(byAdding: .day, value: 1, to: todayStart) ?? now

        switch (kind, status) {
        case (.checkout, .open):
            return endsAt < todayEnd
        case (.checkout, .pendingPickup), (.checkout, .booked):
            return startsAt < todayEnd
        case (.reservation, .booked):
            return startsAt < todayEnd
        default:
            return false
        }
    }

    func attentionPriority(now: Date) -> Int {
        switch (kind, status) {
        case (.checkout, .open) where endsAt < now:
            return 0
        case (.checkout, .pendingPickup) where startsAt < now:
            return 1
        case (.checkout, .open):
            return 2
        case (.checkout, .pendingPickup), (.checkout, .booked):
            return 3
        case (.reservation, .booked) where startsAt < now:
            return 4
        case (.reservation, .booked):
            return 5
        default:
            return 9
        }
    }

    var attentionDate: Date {
        kind == .checkout && status == .open ? endsAt : startsAt
    }
}


struct StatusBadge: View {
    let status: BookingStatus
    var kind: BookingKind = .unknown
    var isOverdue = false

    var body: some View {
        StatusPill(label: Self.label(for: status, kind: kind, isOverdue: isOverdue), tone: tone)
    }

    /// Public static so accessibility-label builders can speak the same
    /// label the visible pill renders, without duplicating the BOOKED-vs-
    /// reservation/checkout split logic.
    static func label(for status: BookingStatus, kind: BookingKind, isOverdue: Bool = false) -> String {
        if isOverdue { return "Overdue" }
        if status == .booked { return "Reserved" }
        if status == .open { return "Checked Out" }
        return status.label
    }

    private var tone: StatusTone {
        if isOverdue { return .red }
        switch status {
        case .draft: return .gray
        case .booked: return .purple
        case .pendingPickup: return .orange
        case .open: return .blue
        case .completed: return .gray
        case .cancelled: return .gray
        case .unknown: return .gray
        }
    }
}
