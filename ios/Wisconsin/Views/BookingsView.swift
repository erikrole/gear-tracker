import SwiftUI

@MainActor
@Observable
final class BookingsViewModel {
    var bookings: [Booking] = []
    var isLoading = false
    var error: String?
    var searchText = ""
    var selectedStatus: BookingStatus?
    var hasMore = true

    private var offset = 0
    private let limit = 30
    private var searchTask: Task<Void, Never>?

    func load(reset: Bool = false) async {
        guard !isLoading else { return }
        if reset {
            offset = 0
            hasMore = true
            // Don't clear bookings — swap in place after fetch to avoid skeleton flash on tab return
        }
        isLoading = true
        error = nil
        do {
            let result = try await APIClient.shared.bookings(
                status: selectedStatus,
                search: searchText.isEmpty ? nil : searchText,
                limit: limit,
                offset: offset
            )
            if reset {
                bookings = result.data
            } else {
                bookings += result.data
            }
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
    @State private var createdBookingId = ""

    var body: some View {
        NavigationStack {
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
                        "No Bookings",
                        systemImage: "tray",
                        description: Text(vm.searchText.isEmpty ? "No bookings found." : "No results for \"\(vm.searchText)\".")
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
            .sensoryFeedback(.success, trigger: createdBookingId)
            .navigationTitle("Bookings")
            .searchable(text: $vm.searchText, prompt: "Search bookings…")
            .onChange(of: vm.searchText) { vm.onSearchChange() }
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button { showCreate = true } label: {
                        Image(systemName: "plus")
                    }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    StatusFilterMenu(selected: $vm.selectedStatus) {
                        Task { await vm.load(reset: true) }
                    }
                }
            }
            .sheet(isPresented: $showCreate) {
                CreateBookingSheet { newId in
                    createdBookingId = newId
                    Task { await vm.load(reset: true) }
                }
            }
            .refreshable { await vm.load(reset: true) }
            .task { await vm.load(reset: true) }
            .navigationDestination(for: Booking.self) { booking in
                BookingDetailView(bookingId: booking.id)
            }
        }
    }
}

struct BookingRow: View {
    let booking: Booking

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(booking.title)
                    .font(.headline)
                    .lineLimit(1)
                Spacer()
                StatusBadge(status: booking.status)
            }
            HStack(spacing: 4) {
                Text(booking.requester.name)
                Text("·")
                Text(booking.location.name)
            }
            .font(.subheadline)
            .foregroundStyle(.secondary)
            .lineLimit(1)
            Text("\(booking.startsAt.formatted(date: .abbreviated, time: .shortened)) – \(booking.endsAt.formatted(date: .omitted, time: .shortened))")
                .font(.caption)
                .foregroundStyle(.tertiary)
        }
        .padding(.vertical, 4)
    }
}

struct StatusFilterMenu: View {
    @Binding var selected: BookingStatus?
    let onSelect: () -> Void

    private let statuses: [BookingStatus?] = [nil, .booked, .pendingPickup, .open, .completed, .cancelled]

    var body: some View {
        Menu {
            ForEach(statuses, id: \.self) { status in
                Button {
                    selected = status
                    onSelect()
                } label: {
                    HStack {
                        Text(status?.label ?? "All")
                        if selected == status { Image(systemName: "checkmark") }
                    }
                }
            }
        } label: {
            Image(systemName: "line.3.horizontal.decrease.circle\(selected != nil ? ".fill" : "")")
        }
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
