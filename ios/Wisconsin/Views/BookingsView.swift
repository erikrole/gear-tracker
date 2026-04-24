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
    var searchText = ""
    var tab: BookingTab = .reservations
    var hasMore = true

    private var offset = 0
    private let limit = 30
    private var searchTask: Task<Void, Never>?

    func load(reset: Bool = false) async {
        guard !isLoading else { return }
        if reset {
            offset = 0
            hasMore = true
        }
        isLoading = true
        error = nil
        do {
            let search = searchText.isEmpty ? nil : searchText
            let result: PaginatedResponse<Booking> = switch tab {
            case .reservations:
                try await APIClient.shared.reservations(activeOnly: true, search: search, limit: limit, offset: offset)
            case .checkouts:
                try await APIClient.shared.checkouts(activeOnly: true, search: search, limit: limit, offset: offset)
            }
            if reset { bookings = result.data } else { bookings += result.data }
            offset += result.data.count
            hasMore = offset < result.total
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
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

    private var emptyTitle: String {
        guard vm.searchText.isEmpty else { return "No Results" }
        return vm.tab == .reservations ? "No Active Reservations" : "No Active Checkouts"
    }

    var body: some View {
        NavigationStack(path: $navigationPath) {
            Group {
                if let error = vm.error, vm.bookings.isEmpty {
                    ContentUnavailableView {
                        Label("Error", systemImage: "exclamationmark.triangle")
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
                        systemImage: "tray",
                        description: Text(vm.searchText.isEmpty ? "No active bookings here." : "No results for \"\(vm.searchText)\".")
                    )
                } else {
                    List {
                        ForEach(vm.bookings) { booking in
                            NavigationLink(value: booking) {
                                BookingRow(booking: booking)
                            }
                        }
                        if vm.hasMore {
                            ProgressView()
                                .frame(maxWidth: .infinity)
                                .onAppear {
                                    Task { await vm.load() }
                                }
                        }
                    }
                    .listStyle(.plain)
                }
            }
            .sensoryFeedback(.success, trigger: navigationPath)
            .navigationTitle("Bookings")
            .searchable(text: $vm.searchText, prompt: "Search bookings…")
            .onChange(of: vm.searchText) { vm.onSearchChange() }
            .onChange(of: vm.tab) { Task { await vm.load(reset: true) } }
            .toolbar {
                if vm.tab == .reservations {
                    ToolbarItem(placement: .topBarLeading) {
                        Button { showCreate = true } label: {
                            Image(systemName: "plus")
                        }
                    }
                }
                ToolbarItem(placement: .principal) {
                    Picker("Tab", selection: $vm.tab) {
                        ForEach(BookingTab.allCases, id: \.self) { tab in
                            Text(tab.rawValue).tag(tab)
                        }
                    }
                    .pickerStyle(.segmented)
                    .frame(width: 220)
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
            .task { await vm.load(reset: true) }
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
                StatusBadge(status: booking.status)
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
                .foregroundStyle(isOverdue ? AnyShapeStyle(Color.red) : AnyShapeStyle(.tertiary))
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

    var body: some View {
        Text(status.label)
            .font(.caption2.weight(.semibold))
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(badgeColor.opacity(0.15), in: Capsule())
            .foregroundStyle(badgeColor)
    }

    private var badgeColor: Color {
        switch status {
        case .draft: .gray
        case .booked: .blue
        case .pendingPickup: .orange
        case .open: .green
        case .completed: .secondary
        case .cancelled: .red
        case .unknown: .gray
        }
    }
}
