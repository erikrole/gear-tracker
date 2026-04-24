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
    @State private var showSearch = false
    @State private var showNotifications = false
    @Environment(AppState.self) private var appState

    var body: some View {
        NavigationStack {
            Group {
                if vm.dashboard == nil && vm.error == nil {
                    ScrollView {
                        VStack(alignment: .leading, spacing: 20) {
                            StatStripSkeleton()
                            VStack(alignment: .leading, spacing: 12) {
                                Skeleton().frame(width: 140, height: 14)
                                ForEach(0..<3, id: \.self) { _ in BookingRowSkeleton() }
                            }
                            VStack(alignment: .leading, spacing: 12) {
                                Skeleton().frame(width: 140, height: 14)
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
                        VStack(alignment: .leading, spacing: 20) {
                            StatStrip(stats: dash.stats)

                            let overdue = (dash.myCheckouts.items + dash.teamCheckouts.items).filter(\.isOverdue)
                            if !overdue.isEmpty {
                                OverdueBanner(items: overdue)
                            }

                            if !dash.myShifts.isEmpty {
                                DashboardCard(title: "My Upcoming Shifts") {
                                    ForEach(dash.myShifts) { shift in
                                        DashboardShiftRow(shift: shift)
                                    }
                                }
                            }

                            if !dash.myCheckouts.items.isEmpty {
                                DashboardCard(title: "My Checkouts") {
                                    ForEach(dash.myCheckouts.items) { summary in
                                        NavigationLink(value: summary) {
                                            BookingSummaryRow(summary: summary)
                                        }
                                        .buttonStyle(.plain)
                                    }
                                }
                            }

                            if !dash.teamCheckouts.items.isEmpty {
                                DashboardCard(title: "Team Checkouts") {
                                    ForEach(dash.teamCheckouts.items) { summary in
                                        NavigationLink(value: summary) {
                                            BookingSummaryRow(summary: summary)
                                        }
                                        .buttonStyle(.plain)
                                    }
                                }
                            }

                            if !dash.teamReservations.items.isEmpty {
                                DashboardCard(title: "Upcoming Reservations") {
                                    ForEach(dash.teamReservations.items) { summary in
                                        NavigationLink(value: summary) {
                                            BookingSummaryRow(summary: summary)
                                        }
                                        .buttonStyle(.plain)
                                    }
                                }
                            }

                            if !dash.upcomingEvents.isEmpty {
                                DashboardCard(title: "Upcoming Events") {
                                    ForEach(dash.upcomingEvents.prefix(6)) { event in
                                        EventSummaryRow(event: event)
                                    }
                                }
                            }
                        }
                        .padding()
                    }
                }
            }
            .navigationTitle("Dashboard")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showNotifications = true
                    } label: {
                        Image(systemName: appState.unreadNotifCount > 0 ? "bell.badge.fill" : "bell")
                            .symbolRenderingMode(.multicolor)
                    }
                    .accessibilityLabel(appState.unreadNotifCount > 0 ? "\(appState.unreadNotifCount) unread notifications" : "Notifications")
                }
            }
            .refreshable { await vm.load(appState: appState, forceRefresh: true) }
            .task { await vm.load(appState: appState) }
            .navigationDestination(for: BookingSummary.self) { summary in
                BookingDetailView(bookingId: summary.id)
            }
            .overlay(alignment: .bottomTrailing) {
                FloatingSearchButton(isPresented: $showSearch)
                    .padding(.trailing, 20)
                    .padding(.bottom, 20)
            }
            .sheet(isPresented: $showSearch) {
                GlobalSearchSheet()
            }
            .sheet(isPresented: $showNotifications, onDismiss: {
                Task { await appState.refresh() }
            }) {
                NotificationsSheet()
            }
        }
    }
}

// MARK: - Stat Strip

private struct StatStrip: View {
    let stats: DashboardStats

    var body: some View {
        HStack(spacing: 8) {
            StatCell(value: stats.overdue, label: "Overdue", isAlert: stats.overdue > 0)
            StatCell(value: stats.dueToday, label: "Due Today", isAlert: stats.dueToday > 0)
            StatCell(value: stats.checkedOut, label: "Checked Out", isAlert: false)
            StatCell(value: stats.reserved, label: "Reserved", isAlert: false)
        }
    }
}

private struct StatCell: View {
    let value: Int
    let label: String
    let isAlert: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("\(value)")
                .font(.system(size: 26, weight: .bold))
                .foregroundStyle(isAlert ? Color.red : Color.primary)
                .contentTransition(.numericText())
            Text(label)
                .font(.caption2)
                .foregroundStyle(.secondary)
                .lineLimit(1)
                .minimumScaleFactor(0.75)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.systemBackground), in: RoundedRectangle(cornerRadius: 12))
        .shadow(color: .black.opacity(0.06), radius: 4, x: 0, y: 2)
        .shadow(color: .black.opacity(0.04), radius: 2, x: 0, y: 1)
    }
}

private struct StatStripSkeleton: View {
    var body: some View {
        HStack(spacing: 8) {
            ForEach(0..<4, id: \.self) { _ in
                VStack(alignment: .leading, spacing: 6) {
                    Skeleton().frame(width: 32, height: 24)
                    Skeleton().frame(width: 50, height: 10)
                }
                .padding(12)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color(.systemBackground), in: RoundedRectangle(cornerRadius: 12))
            }
        }
    }
}

// MARK: - Overdue Banner

private struct OverdueBanner: View {
    let items: [BookingSummary]

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Label("\(items.count) Overdue Checkout\(items.count == 1 ? "" : "s")",
                  systemImage: "exclamationmark.triangle.fill")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.red)

            ForEach(items) { summary in
                NavigationLink(value: summary) {
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(summary.title)
                                .font(.subheadline.weight(.medium))
                                .foregroundStyle(.primary)
                                .lineLimit(1)
                            Text(summary.requesterName)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        Spacer()
                        Text(summary.endsAt.overdueLabel)
                            .font(.caption.weight(.medium))
                            .foregroundStyle(.red)
                    }
                }
                .buttonStyle(.plain)

                if summary.id != items.last?.id {
                    Divider()
                }
            }
        }
        .padding(14)
        .background(Color.red.opacity(0.06), in: RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .strokeBorder(Color.red.opacity(0.18), lineWidth: 1)
        )
    }
}

// MARK: - Dashboard Card

private struct DashboardCard<Content: View>: View {
    let title: String
    @ViewBuilder let content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title)
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
                .textCase(.uppercase)
                .tracking(0.3)
            content()
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.systemBackground), in: RoundedRectangle(cornerRadius: 12))
        .shadow(color: .black.opacity(0.06), radius: 4, x: 0, y: 2)
        .shadow(color: .black.opacity(0.04), radius: 2, x: 0, y: 1)
    }
}

// MARK: - Booking Summary Row

struct BookingSummaryRow: View {
    let summary: BookingSummary

    var body: some View {
        HStack(spacing: 12) {
            initialsCircle

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
                    Text(summary.endsAt.overdueLabel)
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
        .padding(.vertical, 4)
    }

    private var initialsCircle: some View {
        ZStack {
            Circle()
                .fill(summary.isOverdue ? Color.red.opacity(0.12) : Color.accentColor.opacity(0.1))
                .frame(width: 36, height: 36)
            Text(summary.requesterInitials)
                .font(.caption2.weight(.semibold))
                .foregroundStyle(summary.isOverdue ? Color.red : Color.accentColor)
        }
    }
}

// MARK: - Shift Row

private struct DashboardShiftRow: View {
    let shift: DashboardShift

    var body: some View {
        HStack(spacing: 12) {
            VStack(alignment: .center, spacing: 1) {
                Text(shift.startsAt.formatted(.dateTime.month(.abbreviated).day()))
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(.secondary)
                Text(shift.startsAt.formatted(.dateTime.hour().minute()))
                    .font(.caption.monospacedDigit().weight(.medium))
            }
            .frame(width: 46)
            .padding(.vertical, 6)
            .background(.quaternary.opacity(0.5))
            .clipShape(RoundedRectangle(cornerRadius: 8))

            VStack(alignment: .leading, spacing: 2) {
                Text(shift.event.summary)
                    .font(.subheadline.weight(.medium))
                    .lineLimit(1)
                HStack(spacing: 4) {
                    Text(shift.area)
                    if let loc = shift.event.locationName {
                        Text("·")
                        Text(loc)
                    }
                }
                .font(.caption)
                .foregroundStyle(.secondary)
                .lineLimit(1)
                if shift.hasGear {
                    Label(shift.gearLabel, systemImage: "checkmark.circle.fill")
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(.green)
                }
            }
            Spacer()
        }
        .padding(.vertical, 2)
    }
}

// MARK: - Event Summary Row

private struct EventSummaryRow: View {
    let event: DashboardUpcomingEvent

    var body: some View {
        HStack(spacing: 12) {
            VStack(alignment: .center, spacing: 0) {
                Text(event.startsAt.formatted(.dateTime.month(.abbreviated)))
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(.secondary)
                Text(event.startsAt.formatted(.dateTime.day()))
                    .font(.title3.weight(.bold))
            }
            .frame(width: 34)

            VStack(alignment: .leading, spacing: 2) {
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
                            .font(.caption)
                            .foregroundStyle(.tertiary)
                        Text("\(event.filledShiftSlots)/\(event.totalShiftSlots) crew")
                            .font(.caption)
                            .foregroundStyle(
                                event.coveragePct >= 100 ? .green :
                                event.coveragePct > 0 ? .orange : .red
                            )
                    }
                }
            }

            Spacer()

            if let isHome = event.isHome {
                Text(isHome ? "Home" : "Away")
                    .font(.caption2.weight(.medium))
                    .foregroundStyle(isHome ? .green : .orange)
            }
        }
        .padding(.vertical, 3)
    }
}

// MARK: - Helpers

private extension Date {
    var overdueLabel: String {
        let hours = Int(-self.timeIntervalSinceNow / 3600)
        if hours < 24 { return "\(hours)h overdue" }
        let days = hours / 24
        return "\(days)d overdue"
    }
}
