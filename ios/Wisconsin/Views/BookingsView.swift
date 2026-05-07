import SwiftUI

enum BookingTab: String, CaseIterable {
    case reservations = "Reservations"
    case checkouts = "Checkouts"
}

@MainActor
@Observable
final class BookingsViewModel {
    var bookings: [Booking] = []
    var isLoading = false
    var error: String?
    var pageError: String?
    var lastLoadedAt: Date?
    var searchText = ""
    var tab: BookingTab = .reservations
    var hasMore = true
    /// "Mine" filter — when on, list only shows bookings the current user
    /// requested. Mirrors the staff floor pattern of "what's mine right now".
    var mineOnly = false
    var currentUserId: String?

    private var offset = 0
    private let limit = 30
    private var searchTask: Task<Void, Never>?
    private var loadTask: Task<Void, Never>?

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
            offset = 0
            hasMore = true
            pageError = nil
            // Seed from cache immediately on unfiltered first-page load.
            // Skip when "Mine" is on — cache contains everyone's bookings.
            if searchText.isEmpty && !mineOnly {
                let kindKey = tab == .reservations ? "RESERVATION" : "CHECKOUT"
                let cached = GearStore.shared.cachedBookings(kind: kindKey)
                if !cached.isEmpty { bookings = cached.map(\.asBooking) }
            }
        }
        isLoading = true
        if reset { error = nil }
        do {
            let search = searchText.isEmpty ? nil : searchText
            let requesterId = mineOnly ? currentUserId : nil
            let result: PaginatedResponse<Booking> = switch tab {
            case .reservations:
                try await APIClient.shared.reservations(activeOnly: true, search: search, requesterId: requesterId, limit: limit, offset: offset)
            case .checkouts:
                try await APIClient.shared.checkouts(activeOnly: true, search: search, requesterId: requesterId, limit: limit, offset: offset)
            }
            if Task.isCancelled { isLoading = false; return }
            if reset { bookings = result.data } else { bookings += result.data }
            offset += result.data.count
            hasMore = offset < result.total
            pageError = nil
            lastLoadedAt = Date()
            if reset && offset == result.data.count && searchText.isEmpty && !mineOnly {
                GearStore.shared.seedBookings(result.data)
            }
        } catch is CancellationError {
            // Superseded by a newer load; leave state alone.
        } catch {
            if reset {
                self.error = error.localizedDescription
            } else {
                self.pageError = error.localizedDescription
                hasMore = false
            }
        }
        isLoading = false
    }

    func retryPage() async {
        pageError = nil
        hasMore = true
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
}

struct BookingsView: View {
    @State private var vm = BookingsViewModel()
    @State private var showCreate = false
    @State private var navigationPath = NavigationPath()
    @Environment(SessionStore.self) private var session

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
        if vm.mineOnly {
            return vm.tab == .reservations ? "No Reservations" : "No Checkouts"
        }
        return vm.tab == .reservations ? "No Active Reservations" : "No Active Checkouts"
    }

    private var emptyDescription: String {
        if !vm.searchText.isEmpty { return "No results for \"\(vm.searchText)\"." }
        if vm.mineOnly { return "Nothing checked out or reserved by you." }
        return "No active bookings here."
    }

    var body: some View {
        // Apple's recommended pattern for binding to an @Observable model.
        @Bindable var vm = vm
        return NavigationStack(path: $navigationPath) {
            Group {
                if let error = vm.error, vm.bookings.isEmpty {
                    ContentUnavailableView {
                        Label("Couldn't load bookings", systemImage: "exclamationmark.triangle")
                    } description: {
                        Text(error)
                    } actions: {
                        Button("Retry") { Task { await vm.load(reset: true) } }
                            .buttonStyle(.borderedProminent)
                    }
                } else if vm.bookings.isEmpty && vm.isLoading {
                    List {
                        ForEach(0..<8, id: \.self) { _ in
                            BookingRowSkeleton().listRowSeparator(.hidden)
                        }
                    }
                    .listStyle(.plain)
                    .allowsHitTesting(false)
                } else if vm.bookings.isEmpty {
                    ContentUnavailableView(
                        emptyTitle,
                        systemImage: "archivebox",
                        description: Text(emptyDescription)
                    )
                } else {
                    List {
                        if let stamp = vm.lastLoadedAt?.freshnessLabel {
                            Text(stamp)
                                .font(.caption2)
                                .foregroundStyle(.tertiary)
                                .frame(maxWidth: .infinity, alignment: .center)
                                .listRowSeparator(.hidden)
                                .listRowBackground(Color.clear)
                                .padding(.top, 2)
                        }
                        ForEach(vm.bookings) { booking in
                            NavigationLink(value: booking) {
                                BookingRow(booking: booking)
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
                        } else if vm.hasMore {
                            ProgressView()
                                .frame(maxWidth: .infinity)
                                .task(id: vm.bookings.count) {
                                    await vm.load()
                                }
                        }
                    }
                    .listStyle(.plain)
                }
            }
            .navigationTitle("Bookings")
            .searchable(text: $vm.searchText, prompt: "Search bookings…")
            .onChange(of: vm.searchText) { vm.onSearchChange() }
            .onChange(of: vm.tab) { Task { await vm.load(reset: true) } }
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button {
                        vm.mineOnly.toggle()
                        Task { await vm.load(reset: true) }
                    } label: {
                        Image(systemName: vm.mineOnly ? "person.fill" : "person")
                            .font(.subheadline.weight(.semibold))
                            .frame(width: 36, height: 36)
                    }
                    // Liquid Glass: interactive toolbar control. Active state
                    // tints with the status-blue token so it reads as a real
                    // selection, not just a pressed state.
                    .buttonStyle(.glass)
                    .tint(vm.mineOnly ? Color.statusText(.blue) : .primary)
                    .accessibilityLabel(vm.mineOnly ? "Showing my bookings" : "Show only my bookings")
                    .sensoryFeedback(.selection, trigger: vm.mineOnly)
                }
                if vm.tab == .reservations && canCreate {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button { showCreate = true } label: {
                            Image(systemName: "plus")
                        }
                        .accessibilityLabel("New Reservation")
                    }
                }
                ToolbarItem(placement: .principal) {
                    Picker("Tab", selection: $vm.tab) {
                        ForEach(BookingTab.allCases, id: \.self) { tab in
                            Text(tab.rawValue).tag(tab)
                        }
                    }
                    .pickerStyle(.segmented)
                    .frame(maxWidth: 260)
                    .fixedSize(horizontal: false, vertical: true)
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
                vm.currentUserId = session.currentUser?.id
                await vm.load(reset: true)
            }
            .navigationDestination(for: Booking.self) { booking in
                BookingDetailView(bookingId: booking.id)
            }
            .navigationDestination(for: String.self) { id in
                BookingDetailView(bookingId: id)
            }
        }
    }
}

struct BookingRow: View {
    let booking: Booking

    private var isOverdue: Bool {
        booking.status == .open && booking.endsAt < .now
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            HStack(alignment: .firstTextBaseline) {
                Text(booking.title)
                    .font(.subheadline.weight(.medium))
                    .lineLimit(1)
                Spacer()
                StatusBadge(status: booking.status, kind: booking.kind)
            }
            HStack(spacing: 4) {
                Text(booking.requester.name)
                Text("·")
                Text(booking.location.name)
            }
            .font(.caption)
            .foregroundStyle(.secondary)
            .lineLimit(1)
            if booking.kind == .checkout {
                Label {
                    Text(booking.endsAt.formatted(date: .abbreviated, time: .shortened))
                        .font(.caption2)
                } icon: {
                    Image(systemName: isOverdue ? "exclamationmark.circle.fill" : "clock")
                        .font(.caption2)
                }
                .foregroundStyle(isOverdue ? AnyShapeStyle(Color.statusText(.red)) : AnyShapeStyle(.tertiary))
            } else {
                Text("From \(booking.startsAt.formatted(date: .abbreviated, time: .omitted))")
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }
        }
        .padding(.vertical, 4)
    }
}


struct StatusBadge: View {
    let status: BookingStatus
    var kind: BookingKind = .unknown

    var body: some View {
        StatusPill(label: labelText, tone: tone)
    }

    private var labelText: String {
        if status == .booked { return kind == .reservation ? "Confirmed" : "Booked" }
        return status.label
    }

    private var tone: StatusTone {
        switch status {
        case .draft: return .gray
        case .booked: return kind == .reservation ? .purple : .blue
        case .pendingPickup: return .orange
        case .open: return .blue
        case .completed: return .gray
        case .cancelled: return .gray
        case .unknown: return .gray
        }
    }
}
