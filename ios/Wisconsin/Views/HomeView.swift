import SwiftUI
import UIKit

@MainActor
@Observable
final class HomeViewModel {
    var dashboard: DashboardData?
    var isLoading = false
    var error: String?
    var lastLoadedAt: Date?

    /// Refresh if data is older than this. `.task` fires on every appearance,
    /// so without a freshness check we'd hammer the endpoint on every tab switch.
    private static let freshnessWindow: TimeInterval = 60

    func load(appState: AppState? = nil, forceRefresh: Bool = false) async {
        guard !isLoading else { return }
        if !forceRefresh, let last = lastLoadedAt, Date().timeIntervalSince(last) < Self.freshnessWindow {
            return
        }
        isLoading = true
        do {
            dashboard = try await APIClient.shared.dashboard()
            if let appState {
                appState.overdueCount = dashboard?.overdueCount ?? 0
                appState.myShiftCount = dashboard?.myShifts.count ?? 0
            }
            error = nil
            lastLoadedAt = Date()
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
    @State private var showTrades = false
    @State private var showProfile = false
    @State private var navigationPath = NavigationPath()
    @State private var pendingBookingId: String?
    @State private var pendingAssetId: String?
    @State private var pendingShowTrades = false
    @State private var selectedScheduleEvent: ScheduleEvent?
    @Environment(AppState.self) private var appState
    @Environment(SessionStore.self) private var session
    @Environment(KioskStore.self) private var kiosk

    @ViewBuilder private var mainContent: some View {
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
                Label("Couldn't load dashboard", systemImage: "exclamationmark.triangle")
            } description: {
                Text(error)
            } actions: {
                Button("Retry") { Task { await vm.load(appState: appState, forceRefresh: true) } }
                    .buttonStyle(.borderedProminent)
            }
        } else if let dash = vm.dashboard {
            dashboardScrollView(dash)
        }
    }

    private func isAllEmpty(_ dash: DashboardData) -> Bool {
        dash.myCheckouts.items.isEmpty
            && dash.teamCheckouts.items.isEmpty
            && dash.teamReservations.items.isEmpty
            && dash.pendingPickups.items.isEmpty
            && dash.myShifts.isEmpty
            && dash.upcomingEvents.isEmpty
            && dash.overdueItems.isEmpty
    }

    @ViewBuilder private func dashboardScrollView(_ dash: DashboardData) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                if vm.error != nil {
                    RefreshFailurePill(message: vm.error ?? "")
                }
                StatStrip(stats: dash.stats, onTap: { appState.selectedTab = 1 })
                if let loadedAt = vm.lastLoadedAt {
                    Text("Updated \(loadedAt.formatted(.relative(presentation: .named)))")
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                        .frame(maxWidth: .infinity, alignment: .trailing)
                        .padding(.top, -12)
                }
                if !dash.overdueItems.isEmpty {
                    OverdueBanner(totalCount: dash.overdueCount, items: dash.overdueItems)
                }
                if dash.isStaff && !dash.flaggedItems.isEmpty {
                    FlaggedItemsBanner(items: dash.flaggedItems)
                }
                if dash.isAdmin && !dash.lostBulkUnits.isEmpty {
                    LostBulkUnitsBanner(items: dash.lostBulkUnits)
                }
                if isAllEmpty(dash) {
                    AllClearEmptyState()
                }
                if !dash.pendingPickups.items.isEmpty {
                    DashboardCard(
                        title: "Awaiting Pickup\(dash.pendingPickups.total > dash.pendingPickups.items.count ? " (\(dash.pendingPickups.total))" : "")",
                        seeAllTab: 1,
                        appState: appState
                    ) {
                        ForEach(dash.pendingPickups.items) { summary in
                            BookingSummaryNavRow(summary: summary)
                        }
                    }
                }
                if dash.isStaff && !dash.drafts.isEmpty {
                    DashboardCard(title: "Drafts", seeAllTab: 1, appState: appState) {
                        ForEach(dash.drafts) { draft in
                            DraftRow(draft: draft)
                        }
                    }
                }
                if !dash.myShifts.isEmpty {
                    DashboardCard(title: "My Upcoming Shifts", seeAllTab: 4, appState: appState) {
                        ForEach(dash.myShifts) { shift in
                            Button { selectedScheduleEvent = shift.asScheduleEvent } label: {
                                DashboardShiftRow(shift: shift)
                            }
                            .buttonStyle(.plain)
                            .contentShape(.contextMenuPreview, RoundedRectangle(cornerRadius: 8))
                            .contextMenu {
                                Button {
                                    appState.selectedTab = 4
                                } label: {
                                    Label("Open in Schedule", systemImage: "calendar")
                                }
                            }
                        }
                    }
                }
                if !dash.myCheckouts.items.isEmpty {
                    DashboardCard(title: "My Checkouts", seeAllTab: 1, appState: appState) {
                        ForEach(dash.myCheckouts.items) { summary in
                            BookingSummaryNavRow(summary: summary)
                        }
                    }
                }
                if !dash.teamCheckouts.items.isEmpty {
                    DashboardCard(title: "Team Checkouts", seeAllTab: 1, appState: appState) {
                        ForEach(dash.teamCheckouts.items) { summary in
                            BookingSummaryNavRow(summary: summary)
                        }
                    }
                }
                if !dash.teamReservations.items.isEmpty {
                    DashboardCard(title: "Upcoming Reservations", seeAllTab: 1, appState: appState) {
                        ForEach(dash.teamReservations.items) { summary in
                            BookingSummaryNavRow(summary: summary)
                        }
                    }
                }
                if !dash.upcomingEvents.isEmpty {
                    DashboardCard(title: "Upcoming Events", seeAllTab: 4, appState: appState) {
                        ForEach(dash.upcomingEvents.prefix(6)) { event in
                            Button { selectedScheduleEvent = event.asScheduleEvent } label: {
                                EventSummaryRow(event: event)
                            }
                            .buttonStyle(.plain)
                            .contentShape(.contextMenuPreview, RoundedRectangle(cornerRadius: 8))
                            .contextMenu {
                                Button {
                                    appState.selectedTab = 4
                                } label: {
                                    Label("Open in Schedule", systemImage: "calendar")
                                }
                            }
                        }
                    }
                }
            }
            .padding()
        }
        .sheet(item: $selectedScheduleEvent) { event in
            EventDetailSheet(event: event, myShift: nil)
        }
    }

    var body: some View {
        NavigationStack(path: $navigationPath) {
            mainContent
                .navigationTitle("Home")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button {
                        showProfile = true
                    } label: {
                        AccountAvatar(size: 32)
                            .overlay(
                                Circle().strokeBorder(Color(.separator), lineWidth: 0.5)
                            )
                    }
                    .accessibilityLabel("Profile")
                }
                #if DEBUG
                ToolbarItem(placement: .topBarLeading) {
                    Button("Kiosk") { kiosk.enterKiosk() }
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                }
                #endif
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
            .onChange(of: appState.pendingPushBookingId) { _, id in
                if let id {
                    navigationPath.append(id)
                    appState.pendingPushBookingId = nil
                }
            }
            .onAppear {
                if let id = appState.pendingPushBookingId {
                    navigationPath.append(id)
                    appState.pendingPushBookingId = nil
                }
            }
            .navigationDestination(for: BookingSummary.self) { summary in
                BookingDetailView(bookingId: summary.id)
            }
            .navigationDestination(for: String.self) { id in
                BookingDetailView(bookingId: id)
            }
            .navigationDestination(for: AssetRouteId.self) { route in
                ItemDetailView(assetId: route.id)
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
                if let id = pendingBookingId {
                    navigationPath.append(id)
                    pendingBookingId = nil
                }
                if let assetId = pendingAssetId {
                    navigationPath.append(AssetRouteId(id: assetId))
                    pendingAssetId = nil
                }
                if pendingShowTrades {
                    pendingShowTrades = false
                    showTrades = true
                }
            }) {
                NotificationsSheet(
                    onSelectBooking: { id in pendingBookingId = id },
                    onSelectTrades: { pendingShowTrades = true },
                    onSelectAsset: { id in pendingAssetId = id }
                )
            }
            .sheet(isPresented: $showTrades) {
                TradeBoardSheet(myShifts: [], currentUserId: session.currentUser?.id ?? "")
            }
            .sheet(isPresented: $showProfile) {
                ProfileView()
                    .presentationDetents([.medium, .large])
                    .presentationDragIndicator(.visible)
            }
        }
    }
}

// MARK: - Stat Strip

private struct StatStrip: View {
    let stats: DashboardStats
    let onTap: () -> Void

    var body: some View {
        HStack(spacing: 8) {
            // Tones mirror the web's status taxonomy:
            //   red    = Overdue
            //   orange = Due Today (warning)
            //   blue   = Checked Out
            //   purple = Reserved
            // Cells with a non-zero value light up; zero stays neutral so the
            // strip doesn't shout when there's nothing to act on.
            StatCell(value: stats.overdue, label: "Overdue",
                     tone: stats.overdue > 0 ? .red : nil, onTap: onTap)
            StatCell(value: stats.dueToday, label: "Due Today",
                     tone: stats.dueToday > 0 ? .orange : nil, onTap: onTap)
            StatCell(value: stats.checkedOut, label: "Checked Out",
                     tone: stats.checkedOut > 0 ? .blue : nil, onTap: onTap)
            StatCell(value: stats.reserved, label: "Reserved",
                     tone: stats.reserved > 0 ? .purple : nil, onTap: onTap)
        }
    }
}

private struct StatCell: View {
    let value: Int
    let label: String
    let tone: StatusTone?
    let onTap: () -> Void
    @State private var hapticTrigger = false

    var body: some View {
        Button(action: {
            hapticTrigger.toggle()
            onTap()
        }) {
            VStack(alignment: .leading, spacing: 4) {
                Text("\(value)")
                    .font(.title.weight(.bold))
                    .monospacedDigit()
                    .foregroundStyle(tone.map { Color.statusText($0) } ?? Color.primary)
                    .contentTransition(.numericText())
                Text(label)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color(.systemBackground), in: RoundedRectangle(cornerRadius: 12))
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .strokeBorder(Color(.separator).opacity(0.5), lineWidth: 0.5)
            )
        }
        .buttonStyle(.plain)
        .sensoryFeedback(.selection, trigger: hapticTrigger)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(label): \(value) item\(value == 1 ? "" : "s")")
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
        .accessibilityHidden(true)  // Don't pollute VO with placeholder shapes during initial load.
    }
}

// MARK: - Overdue Banner

private struct OverdueBanner: View {
    let totalCount: Int
    let items: [DashboardOverdueItem]

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Label {
                Text("\(totalCount) Overdue Checkout\(totalCount == 1 ? "" : "s")")
            } icon: {
                Image(systemName: "exclamationmark.triangle.fill")
                    .accessibilityHidden(true)
            }
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(Color.statusText(.red))

            ForEach(items) { item in
                NavigationLink(value: item.bookingId) {
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(item.bookingTitle)
                                .font(.subheadline.weight(.medium))
                                .foregroundStyle(.primary)
                                .lineLimit(1)
                            Text(item.requesterName)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        Spacer()
                        Text(item.endsAt.overdueLabel)
                            .font(.caption.weight(.medium))
                            .foregroundStyle(Color.statusText(.red))
                    }
                }
                .buttonStyle(.plain)
                .accessibilityElement(children: .combine)
                .accessibilityLabel("Overdue: \(item.bookingTitle), \(item.requesterName), \(item.endsAt.overdueLabel)")

                if item.id != items.last?.id {
                    Divider()
                }
            }

            if totalCount > items.count {
                Text("+ \(totalCount - items.count) more")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(14)
        .background(Color.statusBackground(.red), in: RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .strokeBorder(Color.statusText(.red).opacity(0.2), lineWidth: 1)
        )
    }
}

// MARK: - Refresh Failure Pill

private struct RefreshFailurePill: View {
    let message: String

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: "exclamationmark.circle.fill")
                .foregroundStyle(Color.statusText(.orange))
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 1) {
                Text("Couldn't refresh")
                    .font(.caption.weight(.semibold))
                Text(message.isEmpty ? "Pull to try again." : message)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }
            Spacer()
        }
        .padding(10)
        .background(Color.statusBackground(.orange), in: RoundedRectangle(cornerRadius: 10))
        .accessibilityElement(children: .combine)
    }
}

// MARK: - All Clear Empty State

private struct AllClearEmptyState: View {
    var body: some View {
        VStack(spacing: 10) {
            Image(systemName: "checkmark.seal.fill")
                .font(.system(size: 36))
                .foregroundStyle(Color.statusText(.green))
                .accessibilityHidden(true)
            Text("You're all set")
                .font(.headline)
            Text("Open the Scan tab to check out gear.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(28)
        .background(Color(.systemBackground), in: RoundedRectangle(cornerRadius: 12))
        .accessibilityElement(children: .combine)
    }
}

// MARK: - Dashboard Card

private struct DashboardCard<Content: View>: View {
    let title: String
    var seeAllTab: Int? = nil
    var appState: AppState? = nil
    @ViewBuilder let content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text(title)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                    .textCase(.uppercase)
                    .tracking(0.3)
                Spacer()
                if let tab = seeAllTab, let appState {
                    Button {
                        appState.selectedTab = tab
                    } label: {
                        HStack(spacing: 2) {
                            Text("See all")
                                .font(.caption2)
                            Image(systemName: "chevron.right")
                                .font(.system(size: 8, weight: .semibold))
                        }
                        .foregroundStyle(.secondary)
                    }
                }
            }
            content()
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.systemBackground), in: RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .strokeBorder(Color(.separator).opacity(0.5), lineWidth: 0.5)
        )
    }
}

// MARK: - Booking Summary Nav Row

/// Navigation row used by the three dashboard cards (My Checkouts, Team Checkouts,
/// Team Reservations). Wraps `BookingSummaryRow` with the standard NavigationLink
/// + context menu (Copy Ref #, Copy Title) so the three cards stay in sync.
private struct BookingSummaryNavRow: View {
    let summary: BookingSummary

    var body: some View {
        NavigationLink(value: summary) { BookingSummaryRow(summary: summary) }
            .buttonStyle(.plain)
            .contentShape(.contextMenuPreview, RoundedRectangle(cornerRadius: 8))
            .contextMenu {
                if let ref = summary.refNumber {
                    Button {
                        UIPasteboard.general.string = ref
                    } label: {
                        Label("Copy Ref #", systemImage: "doc.on.doc")
                    }
                }
                Button {
                    UIPasteboard.general.string = summary.title
                } label: {
                    Label("Copy Title", systemImage: "doc.on.doc")
                }
            }
    }
}

// MARK: - Booking Summary Row

struct BookingSummaryRow: View {
    let summary: BookingSummary

    private var pickupIsLate: Bool {
        summary.status == .pendingPickup && summary.startsAt < Date()
    }

    private var barColor: Color {
        if summary.isOverdue { return Color.statusText(.red) }
        if pickupIsLate { return Color.statusText(.orange) }
        switch summary.status {
        case .open: return .accentColor
        case .booked, .pendingPickup: return Color.statusText(.green)
        default: return Color(.systemGray4)
        }
    }

    var body: some View {
        HStack(spacing: 0) {
            Rectangle()
                .fill(barColor)
                .frame(width: 3)
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
                            .foregroundStyle(Color.statusText(.red))
                    } else if summary.status == .pendingPickup {
                        if pickupIsLate {
                            Text("Pickup \(summary.startsAt.lateLabel)")
                                .font(.caption2.weight(.semibold))
                                .foregroundStyle(Color.statusText(.orange))
                        } else {
                            Text("Pickup \(summary.startsAt.formatted(date: .abbreviated, time: .shortened))")
                                .font(.caption2)
                                .foregroundStyle(.tertiary)
                        }
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
            .padding(.leading, 12)
        }
        .clipShape(RoundedRectangle(cornerRadius: 6))
        .accessibilityElement(children: .combine)
        .accessibilityLabel(rowAccessibilityLabel)
    }

    private var initialsCircle: some View {
        ZStack {
            Circle()
                .fill(summary.isOverdue ? Color.statusBackground(.red) : Color.accentColor.opacity(0.1))
                .frame(width: 36, height: 36)
            Text(summary.requesterInitials)
                .font(.caption2.weight(.semibold))
                .foregroundStyle(summary.isOverdue ? Color.statusText(.red) : Color.accentColor)
        }
        .accessibilityHidden(true)
    }

    /// Single combined VoiceOver readout for the row. Surfaces overdue / late
    /// state first when applicable so VO users hear the most important fact
    /// without scrolling through five separate announcements.
    private var rowAccessibilityLabel: String {
        var parts: [String] = []
        if summary.isOverdue { parts.append("Overdue") }
        else if summary.status == .pendingPickup, pickupIsLate { parts.append("Pickup late") }

        parts.append(summary.title)
        parts.append(summary.requesterName)
        if let loc = summary.locationName { parts.append(loc) }

        if summary.isOverdue {
            parts.append(summary.endsAt.overdueLabel)
        } else if summary.status == .pendingPickup {
            if pickupIsLate {
                parts.append("Pickup \(summary.startsAt.lateLabel)")
            } else {
                parts.append("Pickup \(summary.startsAt.formatted(date: .abbreviated, time: .shortened))")
            }
        } else {
            parts.append("Due \(summary.endsAt.formatted(date: .abbreviated, time: .shortened))")
        }

        if summary.itemCount > 0 {
            parts.append("\(summary.itemCount) item\(summary.itemCount == 1 ? "" : "s")")
        }
        return parts.joined(separator: ", ")
    }
}

// MARK: - Shift Row

private struct DashboardShiftRow: View {
    let shift: DashboardShift

    var body: some View {
        HStack(spacing: 0) {
            Rectangle()
                .fill(Color.accentColor)
                .frame(width: 3)
            HStack(spacing: 12) {
                VStack(alignment: .center, spacing: 1) {
                    Text(shift.startsAt.formatted(.dateTime.month(.abbreviated).day()))
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(.secondary)
                    Text(shift.startsAt.formatted(.dateTime.hour().minute()))
                        .font(.caption.monospacedDigit().weight(.medium))
                }
                .fixedSize()
                .padding(.vertical, 6)
                .padding(.horizontal, 10)
                .background(.quaternary.opacity(0.5))
                .clipShape(RoundedRectangle(cornerRadius: 8))

                VStack(alignment: .leading, spacing: 2) {
                    Text(shift.event.summary)
                        .font(.subheadline.weight(.medium))
                        .lineLimit(1)
                    HStack(spacing: 4) {
                        Text(shift.area.shiftAreaLabel)
                        if let loc = shift.event.locationName {
                            Text("·")
                            Text(loc)
                        }
                    }
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                    if shift.hasGear {
                        Label {
                            Text(shift.gearLabel)
                        } icon: {
                            Image(systemName: "checkmark.circle.fill")
                                .accessibilityHidden(true)
                        }
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(Color.statusText(.green))
                    }
                }
                Spacer()
            }
            .padding(.vertical, 2)
            .padding(.leading, 10)
            .frame(maxWidth: .infinity)
            .background(Color.accentColor.opacity(0.04))
        }
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .accessibilityElement(children: .combine)
        .accessibilityLabel(rowAccessibilityLabel)
    }

    private var rowAccessibilityLabel: String {
        var parts: [String] = [
            shift.event.summary,
            "\(shift.area.shiftAreaLabel) shift",
            shift.startsAt.formatted(.dateTime.weekday(.abbreviated).month(.abbreviated).day().hour().minute()),
        ]
        if let loc = shift.event.locationName { parts.append(loc) }
        if shift.hasGear { parts.append(shift.gearLabel) }
        return parts.joined(separator: ", ")
    }
}

// MARK: - Event Summary Row

private struct EventSummaryRow: View {
    let event: DashboardUpcomingEvent

    private var barColor: Color {
        switch event.isHome {
        case true: return Color.statusText(.green)
        case false: return Color.statusText(.orange)
        case nil: return Color(.systemGray4)
        }
    }

    var body: some View {
        HStack(spacing: 0) {
            Rectangle()
                .fill(barColor)
                .frame(width: 3)
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
                                    event.coveragePct >= 100 ? Color.statusText(.green) :
                                    event.coveragePct > 0 ? Color.statusText(.orange) : Color.statusText(.red)
                                )
                        }
                    }
                }

                Spacer()

                if let isHome = event.isHome {
                    Text(isHome ? "Home" : "Away")
                        .font(.caption2.weight(.medium))
                        .foregroundStyle(isHome ? Color.statusText(.green) : Color.statusText(.orange))
                }
            }
            .padding(.vertical, 3)
            .padding(.leading, 12)
        }
        .clipShape(RoundedRectangle(cornerRadius: 6))
        .accessibilityElement(children: .combine)
        .accessibilityLabel(rowAccessibilityLabel)
    }

    private var rowAccessibilityLabel: String {
        var parts: [String] = [event.title]
        if let sport = sportLabel(event.sportCode) { parts.append(sport) }
        parts.append(event.startsAt.formatted(.dateTime.weekday(.abbreviated).month(.abbreviated).day()))
        if event.totalShiftSlots > 0 {
            parts.append("\(event.filledShiftSlots) of \(event.totalShiftSlots) crew filled")
        }
        if let isHome = event.isHome {
            parts.append(isHome ? "Home game" : "Away game")
        }
        return parts.joined(separator: ", ")
    }
}

// MARK: - Flagged Items Banner

private struct FlaggedItemsBanner: View {
    let items: [DashboardFlaggedItem]

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Label {
                Text("\(items.count) Flagged Item\(items.count == 1 ? "" : "s")")
            } icon: {
                Image(systemName: "flag.fill").accessibilityHidden(true)
            }
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(Color.statusText(.orange))

            ForEach(items) { item in
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(item.assetName ?? item.assetTag)
                            .font(.subheadline.weight(.medium))
                            .foregroundStyle(.primary)
                            .lineLimit(1)
                        HStack(spacing: 4) {
                            Text(item.typeLabel)
                            if let title = item.bookingTitle {
                                Text("·")
                                Text(title)
                            }
                        }
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                    }
                    Spacer()
                    Text(item.assetTag)
                        .font(.caption.monospacedDigit())
                        .foregroundStyle(.tertiary)
                }
                .accessibilityElement(children: .combine)
                .accessibilityLabel(flaggedRowLabel(for: item))
                if item.id != items.last?.id { Divider() }
            }
        }
        .padding(14)
        .background(Color.statusBackground(.orange), in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(Color.statusText(.orange).opacity(0.2), lineWidth: 1))
    }

    private func flaggedRowLabel(for item: DashboardFlaggedItem) -> String {
        var parts: [String] = ["Flagged: \(item.assetName ?? item.assetTag)", item.typeLabel]
        if let title = item.bookingTitle { parts.append(title) }
        parts.append("tag \(item.assetTag)")
        return parts.joined(separator: ", ")
    }
}

// MARK: - Lost Bulk Units Banner

private struct LostBulkUnitsBanner: View {
    let items: [DashboardLostBulkUnit]

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Label {
                Text("Lost Bulk Units")
            } icon: {
                Image(systemName: "exclamationmark.triangle.fill").accessibilityHidden(true)
            }
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(Color.statusText(.red))

            ForEach(items, id: \.skuName) { item in
                HStack {
                    Text(item.skuName)
                        .font(.subheadline.weight(.medium))
                        .lineLimit(1)
                    Spacer()
                    Text("\(item.count) missing")
                        .font(.caption.weight(.medium))
                        .foregroundStyle(Color.statusText(.red))
                }
                .accessibilityElement(children: .combine)
                .accessibilityLabel("\(item.skuName), \(item.count) missing")
            }
        }
        .padding(14)
        .background(Color.statusBackground(.red), in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(Color.statusText(.red).opacity(0.2), lineWidth: 1))
    }
}

// MARK: - Draft Row

private struct DraftRow: View {
    let draft: DashboardDraft

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: draft.kind == "checkout" ? "archivebox" : "calendar.badge.clock")
                .foregroundStyle(.secondary)
                .frame(width: 24)
                .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: 2) {
                Text(draft.title)
                    .font(.subheadline.weight(.medium))
                    .lineLimit(1)
                HStack(spacing: 4) {
                    Text("\(draft.itemCount) item\(draft.itemCount == 1 ? "" : "s")")
                    Text("·")
                    Text(draft.updatedAt.formatted(.relative(presentation: .named)))
                }
                .font(.caption)
                .foregroundStyle(.secondary)
            }

            Spacer()

            Image(systemName: "chevron.right")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.tertiary)
                .accessibilityHidden(true)
        }
        .padding(.vertical, 2)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Draft: \(draft.title), \(draft.itemCount) item\(draft.itemCount == 1 ? "" : "s"), updated \(draft.updatedAt.formatted(.relative(presentation: .named)))")
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

    var lateLabel: String {
        let minutes = Int(-self.timeIntervalSinceNow / 60)
        if minutes < 60 { return "\(max(minutes, 1))m late" }
        let hours = minutes / 60
        if hours < 24 { return "\(hours)h late" }
        let days = hours / 24
        return "\(days)d late"
    }
}
