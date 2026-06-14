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
                appState.myShiftCount = dashboard?.myEventWork.count ?? 0
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
    @State private var selectedEventWork: DashboardEventWork?
    @Environment(AppState.self) private var appState
    @Environment(SessionStore.self) private var session

    @ViewBuilder private var mainContent: some View {
        if vm.dashboard == nil && vm.error == nil {
            ScrollView {
                VStack(alignment: .leading, spacing: Brand.Space.lg) {
                    StatStripSkeleton()
                    VStack(alignment: .leading, spacing: Brand.Space.sm) {
                        Skeleton().frame(width: 140, height: 14)
                        ForEach(0..<3, id: \.self) { _ in BookingRowSkeleton() }
                    }
                    .brandCard(padding: Brand.Space.md, radius: Brand.Radius.card)
                    VStack(alignment: .leading, spacing: Brand.Space.sm) {
                        Skeleton().frame(width: 140, height: 14)
                        ForEach(0..<4, id: \.self) { _ in BookingRowSkeleton() }
                    }
                    .brandCard(padding: Brand.Space.md, radius: Brand.Radius.card)
                }
                .padding(Brand.Space.md)
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
            && dash.myEventWork.isEmpty
            && !dash.myCheckouts.items.contains(where: \.isOverdue)
            && dash.flaggedItems.isEmpty
            && dash.lostBulkUnits.isEmpty
    }

    @ViewBuilder private func dashboardScrollView(_ dash: DashboardData) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Brand.Space.lg) {
                DashboardHero(name: session.currentUser?.name ?? "")
                if vm.error != nil {
                    RefreshFailurePill(message: vm.error ?? "")
                }
                StatStrip(
                    stats: dash.stats,
                    pendingPickupCount: dash.pendingPickups.total,
                    shiftCount: dash.myEventWork.count,
                    lastLoadedAt: vm.lastLoadedAt,
                    openBookings: { appState.selectedTab = 1 },
                    openSchedule: { appState.selectedTab = 4 }
                )
                if HomeActionQueue.hasActions(in: dash, currentUserId: session.currentUser?.id) {
                    HomeActionQueue(
                        dash: dash,
                        openBookingSummary: { navigationPath.append($0) },
                        openEventWork: { selectedEventWork = $0 },
                        currentUserId: session.currentUser?.id
                    )
                } else if isAllEmpty(dash) || !hasStaffFollowUp(dash) {
                    AllClearEmptyState(openScan: { appState.selectedTab = 3 })
                }
                if dash.isStaff {
                    staffExceptionSection(dash)
                }
            }
            .padding(Brand.Space.md)
        }
        .sheet(item: $selectedEventWork) { work in
            EventDetailSheet(event: work.asScheduleEvent, myShift: nil, eventWork: work)
        }
    }

    private func hasStaffFollowUp(_ dash: DashboardData) -> Bool {
        !dash.flaggedItems.isEmpty || !dash.lostBulkUnits.isEmpty || !dash.drafts.isEmpty
    }

    @ViewBuilder
    private func staffExceptionSection(_ dash: DashboardData) -> some View {
        if !dash.flaggedItems.isEmpty || !dash.lostBulkUnits.isEmpty || !dash.drafts.isEmpty {
            VStack(alignment: .leading, spacing: Brand.Space.sm) {
                BrandSectionHeader("Staff Follow-Up", systemImage: "flag.checkered")
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
                .background(Color(.systemGroupedBackground).ignoresSafeArea())
                .navigationTitle("")
                .navigationBarTitleDisplayMode(.inline)
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
                ToolbarItemGroup(placement: .topBarTrailing) {
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
                selectedEventWork = nil
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
                Task { await appState.refresh(forceRefresh: true) }
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

// MARK: - Dashboard Hero

private struct DashboardHero: View {
    let name: String

    private var firstName: String {
        name.split(separator: " ").first.map(String.init) ?? ""
    }

    private var greeting: String {
        switch Calendar.current.component(.hour, from: .now) {
        case 5..<12:  return "Good morning"
        case 12..<17: return "Good afternoon"
        case 17..<22: return "Good evening"
        default:      return "Hello"
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(Date.now.formatted(.dateTime.weekday(.wide).month(.wide).day()))
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
                .textCase(.uppercase)
                .tracking(0.6)
            Text(firstName.isEmpty ? greeting : "\(greeting),")
                .font(.gothamBlack(size: 30))
                .foregroundStyle(.primary)
            if !firstName.isEmpty {
                Text(firstName)
                    .font(.gothamBlack(size: 30))
                    .foregroundStyle(Color.brandPrimary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.top, Brand.Space.xs)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(firstName.isEmpty ? greeting : "\(greeting), \(firstName)")
    }
}

// MARK: - Stat Strip

private struct StatStrip: View {
    let stats: DashboardStats
    let pendingPickupCount: Int
    let shiftCount: Int
    let lastLoadedAt: Date?
    let openBookings: () -> Void
    let openSchedule: () -> Void

    private let columns = [
        GridItem(.flexible(), spacing: Brand.Space.sm),
        GridItem(.flexible(), spacing: Brand.Space.sm),
    ]

    var body: some View {
        VStack(alignment: .trailing, spacing: Brand.Space.sm) {
            LazyVGrid(columns: columns, spacing: Brand.Space.sm) {
                StatCard(value: stats.overdue, label: "Overdue", systemImage: "exclamationmark.triangle.fill",
                         tone: .red, onTap: openBookings)
                StatCard(value: stats.dueToday, label: "Due Today", systemImage: "clock.fill",
                         tone: .orange, onTap: openBookings)
                StatCard(value: pendingPickupCount, label: pendingPickupCount == 1 ? "Pickup" : "Pickups", systemImage: "shippingbox.fill",
                         tone: .green, onTap: openBookings)
                StatCard(value: shiftCount, label: shiftCount == 1 ? "Shift" : "Shifts", systemImage: "calendar",
                         tone: .blue, onTap: openSchedule)
            }
            if let lastLoadedAt {
                HStack(spacing: 4) {
                    Image(systemName: "arrow.triangle.2.circlepath")
                        .font(.caption2.weight(.semibold))
                        .accessibilityHidden(true)
                    Text("Synced \(lastLoadedAt.formatted(.relative(presentation: .named)))")
                        .font(.caption2)
                        .monospacedDigit()
                }
                .foregroundStyle(.tertiary)
                .accessibilityLabel("Dashboard synced \(lastLoadedAt.formatted(.relative(presentation: .named)))")
            }
        }
    }
}

private struct StatCard: View {
    let value: Int
    let label: String
    let systemImage: String
    let tone: StatusTone
    let onTap: () -> Void
    @State private var hapticTrigger = false

    private var active: Bool { value > 0 }

    var body: some View {
        Button(action: {
            hapticTrigger.toggle()
            onTap()
        }) {
            HStack(spacing: Brand.Space.sm) {
                ZStack {
                    RoundedRectangle(cornerRadius: Brand.Radius.sm, style: .continuous)
                        .fill(active ? Color.statusBackground(tone) : Color.secondary.opacity(0.12))
                    Image(systemName: systemImage)
                        .font(.headline)
                        .foregroundStyle(active ? Color.statusText(tone) : Color.secondary)
                }
                .frame(width: 46, height: 46)

                VStack(alignment: .leading, spacing: 0) {
                    Text("\(value)")
                        .font(.system(size: 30, weight: .bold, design: .rounded))
                        .monospacedDigit()
                        .foregroundStyle(active ? Color.statusText(tone) : Color.primary)
                        .contentTransition(.numericText())
                    Text(label)
                        .font(.caption.weight(.medium))
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                }
                Spacer(minLength: 0)
            }
            .padding(Brand.Space.md)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.cardSurface, in: RoundedRectangle(cornerRadius: Brand.Radius.card, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Brand.Radius.card, style: .continuous)
                    .strokeBorder(active ? Color.statusText(tone).opacity(0.25) : Color.hairline, lineWidth: active ? 1 : 0.5)
            )
            .shadow(color: Color.black.opacity(0.05), radius: 10, x: 0, y: 4)
        }
        .buttonStyle(.plain)
        .sensoryFeedback(.selection, trigger: hapticTrigger)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(label): \(value)")
    }
}

private struct StatStripSkeleton: View {
    private let columns = [
        GridItem(.flexible(), spacing: Brand.Space.sm),
        GridItem(.flexible(), spacing: Brand.Space.sm),
    ]

    var body: some View {
        LazyVGrid(columns: columns, spacing: Brand.Space.sm) {
            ForEach(0..<4, id: \.self) { _ in
                HStack(spacing: Brand.Space.sm) {
                    Skeleton(cornerRadius: Brand.Radius.sm).frame(width: 46, height: 46)
                    VStack(alignment: .leading, spacing: 6) {
                        Skeleton().frame(width: 44, height: 26)
                        Skeleton().frame(width: 60, height: 10)
                    }
                    Spacer(minLength: 0)
                }
                .padding(Brand.Space.md)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color.cardSurface, in: RoundedRectangle(cornerRadius: Brand.Radius.card, style: .continuous))
            }
        }
        .accessibilityHidden(true)  // Don't pollute VO with placeholder shapes during initial load.
    }
}

// MARK: - Action Queue

private struct HomeActionQueue: View {
    let dash: DashboardData
    let openBookingSummary: (BookingSummary) -> Void
    let openEventWork: (DashboardEventWork) -> Void
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

    private var eventLinkedGearIds: Set<String> {
        Set(dash.myEventWork.flatMap { $0.gearBookings.map(\.id) })
    }

    private var standalonePendingPickups: [BookingSummary] {
        myPendingPickups.filter { !eventLinkedGearIds.contains($0.id) }
    }

    private var standaloneReservations: [BookingSummary] {
        dash.myReservations.filter { !eventLinkedGearIds.contains($0.id) }
    }

    private func shiftLinked(to summary: BookingSummary) -> DashboardShift? {
        let ids = Set(summary.eventIds + [summary.linkedEventId, summary.eventId].compactMap { $0 })
        guard !ids.isEmpty else { return nil }
        return dash.myShifts
            .filter { ids.contains($0.event.id) }
            .sorted { $0.startsAt < $1.startsAt }
            .first
    }

    private func gearInstruction(for summary: BookingSummary) -> String {
        let time = summary.startsAt.formatted(date: .omitted, time: .shortened)
        if summary.status == .pendingPickup && summary.startsAt < Date() {
            return "Pickup gear now"
        }
        return "Pickup gear at \(time)"
    }

    private func itemCountLabel(for summary: BookingSummary) -> String {
        "\(summary.itemCount) item\(summary.itemCount == 1 ? "" : "s")"
    }

    private func personalContext(for summary: BookingSummary) -> String {
        let parts = [summary.locationName, itemCountLabel(for: summary)]
            .compactMap { $0 }
            .filter { !$0.isEmpty }
        return parts.isEmpty ? summary.title : parts.joined(separator: " · ")
    }

    private func eventDetailLines(for summary: BookingSummary) -> [QueueDetailLine] {
        var lines = [QueueDetailLine(text: gearInstruction(for: summary), tone: summary.startsAt < Date() ? .orange : .green)]
        if let shift = shiftLinked(to: summary) {
            lines.append(QueueDetailLine(
                text: "Call time at \(shift.startsAt.formatted(date: .omitted, time: .shortened))",
                tone: .blue
            ))
        }
        return lines
    }

    static func hasActions(in dash: DashboardData, currentUserId: String?) -> Bool {
        let hasMyPendingPickup = currentUserId.map { id in
            dash.pendingPickups.items.contains { $0.requesterUserId == id }
        } ?? false
        return dash.myCheckouts.items.contains(where: \.isOverdue)
            || hasMyPendingPickup
            || !dash.myReservations.isEmpty
            || !dash.myEventWork.isEmpty
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
                        subtitle: personalContext(for: summary),
                        meta: summary.endsAt.overdueLabel,
                        primaryLabel: "Review overdue",
                        action: { openBookingSummary(summary) }
                    )
                }
            }

            ForEach(dueTodayBookings.prefix(3)) { summary in
                ActionQueueRow(
                    tone: .orange,
                    title: summary.title,
                    subtitle: personalContext(for: summary),
                    meta: "Due \(summary.endsAt.formatted(date: .omitted, time: .shortened))",
                    primaryLabel: "Return today",
                    action: { openBookingSummary(summary) }
                )
            }

            ForEach(standalonePendingPickups.prefix(3)) { summary in
                ActionQueueRow(
                    tone: summary.startsAt < Date() ? .orange : .green,
                    title: summary.title,
                    subtitle: summary.linkedEventId == nil ? personalContext(for: summary) : nil,
                    meta: summary.startsAt < Date()
                        ? "Pickup \(summary.startsAt.lateLabel)"
                        : "Pickup \(summary.startsAt.formatted(date: .omitted, time: .shortened))",
                    primaryLabel: "Pick up",
                    detailLines: summary.linkedEventId == nil ? [] : eventDetailLines(for: summary),
                    action: { openBookingSummary(summary) }
                )
            }

            ForEach(standaloneReservations.prefix(3)) { summary in
                ActionQueueRow(
                    tone: .purple,
                    title: summary.title,
                    subtitle: summary.linkedEventId == nil ? personalContext(for: summary) : nil,
                    meta: summary.startsAt.formatted(.dateTime.weekday(.abbreviated).hour().minute()),
                    primaryLabel: "Open reservation",
                    detailLines: summary.linkedEventId == nil ? [] : eventDetailLines(for: summary),
                    action: { openBookingSummary(summary) }
                )
            }

            ForEach(dash.myEventWork.prefix(3)) { work in
                EventActionQueueRow(work: work, openEventWork: openEventWork)
            }
        }
        .brandCard(padding: Brand.Space.md, radius: Brand.Radius.card)
    }

    private var header: some View {
        BrandSectionHeader(
            "Next Up",
            subtitle: "Upcoming pickups, reservations, shifts, and due work."
        )
    }
}

private struct QueueDetailLine {
    let text: String
    let tone: StatusTone
}

private struct EventActionQueueRow: View {
    let work: DashboardEventWork
    let openEventWork: (DashboardEventWork) -> Void
    @State private var hapticTrigger = false

    private var tone: StatusTone { work.needsGear ? .blue : .green }
    private var firstTime: Date { min(work.primaryGear?.startsAt ?? work.shift.startsAt, work.shift.startsAt) }
    private var primaryLabel: String { work.needsGear ? "Reserve gear" : "Prep shift" }

    var body: some View {
        Button {
            hapticTrigger.toggle()
            openEventWork(work)
        } label: {
            HStack(spacing: 12) {
                RoundedRectangle(cornerRadius: 2)
                    .fill(Color.statusText(tone))
                    .frame(width: 4, height: 56)
                    .accessibilityHidden(true)

                VStack(alignment: .leading, spacing: 7) {
                    Text(work.event.summary)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.primary)
                        .lineLimit(2)
                    VStack(alignment: .leading, spacing: 3) {
                        if let gear = work.primaryGear, !work.needsGear {
                            queueTextLine(gearInstruction(for: gear), tone: gearTone(for: gear))
                        } else {
                            queueTextLine("Reserve gear now", tone: .blue)
                        }
                        queueTextLine(
                            "Call time at \(work.shift.startsAt.formatted(date: .omitted, time: .shortened))",
                            tone: .blue
                        )
                    }
                }

                Spacer(minLength: 8)

                VStack(alignment: .trailing, spacing: 4) {
                    Text(firstTime.formatted(.dateTime.weekday(.abbreviated).hour().minute()))
                        .font(.caption.weight(.medium))
                        .foregroundStyle(Color.statusText(tone))
                        .multilineTextAlignment(.trailing)
                        .lineLimit(2)
                    Text(primaryLabel)
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(Color.statusText(tone))
                        .lineLimit(1)
                        .minimumScaleFactor(0.75)
                }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .frame(minHeight: 68)
        .padding(.vertical, 4)
        .sensoryFeedback(.selection, trigger: hapticTrigger)
        .accessibilityLabel(accessibilityLabel)
    }

    private var accessibilityLabel: String {
        var parts = [work.event.summary]
        if let gear = work.primaryGear, !work.needsGear {
            parts.append(gearInstruction(for: gear))
        } else {
            parts.append("Reserve gear now")
        }
        parts.append("Call time at \(work.shift.startsAt.formatted(date: .omitted, time: .shortened))")
        parts.append(primaryLabel)
        return parts.joined(separator: ", ")
    }

    private func gearInstruction(for gear: BookingSummary) -> String {
        let time = gear.startsAt.formatted(date: .omitted, time: .shortened)
        if gear.status == .pendingPickup && gear.startsAt < Date() {
            return "Pickup gear now"
        }
        return "Pickup gear at \(time)"
    }

    private func gearTone(for gear: BookingSummary) -> StatusTone {
        gear.status == .pendingPickup && gear.startsAt < Date() ? .orange : .green
    }

    private func queueTextLine(_ text: String, tone: StatusTone) -> some View {
        HStack(spacing: 5) {
            Circle()
                .fill(Color.statusText(tone))
                .frame(width: 5, height: 5)
                .accessibilityHidden(true)
            Text(text)
                .font(.caption)
                .foregroundStyle(.secondary)
                .lineLimit(1)
        }
    }
}

private struct ActionQueueRow: View {
    let tone: StatusTone
    let title: String
    let subtitle: String?
    let meta: String
    let primaryLabel: String
    var detailLines: [QueueDetailLine] = []
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
                        if detailLines.isEmpty, let subtitle {
                            Text(subtitle)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                                .lineLimit(1)
                        } else {
                            VStack(alignment: .leading, spacing: 3) {
                                ForEach(detailLines, id: \.text) { line in
                                    HStack(spacing: 5) {
                                        Circle()
                                            .fill(Color.statusText(line.tone))
                                            .frame(width: 5, height: 5)
                                            .accessibilityHidden(true)
                                        Text(line.text)
                                            .font(.caption)
                                            .foregroundStyle(.secondary)
                                            .lineLimit(1)
                                    }
                                }
                            }
                        }
                    }

                    Spacer(minLength: 8)

                    VStack(alignment: .trailing, spacing: 4) {
                        Text(meta)
                            .font(.caption.weight(.medium))
                            .foregroundStyle(Color.statusText(tone))
                            .multilineTextAlignment(.trailing)
                            .lineLimit(2)
                        Text(primaryLabel)
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(Color.statusText(tone))
                            .lineLimit(1)
                            .minimumScaleFactor(0.75)
                    }
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .frame(minHeight: detailLines.isEmpty ? 48 : 68)
            .sensoryFeedback(.selection, trigger: hapticTrigger)
            .accessibilityLabel(accessibilityLabel)

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

    private var accessibilityLabel: String {
        let detail = detailLines.isEmpty ? (subtitle ?? "") : detailLines.map(\.text).joined(separator: ", ")
        return "\(title), \(detail), \(meta). \(primaryLabel)."
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
    let openScan: () -> Void

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
            Button {
                Haptics.tap()
                openScan()
            } label: {
                Label("Look up gear", systemImage: "barcode.viewfinder")
                    .font(.subheadline.weight(.semibold))
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.regular)
            .padding(.top, 4)
        }
        .brandCard(padding: Brand.Space.xl, radius: Brand.Radius.card, alignment: .center)
        .accessibilityElement(children: .contain)
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
        .brandCard(padding: Brand.Space.md, radius: Brand.Radius.card)
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
        .padding(Brand.Space.md)
        .background(Color.statusBackground(.orange), in: RoundedRectangle(cornerRadius: Brand.Radius.md, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: Brand.Radius.md, style: .continuous).strokeBorder(Color.statusText(.orange).opacity(0.2), lineWidth: 1))
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
        .padding(Brand.Space.md)
        .background(Color.statusBackground(.red), in: RoundedRectangle(cornerRadius: Brand.Radius.md, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: Brand.Radius.md, style: .continuous).strokeBorder(Color.statusText(.red).opacity(0.2), lineWidth: 1))
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
