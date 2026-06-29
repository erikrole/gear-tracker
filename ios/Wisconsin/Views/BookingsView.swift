import SwiftUI

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
    /// "Mine" filter — when on, list only shows bookings the current user
    /// requested. Mirrors the staff floor pattern of "what's mine right now".
    var mineOnly = false
    var currentUserId: String?
    var currentUserRole = ""

    private var checkoutOffset = 0
    private var reservationOffset = 0
    private let limit = 30
    private var searchTask: Task<Void, Never>?
    private var loadTask: Task<Void, Never>?
    private var didApplyUserDefault = false

    var isEmpty: Bool { checkouts.isEmpty && reservations.isEmpty }
    var hasMore: Bool { hasMoreCheckouts || hasMoreReservations }

    var sortedCheckouts: [Booking] {
        checkouts.sorted { lhs, rhs in
            if lhs.startsAt != rhs.startsAt { return lhs.startsAt > rhs.startsAt }
            return lhs.id < rhs.id
        }
    }

    var sortedReservations: [Booking] {
        reservations.sorted { lhs, rhs in
            if lhs.startsAt != rhs.startsAt { return lhs.startsAt > rhs.startsAt }
            return lhs.id < rhs.id
        }
    }

    func applyUserContext(id: String?, role: String?) {
        currentUserId = id
        currentUserRole = role ?? ""
        guard !didApplyUserDefault else { return }
        mineOnly = currentUserRole == "STUDENT"
        didApplyUserDefault = true
    }

    func load(reset: Bool = false) async {
        if reset {
            // Cancel any in-flight load so a tab switch / refresh wins.
            loadTask?.cancel()
        } else if isLoading {
            // Pagination: ignore if a load is already running.
            return
        }
        let task = Task { await performLoad(reset: reset) }
        loadTask = task
        await task.value
    }

    private func performLoad(reset: Bool) async {
        if reset {
            checkoutOffset = 0
            reservationOffset = 0
            hasMoreCheckouts = true
            hasMoreReservations = true
            pageError = nil
            // Seed from cache immediately on unfiltered first-page load.
            // Skip when "Mine" is on — cache contains everyone's bookings.
            if searchText.isEmpty && !mineOnly {
                let cachedCheckouts = GearStore.shared.cachedBookings(kind: "CHECKOUT").map(\.asBooking)
                let cachedReservations = GearStore.shared.cachedBookings(kind: "RESERVATION").map(\.asBooking)
                if !cachedCheckouts.isEmpty || !cachedReservations.isEmpty {
                    checkouts = cachedCheckouts
                    reservations = cachedReservations
                }
            }
        }
        isLoading = true
        if reset { error = nil }
        do {
            let search = searchText.isEmpty ? nil : searchText
            let requesterId = mineOnly ? currentUserId : nil
            async let checkoutPage = fetchCheckouts(search: search, requesterId: requesterId)
            async let reservationPage = fetchReservations(search: search, requesterId: requesterId)
            let (checkoutResult, reservationResult) = try await (checkoutPage, reservationPage)
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
            hasMoreCheckouts = checkoutOffset < checkoutResult.total
            hasMoreReservations = reservationOffset < reservationResult.total
            pageError = nil
            lastLoadedAt = Date()
            if reset && searchText.isEmpty && !mineOnly {
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

    private func fetchCheckouts(search: String?, requesterId: String?) async throws -> PaginatedResponse<Booking> {
        guard hasMoreCheckouts else {
            return PaginatedResponse(data: [], total: checkoutOffset, limit: limit, offset: checkoutOffset)
        }
        return try await APIClient.shared.checkouts(
            activeOnly: true,
            search: search,
            requesterId: requesterId,
            limit: limit,
            offset: checkoutOffset
        )
    }

    private func fetchReservations(search: String?, requesterId: String?) async throws -> PaginatedResponse<Booking> {
        guard hasMoreReservations else {
            return PaginatedResponse(data: [], total: reservationOffset, limit: limit, offset: reservationOffset)
        }
        return try await APIClient.shared.reservations(
            activeOnly: true,
            search: search,
            requesterId: requesterId,
            limit: limit,
            offset: reservationOffset
        )
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
            await load(reset: true)
        }
    }

    func resetDefaults() {
        searchTask?.cancel()
        loadTask?.cancel()
        searchText = ""
        mineOnly = currentUserRole == "STUDENT"
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
        // Students can create their own reservations; gate the picker, not the entry point.
        session.currentUser != nil
    }

    private var emptyTitle: String {
        guard vm.searchText.isEmpty else { return "No Results" }
        return vm.mineOnly ? "No Bookings" : "No Active Bookings"
    }

    private var emptyDescription: String {
        if !vm.searchText.isEmpty { return "No results for \"\(vm.searchText)\"." }
        if vm.mineOnly {
            return "Your active checkouts and reservations will appear here together."
        }
        return "Active checkouts and reservations appear here in one chronological list."
    }

    /// Clear legacy deep-link sub-tab hints. The unified list includes both
    /// booking types, with checkouts always above reservations.
    private func consumePendingTab() {
        guard appState.pendingBookingsTab != nil else { return }
        appState.pendingBookingsTab = nil
    }

    private var searchPrompt: String {
        "Search bookings..."
    }

    var body: some View {
        // Apple's recommended pattern for binding to an @Observable model.
        @Bindable var vm = vm
        return NavigationStack(path: $navigationPath) {
            Group {
                if let error = vm.error, vm.isEmpty {
                    ContentUnavailableView {
                        Label("Couldn't load bookings", systemImage: "exclamationmark.triangle")
                    } description: {
                        Text(error)
                    } actions: {
                        Button("Retry") { Task { await vm.load(reset: true) } }
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
                        Label(emptyTitle, systemImage: "archivebox")
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
                                .task(id: "\(vm.checkouts.count)-\(vm.reservations.count)") {
                                    await vm.load()
                                }
                        }
                    }
                    .listStyle(.plain)
                    .scrollContentBackground(.hidden)
                    .background(Color(.systemGroupedBackground))
                }
            }
            .navigationTitle("Bookings")
            .searchable(text: $vm.searchText, prompt: searchPrompt)
            .onChange(of: vm.searchText) { vm.onSearchChange() }
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button {
                        vm.mineOnly.toggle()
                        Task { await vm.load(reset: true) }
                    } label: {
                        Label(vm.mineOnly ? "Mine" : "All", systemImage: vm.mineOnly ? "person.fill" : "person.2")
                            .labelStyle(.titleAndIcon)
                            .frame(minHeight: 44)
                            .foregroundStyle(vm.mineOnly ? Color.statusText(.blue) : Color.primary)
                    }
                    .accessibilityLabel(vm.mineOnly ? "Showing my bookings" : "Showing all visible bookings")
                    .sensoryFeedback(.selection, trigger: vm.mineOnly)
                }
                if canCreate {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button { showCreate = true } label: {
                            Label("New", systemImage: "plus")
                                .labelStyle(.titleAndIcon)
                        }
                        .accessibilityLabel("New Reservation")
                    }
                }
            }
            .sheet(isPresented: $showCreate) {
                CreateBookingSheet { newId in
                    Task {
                        await vm.load(reset: true)
                        navigationPath.append(newId)
                    }
                }
            }
            .refreshable { await vm.load(reset: true) }
            .task {
                vm.applyUserContext(id: session.currentUser?.id, role: session.currentUser?.role)
                consumePendingTab()
                await vm.load(reset: true)
            }
            .onChange(of: appState.pendingBookingsTab) { _, _ in
                // A deep link arrived while this tab was already alive (e.g. the
                // dashboard "Overdue" tile). The unified list already includes
                // both booking types, so only clear the consumed hint.
                consumePendingTab()
            }
            .onChange(of: appState.tabResetToken) { _, _ in
                guard appState.resetTab == 1 else { return }
                showCreate = false
                navigationPath = NavigationPath()
                vm.resetDefaults()
                Task { await vm.load(reset: true) }
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
                Task { await vm.load(reset: true) }
            } label: {
                Label("Clear search", systemImage: "xmark.circle")
            }
            .buttonStyle(.borderedProminent)
        } else if vm.mineOnly {
            Button {
                vm.mineOnly = false
                Task { await vm.load(reset: true) }
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

struct BookingRow: View {
    let booking: Booking

    private var isOverdue: Bool {
        booking.status == .open && booking.endsAt < .now
    }

    private var itemCount: Int {
        booking.serializedItems.count + booking.bulkItems.count
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
        HStack(spacing: 12) {
            // Shared rail atom — inset top/bottom, matching the Next Up rows.
            StatusRail(tone: accentTone)
            UserAvatarView(name: booking.requester.name, avatarUrl: booking.requester.avatarUrl, size: 40)
            VStack(alignment: .leading, spacing: 5) {
                HStack(alignment: .firstTextBaseline) {
                    Text(booking.title)
                        .font(.subheadline.weight(.semibold))
                        .lineLimit(1)
                    Spacer()
                    StatusBadge(status: booking.status, kind: booking.kind, isOverdue: isOverdue)
                }
                HStack(spacing: 4) {
                    Text(booking.requester.name)
                    Text("·")
                    Text(booking.location.name)
                    if itemCount > 0 {
                        Text("·")
                        Text("\(itemCount) item\(itemCount == 1 ? "" : "s")")
                    }
                }
                .font(.caption)
                .foregroundStyle(.secondary)
                .lineLimit(1)
                // Live relative timing — 60s tick keeps "Due in 5h" / "Pickup 12m
                // late" fresh without per-second redraws, matching the dashboard rows.
                TimelineView(.periodic(from: .now, by: 60)) { context in
                    let info = relativeTiming(now: context.date)
                    Label {
                        Text(info.text).font(.caption2.weight(.medium))
                    } icon: {
                        Image(systemName: info.icon)
                            .font(.caption2)
                            .accessibilityHidden(true)
                    }
                    .foregroundStyle(info.urgent ? AnyShapeStyle(Color.statusText(.red)) : AnyShapeStyle(.secondary))
                }
            }
            Image(systemName: "chevron.right")
                .font(.caption2.weight(.semibold))
                .foregroundStyle(.tertiary)
                .accessibilityHidden(true)
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

    /// Compact, live relative timing for the row's bottom line. Checkouts count
    /// to their return (when OPEN) or their pickup window (before pickup);
    /// reservations count to their start. Urgent (red) once a window is missed.
    private func relativeTiming(now: Date) -> (text: String, icon: String, urgent: Bool) {
        if booking.kind == .checkout {
            switch booking.status {
            case .open:
                return booking.endsAt < now
                    ? ("\(booking.endsAt.compactMagnitude(now: now)) overdue", "exclamationmark.circle.fill", true)
                    : ("Due in \(booking.endsAt.compactMagnitude(now: now))", "clock", false)
            case .pendingPickup, .booked:
                return booking.startsAt < now
                    ? ("Pickup \(booking.startsAt.compactMagnitude(now: now)) late", "exclamationmark.circle.fill", true)
                    : ("Pickup in \(booking.startsAt.compactMagnitude(now: now))", "clock", false)
            default:
                return (booking.endsAt.gearShort, "clock", false)
            }
        }
        // Reservation: count to start, then read as active.
        return booking.startsAt > now
            ? ("Starts in \(booking.startsAt.compactMagnitude(now: now))", "calendar", false)
            : ("From \(booking.startsAt.formatted(date: .abbreviated, time: .omitted))", "calendar", false)
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
