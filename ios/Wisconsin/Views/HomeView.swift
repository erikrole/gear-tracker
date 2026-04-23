import SwiftUI

@MainActor
@Observable
final class HomeViewModel {
    var dashboard: DashboardData?
    var isLoading = false
    var error: String?
    private var hasLoaded = false

    func load(appState: AppState? = nil, forceRefresh: Bool = false) async {
        guard !isLoading else { return }
        guard !hasLoaded || forceRefresh else { return }
        isLoading = true
        error = nil
        do {
            dashboard = try await APIClient.shared.dashboard()
            if let appState {
                appState.overdueCount = dashboard?.overdueCount ?? 0
                appState.myShiftCount = dashboard?.myShifts.count ?? 0
            }
            hasLoaded = true
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }
}

struct HomeView: View {
    @State private var vm = HomeViewModel()
    @Environment(AppState.self) private var appState

    var body: some View {
        NavigationStack {
            Group {
                if vm.dashboard == nil && vm.error == nil {
                    ScrollView {
                        VStack(alignment: .leading, spacing: 24) {
                            StatCardSkeleton()
                            VStack(alignment: .leading, spacing: 12) {
                                Skeleton().frame(width: 140, height: 16)
                                ForEach(0..<3, id: \.self) { _ in ShiftRowSkeleton() }
                            }
                            VStack(alignment: .leading, spacing: 12) {
                                Skeleton().frame(width: 140, height: 16)
                                ForEach(0..<4, id: \.self) { _ in BookingRowSkeleton() }
                            }
                        }
                        .padding()
                    }
                    .allowsHitTesting(false)
                } else if let error = vm.error, vm.dashboard == nil {
                    ContentUnavailableView {
                        Label("Error", systemImage: "exclamationmark.triangle")
                    } description: {
                        Text(error)
                    } actions: {
                        Button("Retry") { Task { await vm.load(appState: appState, forceRefresh: true) } }
                            .buttonStyle(.borderedProminent)
                    }
                } else if let dash = vm.dashboard {
                    ScrollView {
                        VStack(alignment: .leading, spacing: 24) {
                            StatsGrid(stats: dash.stats)

                            if !dash.myShifts.isEmpty {
                                MyShiftsSection(shifts: dash.myShifts)
                            }

                            if !dash.upcomingEvents.isEmpty {
                                UpcomingEventsSection(events: dash.upcomingEvents)
                            }

                            if !dash.myCheckouts.items.isEmpty {
                                BookingSummarySection(
                                    title: "My Active Checkouts",
                                    items: dash.myCheckouts.items,
                                    overdue: dash.myCheckouts.overdue
                                )
                            }

                            if !dash.teamCheckouts.items.isEmpty {
                                BookingSummarySection(
                                    title: "Team Checkouts",
                                    items: dash.teamCheckouts.items,
                                    overdue: dash.teamCheckouts.overdue
                                )
                            }

                            if !dash.teamReservations.items.isEmpty {
                                BookingSummarySection(
                                    title: "Upcoming Reservations",
                                    items: dash.teamReservations.items,
                                    overdue: 0
                                )
                            }
                        }
                        .padding()
                    }
                }
            }
            .navigationTitle("Dashboard")
            .refreshable { await vm.load(appState: appState, forceRefresh: true) }
            .task { await vm.load(appState: appState) }
            .navigationDestination(for: BookingSummary.self) { summary in
                BookingDetailView(bookingId: summary.id)
            }
        }
    }
}

// MARK: - My Shifts Section

struct MyShiftsSection: View {
    let shifts: [DashboardShift]

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("My Upcoming Shifts")
                .font(.headline)

            ForEach(shifts) { shift in
                HStack(spacing: 12) {
                    // Call time
                    VStack(alignment: .center, spacing: 2) {
                        Text(shift.startsAt.formatted(.dateTime.month(.abbreviated).day()))
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(.secondary)
                        Text(shift.startsAt.formatted(.dateTime.hour().minute()))
                            .font(.caption.monospacedDigit().weight(.medium))
                    }
                    .frame(width: 48)
                    .padding(.vertical, 8)
                    .background(.quaternary.opacity(0.6))
                    .clipShape(RoundedRectangle(cornerRadius: 8))

                    VStack(alignment: .leading, spacing: 3) {
                        Text(shift.event.summary)
                            .font(.subheadline.weight(.medium))
                            .lineLimit(1)
                        HStack(spacing: 6) {
                            Text(shift.area)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            if let loc = shift.event.locationName {
                                Text("·")
                                    .foregroundStyle(.tertiary)
                                Text(loc)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                        if shift.hasGear {
                            Label(shift.gearLabel, systemImage: "checkmark.circle.fill")
                                .font(.caption2.weight(.semibold))
                                .foregroundStyle(.green)
                        }
                    }

                    Spacer()
                }
                .padding(10)
                .background(.quaternary.opacity(0.3), in: RoundedRectangle(cornerRadius: 10))
            }
        }
    }
}

// MARK: - Upcoming Events Section

struct UpcomingEventsSection: View {
    let events: [DashboardUpcomingEvent]

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Upcoming Events")
                .font(.headline)

            ForEach(events.prefix(5)) { event in
                HStack(spacing: 12) {
                    // Date column
                    VStack(alignment: .center, spacing: 1) {
                        Text(event.startsAt.formatted(.dateTime.month(.abbreviated)))
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(.secondary)
                        Text(event.startsAt.formatted(.dateTime.day()))
                            .font(.title3.weight(.bold))
                    }
                    .frame(width: 36)

                    VStack(alignment: .leading, spacing: 3) {
                        Text(event.title)
                            .font(.subheadline.weight(.medium))
                            .lineLimit(1)
                        HStack(spacing: 6) {
                            if let sport = sportLabel(event.sportCode) {
                                Text(sport)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            if event.totalShiftSlots > 0 {
                                Text("·")
                                    .foregroundStyle(.tertiary)
                                Text("\(event.filledShiftSlots)/\(event.totalShiftSlots) crew")
                                    .font(.caption)
                                    .foregroundStyle(event.coveragePct >= 100 ? .green : event.coveragePct > 0 ? .orange : .red)
                            }
                        }
                    }

                    Spacer()
                }
                .padding(.vertical, 4)
            }
        }
    }
}

// MARK: - Stats Grid

struct StatsGrid: View {
    let stats: DashboardStats

    var body: some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
            StatCard(value: stats.checkedOut, label: "Checked Out", icon: "arrow.up.circle", color: .blue)
            StatCard(value: stats.overdue, label: "Overdue", icon: "exclamationmark.circle", color: stats.overdue > 0 ? .red : .secondary)
            StatCard(value: stats.dueToday, label: "Due Today", icon: "clock", color: stats.dueToday > 0 ? .orange : .secondary)
            StatCard(value: stats.reserved, label: "Reserved", icon: "calendar.badge.clock", color: .purple)
        }
    }
}

struct StatCard: View {
    let value: Int
    let label: String
    let icon: String
    let color: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: icon)
                    .foregroundStyle(color)
                Spacer()
            }
            Text("\(value)")
                .font(.system(size: 32, weight: .bold, design: .rounded))
                .foregroundStyle(value > 0 ? color : .primary)
            Text(label)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding()
        .background(.quaternary, in: RoundedRectangle(cornerRadius: 12))
    }
}

// MARK: - Booking Summary Section

struct BookingSummarySection: View {
    let title: String
    let items: [BookingSummary]
    let overdue: Int

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text(title)
                    .font(.headline)
                Spacer()
                if overdue > 0 {
                    Label("\(overdue) overdue", systemImage: "exclamationmark.circle.fill")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.red)
                }
            }

            ForEach(items) { summary in
                NavigationLink(value: summary) {
                    BookingSummaryRow(summary: summary)
                }
                .buttonStyle(.plain)
            }
        }
    }
}

struct BookingSummaryRow: View {
    let summary: BookingSummary

    var body: some View {
        HStack(spacing: 12) {
            ZStack {
                Circle()
                    .fill(summary.isOverdue ? Color.red.opacity(0.15) : Color.blue.opacity(0.12))
                    .frame(width: 40, height: 40)
                Text(summary.requesterInitials)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(summary.isOverdue ? .red : .blue)
            }

            VStack(alignment: .leading, spacing: 2) {
                Text(summary.title)
                    .font(.subheadline.weight(.medium))
                    .lineLimit(1)
                HStack(spacing: 4) {
                    Text(summary.requesterName)
                    if let loc = summary.locationName {
                        Text("·")
                        Text(loc)
                    }
                }
                .font(.caption)
                .foregroundStyle(.secondary)
                .lineLimit(1)
                if summary.isOverdue {
                    Label("Overdue · due \(summary.endsAt.formatted(date: .abbreviated, time: .shortened))", systemImage: "exclamationmark.circle")
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(.red)
                } else {
                    Text("Due \(summary.endsAt.formatted(date: .abbreviated, time: .shortened))")
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                }
            }

            Spacer()

            if summary.itemCount > 0 {
                Text("\(summary.itemCount)")
                    .font(.caption.monospacedDigit())
                    .foregroundStyle(.secondary)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(.quaternary, in: Capsule())
            }
        }
        .padding(12)
        .background(.quaternary.opacity(0.5), in: RoundedRectangle(cornerRadius: 10))
    }
}
