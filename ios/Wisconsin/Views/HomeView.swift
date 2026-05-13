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
    @State private var showNotifications = false
    @State private var showTrades = false
    @State private var showProfile = false
    @State private var showCreate = false
    @State private var navigationPath = NavigationPath()
    @State private var pendingBookingId: String?
    @State private var pendingAssetId: String?
    @State private var pendingUserId: String?
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
        let hasMyPendingPickup: Bool
        if let currentUserId = session.currentUser?.id {
            hasMyPendingPickup = dash.pendingPickups.items.contains { $0.requesterUserId == currentUserId }
        } else {
            hasMyPendingPickup = false
        }
        return dash.myCheckouts.items.isEmpty
            && dash.myReservations.isEmpty
            && !hasMyPendingPickup
            && dash.myShifts.isEmpty
            && !dash.myCheckouts.items.contains(where: \.isOverdue)
            && dash.flaggedItems.isEmpty
            && dash.lostBulkUnits.isEmpty
    }

    @ViewBuilder private func dashboardScrollView(_ dash: DashboardData) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if vm.error != nil {
                    RefreshFailurePill(message: vm.error ?? "")
                }
                StatStrip(
                    stats: dash.stats,
                    pendingPickupCount: dash.pendingPickups.total,
                    shiftCount: dash.myShifts.count,
                    openBookings: { appState.selectedTab = 1 },
                    openSchedule: { appState.selectedTab = 4 }
                )
                if let loadedAt = vm.lastLoadedAt {
                    Text("Updated \(loadedAt.formatted(.relative(presentation: .named)))")
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                        .frame(maxWidth: .infinity, alignment: .trailing)
                        .padding(.top, -8)
                }
                if HomeActionQueue.hasActions(in: dash, currentUserId: session.currentUser?.id) {
                    HomeActionQueue(
                        dash: dash,
                        openBookingId: { navigationPath.append($0) },
                        openBookingSummary: { navigationPath.append($0) },
                        openShift: { selectedScheduleEvent = $0.asScheduleEvent },
                        openBookings: { appState.selectedTab = 1 },
                        openSchedule: { appState.selectedTab = 4 },
                        createBooking: { showCreate = true },
                        currentUserId: session.currentUser?.id
                    )
                } else if isAllEmpty(dash) || !hasStaffFollowUp(dash) {
                    AllClearEmptyState()
                }
                if dash.isStaff {
                    staffExceptionSection(dash)
                }
            }
            .padding()
        }
        .sheet(item: $selectedScheduleEvent) { event in
            EventDetailSheet(event: event, myShift: nil)
        }
    }

    private func hasStaffFollowUp(_ dash: DashboardData) -> Bool {
        !dash.flaggedItems.isEmpty || !dash.lostBulkUnits.isEmpty || !dash.drafts.isEmpty
    }

    @ViewBuilder
    private func staffExceptionSection(_ dash: DashboardData) -> some View {
        if !dash.flaggedItems.isEmpty || !dash.lostBulkUnits.isEmpty || !dash.drafts.isEmpty {
            VStack(alignment: .leading, spacing: 12) {
                Text("Staff Follow-Up")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                    .textCase(.uppercase)
                    .tracking(0.3)
                if !dash.flaggedItems.isEmpty {
                    FlaggedItemsBanner(items: dash.flaggedItems)
                }
                if dash.isAdmin && !dash.lostBulkUnits.isEmpty {
                    LostBulkUnitsBanner(items: dash.lostBulkUnits)
                }
                if !dash.drafts.isEmpty {
                    DashboardCard(title: "Drafts", seeAllTab: 1, appState: appState) {
                        ForEach(dash.drafts) { draft in
                            DraftRow(draft: draft)
                        }
                    }
                }
            }
        }
    }

    var body: some View {
        NavigationStack(path: $navigationPath) {
            mainContent
                .navigationTitle("Home")
                .overlay(alignment: .bottomTrailing) {
                    Button {
                        showCreate = true
                    } label: {
                        Image(systemName: "plus")
                            .font(.title3.weight(.semibold))
                            .frame(width: 58, height: 58)
                    }
                    .buttonStyle(.glassProminent)
                    .accessibilityLabel("Create booking")
                    .padding(.trailing, 18)
                    .padding(.bottom, 22)
                }
            .toolbar {
                #if DEBUG
                ToolbarItem(placement: .topBarLeading) {
                    Button("Kiosk") { kiosk.enterKiosk() }
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                }
                #endif
                ToolbarItemGroup(placement: .topBarTrailing) {
                    Button {
                        showProfile = true
                    } label: {
                        AccountAvatar(size: 32)
                            .overlay(
                                Circle().strokeBorder(Color(.separator), lineWidth: 0.5)
                            )
                    }
                    .accessibilityLabel("Profile")
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
            .onChange(of: appState.tabResetToken) { _, _ in
                guard appState.resetTab == 0 else { return }
                navigationPath = NavigationPath()
                showNotifications = false
                showTrades = false
                showProfile = false
                showCreate = false
                selectedScheduleEvent = nil
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
            .navigationDestination(for: UserRouteId.self) { route in
                UserDetailView(userId: route.id)
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
                if let userId = pendingUserId {
                    navigationPath.append(UserRouteId(id: userId))
                    pendingUserId = nil
                }
                if pendingShowTrades {
                    pendingShowTrades = false
                    showTrades = true
                }
            }) {
                NotificationsSheet(
                    onSelectBooking: { id in pendingBookingId = id },
                    onSelectTrades: { pendingShowTrades = true },
                    onSelectAsset: { id in pendingAssetId = id },
                    onSelectUser: { id in pendingUserId = id }
                )
            }
            .sheet(isPresented: $showTrades) {
                TradeBoardSheet(myShifts: [], currentUserId: session.currentUser?.id ?? "")
            }
            .sheet(isPresented: $showCreate) {
                CreateBookingSheet { newId in
                    showCreate = false
                    Task {
                        await vm.load(appState: appState, forceRefresh: true)
                        navigationPath.append(newId)
                    }
                }
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
    let pendingPickupCount: Int
    let shiftCount: Int
    let openBookings: () -> Void
    let openSchedule: () -> Void

    var body: some View {
        HStack(spacing: 8) {
            StatCell(value: stats.overdue, label: "Overdue",
                     tone: stats.overdue > 0 ? .red : nil, onTap: openBookings)
            StatCell(value: stats.dueToday, label: "Due Today",
                     tone: stats.dueToday > 0 ? .orange : nil, onTap: openBookings)
            StatCell(value: pendingPickupCount, label: "Pickups",
                     tone: pendingPickupCount > 0 ? .green : nil, onTap: openBookings)
            StatCell(value: shiftCount, label: "Shifts",
                     tone: shiftCount > 0 ? .blue : nil, onTap: openSchedule)
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
                    .font(.title3.weight(.bold))
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
        .accessibilityLabel("\(label): \(value)")
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

// MARK: - Action Queue

private struct HomeActionQueue: View {
    let dash: DashboardData
    let openBookingId: (String) -> Void
    let openBookingSummary: (BookingSummary) -> Void
    let openShift: (DashboardShift) -> Void
    let openBookings: () -> Void
    let openSchedule: () -> Void
    let createBooking: () -> Void
    let currentUserId: String?

    private var myOverdueBookings: [BookingSummary] {
        dash.myCheckouts.items.filter(\.isOverdue)
    }

    private var myPendingPickups: [BookingSummary] {
        guard let currentUserId else { return [] }
        return dash.pendingPickups.items.filter { $0.requesterUserId == currentUserId }
    }

    private var dueTodayBookings: [BookingSummary] {
        let checkouts = dash.myCheckouts.items
        var seen = Set<String>()
        return checkouts.filter { summary in
            guard !summary.isOverdue,
                  Calendar.current.isDateInToday(summary.endsAt),
                  !seen.contains(summary.id)
            else { return false }
            seen.insert(summary.id)
            return true
        }
    }

    static func hasActions(in dash: DashboardData, currentUserId: String?) -> Bool {
        let hasMyPendingPickup = currentUserId.map { id in
            dash.pendingPickups.items.contains { $0.requesterUserId == id }
        } ?? false
        return dash.myCheckouts.items.contains(where: \.isOverdue)
            || hasMyPendingPickup
            || !dash.myReservations.isEmpty
            || !dash.myShifts.isEmpty
            || !dash.myCheckouts.items.isEmpty
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            header

            if !myOverdueBookings.isEmpty {
                ForEach(myOverdueBookings.prefix(3)) { summary in
                    ActionQueueRow(
                        tone: .red,
                        title: summary.title,
                        subtitle: summary.requesterName,
                        meta: summary.endsAt.overdueLabel,
                        primaryLabel: "Open",
                        action: { openBookingSummary(summary) }
                    )
                }
            }

            ForEach(dueTodayBookings.prefix(3)) { summary in
                ActionQueueRow(
                    tone: .orange,
                    title: summary.title,
                    subtitle: summary.requesterName,
                    meta: "Due \(summary.endsAt.formatted(date: .omitted, time: .shortened))",
                    primaryLabel: "Open",
                    action: { openBookingSummary(summary) }
                )
            }

            ForEach(myPendingPickups.prefix(3)) { summary in
                ActionQueueRow(
                    tone: summary.startsAt < Date() ? .orange : .green,
                    title: summary.title,
                    subtitle: summary.requesterName,
                    meta: summary.startsAt < Date()
                        ? "Pickup \(summary.startsAt.lateLabel)"
                        : "Pickup \(summary.startsAt.formatted(date: .omitted, time: .shortened))",
                    primaryLabel: "Open",
                    action: { openBookingSummary(summary) }
                )
            }

            ForEach(dash.myReservations.prefix(3)) { summary in
                ActionQueueRow(
                    tone: .purple,
                    title: summary.title,
                    subtitle: summary.requesterName,
                    meta: summary.startsAt.formatted(.dateTime.weekday(.abbreviated).hour().minute()),
                    primaryLabel: "Open",
                    action: { openBookingSummary(summary) }
                )
            }

            ForEach(dash.myShifts.prefix(2)) { shift in
                ActionQueueRow(
                    tone: shift.hasGear ? .green : .blue,
                    title: shift.event.summary,
                    subtitle: "\(shift.area.shiftAreaLabel) shift",
                    meta: shift.startsAt.formatted(.dateTime.weekday(.abbreviated).hour().minute()),
                    primaryLabel: "View",
                    action: { openShift(shift) },
                    secondaryLabel: "Schedule",
                    secondarySystemImage: "calendar",
                    secondaryAction: openSchedule
                )
            }
        }
        .padding(16)
        .background(Color(.systemBackground), in: RoundedRectangle(cornerRadius: 16))
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .strokeBorder(Color(.separator).opacity(0.5), lineWidth: 0.5)
        )
    }

    private var header: some View {
        HStack(alignment: .firstTextBaseline) {
            VStack(alignment: .leading, spacing: 2) {
                Text("Next Up")
                    .font(.title3.weight(.semibold))
                Text("Upcoming pickups, reservations, shifts, and due work.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Button {
                createBooking()
            } label: {
                Label("Create", systemImage: "plus")
                    .labelStyle(.iconOnly)
            }
            .buttonStyle(.glass)
            .accessibilityLabel("Create booking")
        }
    }
}

private struct ActionQueueRow: View {
    let tone: StatusTone
    let title: String
    let subtitle: String
    let meta: String
    let primaryLabel: String
    let action: () -> Void
    var secondaryLabel: String? = nil
    var secondarySystemImage: String? = nil
    var secondaryAction: (() -> Void)? = nil
    @State private var hapticTrigger = false
    @State private var secondaryHapticTrigger = false

    var body: some View {
        HStack(spacing: 10) {
            Button {
                hapticTrigger.toggle()
                action()
            } label: {
                HStack(spacing: 12) {
                    RoundedRectangle(cornerRadius: 2)
                        .fill(Color.statusText(tone))
                        .frame(width: 4, height: 36)
                        .accessibilityHidden(true)

                    VStack(alignment: .leading, spacing: 3) {
                        Text(title)
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(.primary)
                            .lineLimit(2)
                        Text(subtitle)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }

                    Spacer(minLength: 8)

                    Text(meta)
                        .font(.caption.weight(.medium))
                        .foregroundStyle(Color.statusText(tone))
                        .multilineTextAlignment(.trailing)
                        .lineLimit(2)
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .frame(minHeight: 48)
            .sensoryFeedback(.selection, trigger: hapticTrigger)
            .accessibilityLabel("\(title), \(subtitle), \(meta). \(primaryLabel).")

            if let secondaryLabel, let secondarySystemImage, let secondaryAction {
                Button {
                    secondaryHapticTrigger.toggle()
                    secondaryAction()
                } label: {
                    Image(systemName: secondarySystemImage)
                        .font(.subheadline.weight(.semibold))
                        .frame(width: 38, height: 38)
                }
                .buttonStyle(.glass)
                .tint(Color.statusText(tone))
                .accessibilityLabel(secondaryLabel)
                .sensoryFeedback(.selection, trigger: secondaryHapticTrigger)
            }
        }
        .padding(.vertical, 4)
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
            Text("Use the Scan tab when you need to look up gear.")
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
