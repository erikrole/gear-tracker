import SwiftUI
import UIKit
import UserNotifications

struct AppTabView: View {
    @Environment(SessionStore.self) private var session
    @Environment(AppState.self) private var appState
    @Environment(NetworkMonitor.self) private var network
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private var isStaffOrAdmin: Bool {
        let role = session.currentUser?.role ?? ""
        return role == "STAFF" || role == "ADMIN"
    }

    private var gearTabLabel: String {
        isStaffOrAdmin ? "Bookings" : "My Gear"
    }

    var body: some View {
        TabView(selection: Binding(
            get: { appState.selectedTab },
            set: { appState.selectTab($0) }
        )) {
            HomeView()
                .tabItem { Label("Home", systemImage: "house") }
                .tag(0)

            BookingsView()
                .tabItem { Label(gearTabLabel, systemImage: "calendar.badge.checkmark") }
                .tag(1)
                .badge(appState.overdueCount)
                .accessibilityLabel(appState.overdueCount > 0 ? "\(gearTabLabel), \(appState.overdueCount) overdue" : gearTabLabel)

            ItemsView()
                .tabItem { Label("Items", systemImage: "archivebox") }
                .tag(2)

            ScanView()
                .tabItem { Label("Scan", systemImage: "barcode.viewfinder") }
                .tag(3)

            ScheduleView()
                .tabItem { Label("Schedule", systemImage: "calendar") }
                .tag(4)
                .badge(appState.myShiftCount)
                .accessibilityLabel(appState.myShiftCount > 0 ? "Schedule, \(appState.myShiftCount) upcoming shifts" : "Schedule")

            if isStaffOrAdmin {
                UsersView()
                    .tabItem { Label("Users", systemImage: "person.2") }
                    .tag(5)
            }
        }
        .onChange(of: isStaffOrAdmin) { _, canSeeUsers in
            if !canSeeUsers && appState.selectedTab == 5 {
                appState.selectedTab = 0
            }
        }
        .onAppear {
            routePendingEventPush()
        }
        .onChange(of: appState.pendingPushEventId) { _, _ in
            routePendingEventPush()
        }
        .safeAreaInset(edge: .top, spacing: 0) {
            if !network.isConnected {
                BannerView(
                    severity: .warning,
                    message: "No connection — some actions may fail",
                    systemImage: "wifi.slash"
                )
                .transition(.move(edge: .top).combined(with: .opacity))
            }
        }
        .animation(reduceMotion ? nil : .easeInOut, value: network.isConnected)
    }

    private func routePendingEventPush() {
        guard appState.pendingPushEventId != nil else { return }
        if appState.selectedTab != 4 {
            appState.selectedTab = 4
        }
    }
}

// MARK: - Profile

struct ProfileView: View {
    @Environment(SessionStore.self) private var session
    @Environment(AppState.self) private var appState
    @Environment(KioskStore.self) private var kioskStore
    @Environment(\.dismiss) private var dismiss
    @Environment(\.scenePhase) private var scenePhase
    @State private var showSignOutConfirm = false
    @State private var showLinkStickerWizard = false
    @State private var showScannerDebugger = false
    @State private var showPushPrompt = false
    @State private var prefsVM = NotificationPrefsViewModel()
    @State private var pushAuth: UNAuthorizationStatus = .notDetermined
    @AppStorage("WisconsinThemeChoice") private var themeChoice: ThemeChoice = .system

    private static let manageAccountURL = URL(string: "https://gear.erikrole.com")!
    private static let iosSettingsURL = URL(string: UIApplication.openSettingsURLString)!

    private var isStaffOrAdmin: Bool {
        let role = session.currentUser?.role ?? ""
        return role == "ADMIN" || role == "STAFF"
    }

    private var isStudent: Bool {
        (session.currentUser?.role ?? "") == "STUDENT"
    }

    private var canLaunchKioskDebug: Bool {
#if DEBUG
        UIDevice.current.userInterfaceIdiom == .pad
#else
        false
#endif
    }

    var body: some View {
        NavigationStack {
            List {
                headerSection
                scheduleSection
                accountSection
                notificationsSection
                appearanceSection
                if isStaffOrAdmin { toolsSection }
                appSection
                signOutSection
            }
            .listStyle(.insetGrouped)
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .sheet(isPresented: $showLinkStickerWizard) {
                LinkStickerWizard()
            }
            .sheet(isPresented: $showScannerDebugger) {
                ScannerDebuggerView()
                    .presentationDetents([.large])
                    .presentationDragIndicator(.visible)
            }
            .sheet(isPresented: $showPushPrompt) {
                PushPrePromptView()
                    .presentationDetents([.medium])
                    .presentationDragIndicator(.visible)
            }
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
            .navigationDestination(for: ProfileDestination.self) { dest in
                destinationView(for: dest)
            }
            .confirmationDialog(
                "Sign out?",
                isPresented: $showSignOutConfirm,
                titleVisibility: .visible
            ) {
                Button("Sign Out", role: .destructive) {
                    Task { await session.logout() }
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("You'll need to sign in again to come back.")
            }
        }
        .task { await prefsVM.load() }
        .task { await refreshPushAuth() }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active {
                Task { await refreshPushAuth() }
            }
        }
    }

    // MARK: - Sections

    @ViewBuilder
    private var headerSection: some View {
        Section {
            VStack(alignment: .leading, spacing: 14) {
                HStack(spacing: 14) {
                    AccountAvatar(size: 58)
                    VStack(alignment: .leading, spacing: 4) {
                        Text(session.currentUser?.name ?? "Account")
                            .font(.title3.weight(.semibold))
                        Text(session.currentUser?.email ?? "")
                            .font(.system(.subheadline, design: .monospaced))
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                            .minimumScaleFactor(0.85)
                    }
                    Spacer(minLength: 12)
                    StatusPill.role(session.currentUser?.role ?? "")
                }

                Divider()

                HStack(spacing: 12) {
                    SettingsStatusMetric(
                        value: "\(appState.myShiftCount)",
                        label: "Shifts",
                        tone: appState.myShiftCount > 0 ? .blue : .gray
                    )
                    SettingsStatusMetric(
                        value: "\(appState.overdueCount)",
                        label: "Overdue",
                        tone: appState.overdueCount > 0 ? .red : .gray
                    )
                    SettingsStatusMetric(
                        value: notificationMetricValue,
                        label: "Alerts",
                        tone: notificationMetricTone
                    )
                }
            }
            .padding(.vertical, 6)
        }
        .listRowBackground(Color(.secondarySystemGroupedBackground))
    }

    @ViewBuilder
    private var accountSection: some View {
        Section("Account") {
            NavigationLink(value: ProfileDestination.accountSecurity) {
                SettingsMenuRow(
                    title: "Account & Security",
                    subtitle: accountSummaryText,
                    systemImage: "person.crop.circle.badge.checkmark",
                    tint: Color.brandPrimary
                ) {
                    StatusPill.role(session.currentUser?.role ?? "")
                }
            }
        }
    }

    @ViewBuilder
    private var notificationsSection: some View {
        Section("Notifications") {
            NavigationLink(value: ProfileDestination.notifications) {
                SettingsMenuRow(
                    title: "Notifications",
                    subtitle: notificationSummaryText,
                    systemImage: notificationSummaryIcon,
                    tint: notificationSummaryTint
                ) {
                    Text(pushStatusText)
                        .font(.caption.weight(.medium))
                        .foregroundStyle(pushStatusTone)
                        .multilineTextAlignment(.trailing)
                }
            }
        }
    }

    @ViewBuilder
    private var appearanceSection: some View {
        Section {
            Picker(selection: $themeChoice) {
                ForEach(ThemeChoice.allCases) { choice in
                    Label(choice.label, systemImage: choice.systemImage)
                        .tag(choice)
                }
            } label: {
                SettingsMenuRow(
                    title: "Theme",
                    subtitle: "Saved on this device only.",
                    systemImage: "paintpalette",
                    tint: Color.statusText(.purple)
                ) {
                    Text(themeChoice.label)
                        .font(.caption.weight(.medium))
                        .foregroundStyle(.secondary)
                }
            }
            .pickerStyle(.menu)
        } header: {
            Text("Appearance")
        } footer: {
            Text("Saved on this device only — set it again on your other devices.")
        }
    }

    @ViewBuilder
    private var scheduleSection: some View {
        Section {
            NavigationLink(value: ProfileDestination.upcomingShifts) {
                SettingsMenuRow(
                    title: "Upcoming shifts",
                    subtitle: appState.myShiftCount == 1 ? "1 shift on deck" : "\(appState.myShiftCount) shifts on deck",
                    systemImage: "calendar",
                    tint: Color.statusText(.blue)
                ) {
                    SettingsCountBadge(
                        value: appState.myShiftCount,
                        tone: appState.myShiftCount > 0 ? .blue : .gray
                    )
                }
            }
            NavigationLink(value: ProfileDestination.overdueBookings) {
                SettingsMenuRow(
                    title: "Overdue bookings",
                    subtitle: appState.overdueCount == 1 ? "1 checkout needs attention" : "\(appState.overdueCount) checkouts need attention",
                    systemImage: "exclamationmark.triangle",
                    tint: appState.overdueCount > 0 ? Color.statusText(.red) : Color.secondary
                ) {
                    SettingsCountBadge(
                        value: appState.overdueCount,
                        tone: appState.overdueCount > 0 ? .red : .gray
                    )
                }
            }
            if isStudent {
                NavigationLink(value: ProfileDestination.availability) {
                    SettingsMenuRow(
                        title: "My Availability",
                        subtitle: "Add class conflicts so staff can schedule around them.",
                        systemImage: "calendar.badge.clock",
                        tint: Color.statusText(.green)
                    ) {
                        EmptyView()
                    }
                }
            }
        } header: {
            Text("Schedule")
        } footer: {
            if isStudent {
                Text("Availability blocks are advisory. Staff can still override after confirming.")
            }
        }
    }

    @ViewBuilder
    private var toolsSection: some View {
        Section("Tools") {
            Button {
                showLinkStickerWizard = true
            } label: {
                SettingsMenuRow(
                    title: "Link Sticker Codes",
                    subtitle: "Pair printed QR stickers with items in the field.",
                    systemImage: "qrcode.viewfinder",
                    tint: Color.statusText(.blue)
                ) {
                    EmptyView()
                }
            }
            Button {
                showScannerDebugger = true
            } label: {
                SettingsMenuRow(
                    title: "Scanner Debugger",
                    subtitle: "Test a hand scanner and preview the scan result card.",
                    systemImage: "barcode.viewfinder",
                    tint: Color.statusText(.green)
                ) {
                    EmptyView()
                }
            }
            if canLaunchKioskDebug {
                Button {
                    kioskStore.enterKiosk()
                } label: {
                    SettingsMenuRow(
                        title: "Kiosk Mode",
                        subtitle: "Open the kiosk shell on this iPad.",
                        systemImage: "barcode.viewfinder",
                        tint: Color.statusText(.red)
                    ) {
                        EmptyView()
                    }
                }
            }
        }
    }

    @ViewBuilder
    private var appSection: some View {
        Section("App") {
            SettingsMenuRow(
                title: "Version",
                subtitle: appVersion,
                systemImage: "app.badge",
                tint: Color.secondary
            ) {
                EmptyView()
            }
            Link(destination: Self.iosSettingsURL) {
                SettingsMenuRow(
                    title: "Open iOS Settings",
                    subtitle: "Camera, notifications, and system permissions.",
                    systemImage: "gearshape",
                    tint: Color.secondary
                ) {
                    Image(systemName: "arrow.up.right.square")
                        .foregroundStyle(.tertiary)
                }
            }
        }
    }

    @ViewBuilder
    private var signOutSection: some View {
        Section {
            Button(role: .destructive) {
                showSignOutConfirm = true
            } label: {
                SettingsMenuRow(
                    title: "Sign Out",
                    subtitle: "End this session on this device.",
                    systemImage: "rectangle.portrait.and.arrow.right",
                    tint: Color.statusText(.red)
                ) {
                    EmptyView()
                }
            }
        }
    }

    private var appVersion: String {
        let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "—"
        let build = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "—"
        return "\(version) (\(build))"
    }

    private var accountSummaryText: String {
        let email = session.currentUser?.email ?? "Signed in"
        return "\(email) · password and account access"
    }

    private var notificationMetricValue: String {
        if prefsVM.loading && prefsVM.prefs == nil { return "…" }
        if prefsVM.pausedUntilDate != nil { return "Paused" }
        guard let prefs = prefsVM.prefs else { return prefsVM.error == nil ? "On" : "Check" }
        let enabled = [prefs.channels.email, prefs.channels.push].filter { $0 }.count
        return enabled == 0 ? "Inbox" : "\(enabled)/2"
    }

    private var notificationMetricTone: StatusTone {
        if prefsVM.pausedUntilDate != nil { return .purple }
        if prefsVM.error != nil && prefsVM.prefs == nil { return .orange }
        return .blue
    }

    private var notificationSummaryText: String {
        if prefsVM.loading && prefsVM.prefs == nil {
            return "Loading email, push, and notification type preferences."
        }
        if let until = prefsVM.pausedUntilDate {
            return "Paused until \(until.formatted(date: .abbreviated, time: .shortened)). In-app notifications still appear."
        }
        if prefsVM.error != nil && prefsVM.prefs == nil {
            return "Preferences could not load. Retry below before changing alert behavior."
        }
        guard let prefs = prefsVM.prefs else {
            return "In-app notifications are always available."
        }
        let channels = [
            prefs.channels.email ? "email" : nil,
            prefs.channels.push ? "push" : nil,
        ].compactMap { $0 }
        if channels.isEmpty {
            return "Only the in-app inbox is enabled."
        }
        return "\(channels.joined(separator: " and ").capitalized) alerts are enabled."
    }

    private var notificationSummaryIcon: String {
        if prefsVM.pausedUntilDate != nil { return "moon.zzz.fill" }
        if prefsVM.error != nil && prefsVM.prefs == nil { return "exclamationmark.triangle.fill" }
        return "bell.badge"
    }

    private var notificationSummaryTint: Color {
        if prefsVM.pausedUntilDate != nil { return Color.statusText(.purple) }
        if prefsVM.error != nil && prefsVM.prefs == nil { return Color.statusText(.orange) }
        return Color.brandPrimary
    }

    private var pushStatusText: String {
        switch pushAuth {
        case .authorized, .provisional, .ephemeral:
            "Push allowed"
        case .denied:
            "iOS off"
        case .notDetermined:
            "Not set"
        @unknown default:
            "Unknown"
        }
    }

    private var pushStatusTone: Color {
        switch pushAuth {
        case .authorized, .provisional, .ephemeral:
            Color.statusText(.green)
        case .denied:
            Color.statusText(.orange)
        case .notDetermined:
            .secondary
        @unknown default:
            .secondary
        }
    }

    private func refreshPushAuth() async {
        let settings = await UNUserNotificationCenter.current().notificationSettings()
        pushAuth = settings.authorizationStatus
    }

    @ViewBuilder
    private func destinationView(for destination: ProfileDestination) -> some View {
        switch destination {
        case .upcomingShifts:
            ProfilePlaceholderView(destination: destination)
        case .overdueBookings:
            if isStaffOrAdmin {
                OverdueReportView()
            } else {
                ProfilePlaceholderView(destination: destination)
            }
        case .availability:
            AvailabilityView(userId: session.currentUser?.id ?? "")
        case .notifications:
            NotificationSettingsView(
                prefsVM: prefsVM,
                pushAuth: $pushAuth,
                currentEmail: session.currentUser?.email ?? "your email",
                iosSettingsURL: Self.iosSettingsURL,
                showPushPrompt: { showPushPrompt = true }
            )
        case .accountSecurity:
            AccountSecuritySettingsView(manageAccountURL: Self.manageAccountURL)
        }
    }
}

private struct SettingsMenuRow<Trailing: View>: View {
    let title: String
    let subtitle: String?
    let systemImage: String
    let tint: Color
    let trailing: () -> Trailing

    init(
        title: String,
        subtitle: String? = nil,
        systemImage: String,
        tint: Color,
        @ViewBuilder trailing: @escaping () -> Trailing
    ) {
        self.title = title
        self.subtitle = subtitle
        self.systemImage = systemImage
        self.tint = tint
        self.trailing = trailing
    }

    var body: some View {
        HStack(spacing: 12) {
            SettingsRowIcon(systemImage: systemImage, tint: tint)
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(.primary)
                if let subtitle, !subtitle.isEmpty {
                    Text(subtitle)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                }
            }
            Spacer(minLength: 12)
            trailing()
        }
        .padding(.vertical, 3)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
    }
}

private struct SettingsRowIcon: View {
    let systemImage: String
    let tint: Color

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .fill(tint.opacity(0.14))
            Image(systemName: systemImage)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(tint)
        }
        .frame(width: 34, height: 34)
        .accessibilityHidden(true)
    }
}

private struct SettingsCountBadge: View {
    let value: Int
    let tone: StatusTone

    var body: some View {
        Text("\(value)")
            .font(.caption.weight(.semibold))
            .monospacedDigit()
            .foregroundStyle(Color.statusText(tone))
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(Color.statusBackground(tone), in: Capsule())
    }
}

private struct SettingsStatusMetric: View {
    let value: String
    let label: String
    let tone: StatusTone

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(value)
                .font(.headline.weight(.semibold))
                .foregroundStyle(Color.statusText(tone))
                .lineLimit(1)
                .minimumScaleFactor(0.75)
            Text(label)
                .font(.caption2.weight(.medium))
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 10)
        .padding(.vertical, 8)
        .background(Color.statusBackground(tone), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
        .accessibilityElement(children: .combine)
    }
}

// MARK: - Profile destinations

enum ProfileDestination: Hashable {
    case upcomingShifts
    case overdueBookings
    case availability
    case notifications
    case accountSecurity
}

private struct ProfilePlaceholderView: View {
    let destination: ProfileDestination

    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: destination == .upcomingShifts ? "calendar" : "calendar.badge.exclamationmark")
                .font(.largeTitle)
                .foregroundStyle(.secondary)
            Text(destination == .upcomingShifts
                ? "Open the Schedule tab to see your shifts."
                : "Open the Bookings tab to see overdue items.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(.systemGroupedBackground))
        .navigationTitle(destination == .upcomingShifts ? "My Shifts" : "Overdue")
        .navigationBarTitleDisplayMode(.inline)
    }
}

private struct NotificationSettingsView: View {
    let prefsVM: NotificationPrefsViewModel
    @Binding var pushAuth: UNAuthorizationStatus
    let currentEmail: String
    let iosSettingsURL: URL
    let showPushPrompt: () -> Void

    var body: some View {
        List {
            Section {
                SettingsMenuRow(
                    title: "Delivery status",
                    subtitle: notificationSummaryText,
                    systemImage: notificationSummaryIcon,
                    tint: notificationSummaryTint
                ) {
                    Text(pushStatusText)
                        .font(.caption.weight(.medium))
                        .foregroundStyle(pushStatusTone)
                        .multilineTextAlignment(.trailing)
                }

                pushPermissionRow

                if prefsVM.loading && prefsVM.prefs == nil {
                    HStack {
                        ProgressView().controlSize(.small)
                        Text("Loading preferences…")
                            .foregroundStyle(.secondary)
                            .font(.subheadline)
                    }
                } else if let prefs = prefsVM.prefs {
                    if let until = prefsVM.pausedUntilDate {
                        pausedRow(until: until)
                    } else {
                        pauseChipsRow
                    }

                    channelToggle(
                        title: "Email alerts",
                        icon: "envelope",
                        description: "Send notifications to \(currentEmail).",
                        isOn: prefs.channels.email,
                        onChange: { v in Task { await prefsVM.setChannel(.email, value: v) } }
                    )

                    channelToggle(
                        title: "Push alerts",
                        icon: "iphone.radiowaves.left.and.right",
                        description: "Send push notifications to this device.",
                        isOn: prefs.channels.push,
                        onChange: { v in Task { await prefsVM.setChannel(.push, value: v) } }
                    )

                    categoryHeaderRow

                    categoryToggle(
                        title: "Checkout due reminders",
                        icon: "clock.badge.exclamationmark",
                        description: "Notified before gear is due back.",
                        category: .checkoutDue
                    )

                    categoryToggle(
                        title: "Checkout overdue alerts",
                        icon: "exclamationmark.triangle",
                        description: "Notified when gear is past due.",
                        category: .checkoutOverdue
                    )

                    categoryToggle(
                        title: "Reservation updates",
                        icon: "calendar.badge.checkmark",
                        description: "Confirmation, pickup-ready, and cancellation notices.",
                        category: .reservation
                    )

                    categoryToggle(
                        title: "License expiry reminders",
                        icon: "person.text.rectangle",
                        description: "Notified when one of your licenses is approaching expiry.",
                        category: .licenseExpiry
                    )

                    categoryToggle(
                        title: "Schedule updates",
                        icon: "calendar.badge.clock",
                        description: "Published shift assignments, removals, and call-time changes.",
                        category: .schedule
                    )

                    categoryToggle(
                        title: "Trade updates",
                        icon: "arrow.triangle.2.circlepath",
                        description: "Claimed, approved, declined, completed, and expired shift trades.",
                        category: .trade
                    )

                    categoryToggle(
                        title: "Gear prep nudges",
                        icon: "bag.badge.plus",
                        description: "Staff-triggered reminders to reserve or prepare gear.",
                        category: .gearPrep
                    )
                } else if let err = prefsVM.error {
                    HStack {
                        Text(err)
                            .font(.subheadline)
                            .foregroundStyle(Color.statusText(.red))
                        Spacer()
                        Button("Retry") {
                            Task { await prefsVM.load() }
                        }
                        .buttonStyle(.bordered)
                        .controlSize(.small)
                    }
                }
            } header: {
                Text("Delivery")
            } footer: {
                Text("In-app notifications always show in your inbox, regardless of these settings.")
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle("Notifications")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            if prefsVM.prefs == nil {
                await prefsVM.load()
            }
            await refreshPushAuth()
        }
    }

    @ViewBuilder
    private var pushPermissionRow: some View {
        switch pushAuth {
        case .denied:
            Link(destination: iosSettingsURL) {
                HStack(spacing: 12) {
                    Image(systemName: "bell.slash.fill")
                        .foregroundStyle(Color.statusText(.orange))
                        .frame(width: 22)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Push disabled in iOS Settings")
                            .font(.subheadline.weight(.medium))
                            .foregroundStyle(.primary)
                        Text("Tap to open Settings and re-enable.")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                    Image(systemName: "arrow.up.right.square")
                        .foregroundStyle(.tertiary)
                }
            }
            .accessibilityLabel("Push disabled in iOS Settings. Tap to open Settings.")
        case .notDetermined:
            Button {
                showPushPrompt()
            } label: {
                HStack(spacing: 12) {
                    Image(systemName: "bell.badge")
                        .foregroundStyle(Color.brandPrimary)
                        .frame(width: 22)
                    Text("Turn on notifications")
                        .font(.subheadline.weight(.medium))
                    Spacer()
                }
            }
        default:
            EmptyView()
        }
    }

    @ViewBuilder
    private var pauseChipsRow: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                Image(systemName: "bell.slash")
                    .foregroundStyle(.secondary)
                Text("Pause alerts")
                    .font(.subheadline.weight(.medium))
            }
            HStack(spacing: 8) {
                pauseChip(label: "1 hour",  seconds: 3600)
                pauseChip(label: "1 day",   seconds: 86_400)
                pauseChip(label: "1 week",  seconds: 604_800)
            }
        }
        .padding(.vertical, 2)
    }

    private func pauseChip(label: String, seconds: TimeInterval) -> some View {
        Button {
            Task {
                await prefsVM.pause(for: seconds)
            }
        } label: {
            Text("Pause \(label)")
                .font(.footnote.weight(.medium))
                .frame(maxWidth: .infinity)
                .padding(.vertical, 6)
        }
        .buttonStyle(.bordered)
        .controlSize(.small)
        .disabled(prefsVM.saving)
    }

    @ViewBuilder
    private func pausedRow(until: Date) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Image(systemName: "moon.zzz.fill")
                    .foregroundStyle(Color.statusText(.purple))
                VStack(alignment: .leading, spacing: 2) {
                    Text("Paused")
                        .font(.subheadline.weight(.semibold))
                    Text("Until \(until.formatted(date: .abbreviated, time: .shortened))")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .monospacedDigit()
                }
                Spacer()
                Button("Resume") {
                    Task { await prefsVM.resume() }
                }
                .buttonStyle(.bordered)
                .controlSize(.small)
                .disabled(prefsVM.saving)
            }
        }
        .padding(.vertical, 2)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Notifications paused until \(until.formatted(date: .abbreviated, time: .shortened)). Double-tap Resume to turn back on.")
    }

    @ViewBuilder
    private func channelToggle(
        title: String,
        icon: String,
        description: String,
        isOn: Bool,
        onChange: @escaping (Bool) -> Void
    ) -> some View {
        let binding = Binding(
            get: { isOn },
            set: { onChange($0) }
        )
        Toggle(isOn: binding) {
            HStack(spacing: 12) {
                Image(systemName: icon)
                    .foregroundStyle(.secondary)
                    .frame(width: 22)
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.subheadline.weight(.medium))
                    Text(description)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                }
            }
        }
        .disabled(prefsVM.saving || prefsVM.isPaused)
    }

    @ViewBuilder
    private var categoryHeaderRow: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text("Notification types")
                .font(.subheadline.weight(.semibold))
            Text("Choose which email and push alerts can reach you.")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(.top, 4)
    }

    @ViewBuilder
    private func categoryToggle(
        title: String,
        icon: String,
        description: String,
        category: NotificationPrefsViewModel.Category
    ) -> some View {
        let binding = Binding(
            get: { prefsVM.categoryValue(category) },
            set: { value in Task { await prefsVM.setCategory(category, value: value) } }
        )
        Toggle(isOn: binding) {
            HStack(spacing: 12) {
                Image(systemName: icon)
                    .foregroundStyle(.secondary)
                    .frame(width: 22)
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.subheadline.weight(.medium))
                    Text(description)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                }
            }
        }
        .disabled(prefsVM.saving)
    }

    private var notificationSummaryText: String {
        if prefsVM.loading && prefsVM.prefs == nil {
            return "Loading email, push, and notification type preferences."
        }
        if let until = prefsVM.pausedUntilDate {
            return "Paused until \(until.formatted(date: .abbreviated, time: .shortened)). In-app notifications still appear."
        }
        if prefsVM.error != nil && prefsVM.prefs == nil {
            return "Preferences could not load. Retry below before changing alert behavior."
        }
        guard let prefs = prefsVM.prefs else {
            return "In-app notifications are always available."
        }
        let channels = [
            prefs.channels.email ? "email" : nil,
            prefs.channels.push ? "push" : nil,
        ].compactMap { $0 }
        if channels.isEmpty {
            return "Only the in-app inbox is enabled."
        }
        return "\(channels.joined(separator: " and ").capitalized) alerts are enabled."
    }

    private var notificationSummaryIcon: String {
        if prefsVM.pausedUntilDate != nil { return "moon.zzz.fill" }
        if prefsVM.error != nil && prefsVM.prefs == nil { return "exclamationmark.triangle.fill" }
        return "bell.badge"
    }

    private var notificationSummaryTint: Color {
        if prefsVM.pausedUntilDate != nil { return Color.statusText(.purple) }
        if prefsVM.error != nil && prefsVM.prefs == nil { return Color.statusText(.orange) }
        return Color.brandPrimary
    }

    private var pushStatusText: String {
        switch pushAuth {
        case .authorized, .provisional, .ephemeral:
            "Push allowed"
        case .denied:
            "iOS off"
        case .notDetermined:
            "Not set"
        @unknown default:
            "Unknown"
        }
    }

    private var pushStatusTone: Color {
        switch pushAuth {
        case .authorized, .provisional, .ephemeral:
            Color.statusText(.green)
        case .denied:
            Color.statusText(.orange)
        case .notDetermined:
            .secondary
        @unknown default:
            .secondary
        }
    }

    private func refreshPushAuth() async {
        let settings = await UNUserNotificationCenter.current().notificationSettings()
        pushAuth = settings.authorizationStatus
    }
}

private struct AccountSecuritySettingsView: View {
    @Environment(SessionStore.self) private var session
    let manageAccountURL: URL

    @State private var currentPassword = ""
    @State private var newPassword = ""
    @State private var confirmPassword = ""
    @State private var revokeOtherSessions = true
    @State private var showPasswords = false
    @State private var isSaving = false
    @State private var error: String?
    @State private var successMessage: String?
    @FocusState private var focusedField: Field?

    private enum Field {
        case currentPassword
        case newPassword
        case confirmPassword
    }

    var body: some View {
        List {
            Section("Account") {
                HStack(spacing: 14) {
                    AccountAvatar(size: 48)
                    VStack(alignment: .leading, spacing: 3) {
                        Text(session.currentUser?.name ?? "Account")
                            .font(.headline)
                        Text(session.currentUser?.email ?? "")
                            .font(.system(.caption, design: .monospaced))
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                            .minimumScaleFactor(0.8)
                    }
                    Spacer(minLength: 12)
                    StatusPill.role(session.currentUser?.role ?? "")
                }
                .padding(.vertical, 4)

                Link(destination: manageAccountURL) {
                    SettingsMenuRow(
                        title: "Manage profile on web",
                        subtitle: "Edit profile fields and review active sessions.",
                        systemImage: "globe",
                        tint: Color.statusText(.blue)
                    ) {
                        Image(systemName: "arrow.up.right.square")
                            .foregroundStyle(.tertiary)
                    }
                }
            }

            Section {
                passwordField(
                    title: "Current password",
                    text: $currentPassword,
                    contentType: .password,
                    focus: .currentPassword,
                    submitLabel: .next
                ) {
                    focusedField = .newPassword
                }

                passwordField(
                    title: "New password",
                    text: $newPassword,
                    contentType: .newPassword,
                    focus: .newPassword,
                    submitLabel: .next
                ) {
                    focusedField = .confirmPassword
                }

                passwordField(
                    title: "Confirm new password",
                    text: $confirmPassword,
                    contentType: .newPassword,
                    focus: .confirmPassword,
                    submitLabel: .go
                ) {
                    Task { await savePassword() }
                }

                Button {
                    showPasswords.toggle()
                } label: {
                    Label(showPasswords ? "Hide passwords" : "Show passwords", systemImage: showPasswords ? "eye.slash" : "eye")
                }
                .accessibilityValue(showPasswords ? "Passwords visible" : "Passwords hidden")
                .disabled(isSaving)

                Toggle("Sign out other devices", isOn: $revokeOtherSessions)
                    .disabled(isSaving)

                if let validationMessage {
                    Text(validationMessage)
                        .font(.footnote)
                        .foregroundStyle(Color.statusText(.orange))
                }

                if let error {
                    Text(error)
                        .font(.footnote)
                        .foregroundStyle(Color.statusText(.red))
                }

                if let successMessage {
                    Text(successMessage)
                        .font(.footnote)
                        .foregroundStyle(Color.statusText(.green))
                }

                Button {
                    Task { await savePassword() }
                } label: {
                    HStack {
                        if isSaving {
                            ProgressView().controlSize(.small)
                        }
                        Text(isSaving ? "Saving…" : "Change Password")
                            .fontWeight(.semibold)
                    }
                    .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .disabled(!canSubmit)
            } header: {
                Text("Password")
            } footer: {
                Text("New passwords must be at least 8 characters and different from the current password.")
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle("Account & Security")
        .navigationBarTitleDisplayMode(.inline)
        .interactiveDismissDisabled(isSaving)
    }

    @ViewBuilder
    private func passwordField(
        title: String,
        text: Binding<String>,
        contentType: UITextContentType,
        focus: Field,
        submitLabel: SubmitLabel,
        onSubmit: @escaping () -> Void
    ) -> some View {
        Group {
            if showPasswords {
                TextField(title, text: text)
            } else {
                SecureField(title, text: text)
            }
        }
        .textInputAutocapitalization(.never)
        .autocorrectionDisabled()
        .textContentType(contentType)
        .submitLabel(submitLabel)
        .focused($focusedField, equals: focus)
        .disabled(isSaving)
        .onSubmit(onSubmit)
    }

    private var validationMessage: String? {
        if currentPassword.isEmpty && newPassword.isEmpty && confirmPassword.isEmpty { return nil }
        if currentPassword.isEmpty { return "Current password is required." }
        if newPassword.count < 8 { return "Use at least 8 characters." }
        if !confirmPassword.isEmpty && newPassword != confirmPassword { return "Passwords do not match." }
        if !newPassword.isEmpty && currentPassword == newPassword { return "Choose a password that is different from your current password." }
        return nil
    }

    private var canSubmit: Bool {
        !currentPassword.isEmpty &&
        newPassword.count >= 8 &&
        newPassword == confirmPassword &&
        currentPassword != newPassword &&
        !isSaving
    }

    private func savePassword() async {
        guard canSubmit else {
            Haptics.warning()
            return
        }

        isSaving = true
        error = nil
        successMessage = nil

        do {
            try await APIClient.shared.changePassword(
                currentPassword: currentPassword,
                newPassword: newPassword,
                revokeOtherSessions: revokeOtherSessions
            )
            currentPassword = ""
            newPassword = ""
            confirmPassword = ""
            focusedField = nil
            successMessage = revokeOtherSessions
                ? "Password changed. Other devices were signed out."
                : "Password changed."
            Haptics.success()
        } catch {
            self.error = error.localizedDescription
            Haptics.warning()
        }

        isSaving = false
    }
}

// MARK: - Reusable avatar

struct AccountAvatar: View {
    @Environment(SessionStore.self) private var session
    let size: CGFloat

    var body: some View {
        let name = session.currentUser?.name ?? ""
        let parts = name.split(separator: " ")
        let initials = parts.prefix(2).compactMap { $0.first }.map { String($0) }.joined()
        let avatarUrl = session.currentUser?.avatarUrl.flatMap { URL(string: $0) }

        Group {
            if let url = avatarUrl {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let image):
                        image.resizable().scaledToFill()
                    default:
                        initialsCircle(initials)
                    }
                }
                .frame(width: size, height: size)
                .clipShape(Circle())
            } else {
                initialsCircle(initials)
            }
        }
    }

    @ViewBuilder
    private func initialsCircle(_ initials: String) -> some View {
        ZStack {
            Circle()
                .fill(.tint.opacity(0.15))
                .frame(width: size, height: size)
            Text(initials.isEmpty ? "?" : initials)
                .font(size > 40 ? .title3.weight(.semibold) : .footnote.weight(.semibold))
                .foregroundStyle(.tint)
        }
    }
}

// MARK: - Availability editor

private let availabilityDayNames = [
    "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
]

/// Student self-service editor for recurring class-conflict blocks. Mirrors the
/// web profile Availability tab; these blocks drive the assign-picker conflict
/// warnings (see `AssignStudentSheet`).
struct AvailabilityView: View {
    let userId: String

    @State private var blocks: [AvailabilityBlock] = []
    @State private var isLoading = true
    @State private var error: String?
    @State private var showAdd = false

    private var grouped: [(day: Int, blocks: [AvailabilityBlock])] {
        // AD_HOC blocks (web-only, dayOfWeek == nil) don't fit the weekly
        // grid this editor renders; skip them rather than failing the list.
        let weekly = blocks.filter { $0.dayOfWeek != nil }
        return Dictionary(grouping: weekly, by: { $0.dayOfWeek ?? 0 })
            .sorted { $0.key < $1.key }
            .map { (day: $0.key, blocks: $0.value.sorted { $0.startsAt < $1.startsAt }) }
    }

    var body: some View {
        Group {
            if isLoading && blocks.isEmpty {
                ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let error, blocks.isEmpty {
                ContentUnavailableView {
                    Label("Couldn't load availability", systemImage: "exclamationmark.triangle")
                } description: {
                    Text(error)
                } actions: {
                    Button("Retry") { Task { await load() } }
                        .buttonStyle(.borderedProminent)
                }
            } else if blocks.isEmpty {
                ContentUnavailableView {
                    Label("No class conflicts added", systemImage: "calendar.badge.clock")
                } description: {
                    Text("Add the times you have class so staff don't schedule you then.")
                } actions: {
                    Button { showAdd = true } label: {
                        Label("Add a block", systemImage: "plus")
                    }
                    .buttonStyle(.borderedProminent)
                }
            } else {
                List {
                    Section {
                        Button { showAdd = true } label: {
                            Label("Add availability block", systemImage: "plus")
                        }
                    }
                    ForEach(grouped, id: \.day) { group in
                        Section(availabilityDayNames[group.day]) {
                            ForEach(group.blocks) { block in
                                HStack {
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text("\(block.startsAt)–\(block.endsAt)")
                                            .font(.body.monospacedDigit())
                                        if let label = block.label, !label.isEmpty {
                                            Text(label)
                                                .font(.caption)
                                                .foregroundStyle(.secondary)
                                        }
                                    }
                                    Spacer()
                                }
                                .swipeActions(edge: .trailing) {
                                    Button(role: .destructive) {
                                        Task { await delete(block) }
                                    } label: {
                                        Label("Delete", systemImage: "trash")
                                    }
                                }
                                .accessibilityElement(children: .combine)
                                .accessibilityLabel(rowLabel(day: group.day, block: block))
                            }
                        }
                    }
                }
            }
        }
        .navigationTitle("My Availability")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button { showAdd = true } label: {
                    Label("Add block", systemImage: "plus")
                }
                .labelStyle(.titleAndIcon)
            }
        }
        .task { await load() }
        .sheet(isPresented: $showAdd) {
            AddAvailabilitySheet(userId: userId) { Task { await load() } }
        }
    }

    private func rowLabel(day: Int, block: AvailabilityBlock) -> String {
        var parts = ["\(availabilityDayNames[day]) \(block.startsAt) to \(block.endsAt)"]
        if let label = block.label, !label.isEmpty { parts.append(label) }
        return parts.joined(separator: ", ")
    }

    private func load() async {
        isLoading = true
        error = nil
        do {
            blocks = try await APIClient.shared.availabilityBlocks(userId: userId)
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }

    private func delete(_ block: AvailabilityBlock) async {
        do {
            try await APIClient.shared.deleteAvailabilityBlock(userId: userId, blockId: block.id)
            blocks.removeAll { $0.id == block.id }
            Haptics.success()
        } catch {
            self.error = error.localizedDescription
            Haptics.warning()
        }
    }
}

private struct AddAvailabilitySheet: View {
    let userId: String
    let onAdded: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var dayOfWeek = 1
    @State private var start: Date
    @State private var end: Date
    @State private var label = ""
    @State private var isSaving = false
    @State private var error: String?

    init(userId: String, onAdded: @escaping () -> Void) {
        self.userId = userId
        self.onAdded = onAdded
        let cal = Calendar.current
        _start = State(initialValue: cal.date(bySettingHour: 9, minute: 0, second: 0, of: .now) ?? .now)
        _end = State(initialValue: cal.date(bySettingHour: 10, minute: 0, second: 0, of: .now) ?? .now)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Day") {
                    Picker("Day", selection: $dayOfWeek) {
                        ForEach(0..<7, id: \.self) { Text(availabilityDayNames[$0]).tag($0) }
                    }
                }
                Section("Time") {
                    DatePicker("Starts", selection: $start, displayedComponents: .hourAndMinute)
                    DatePicker("Ends", selection: $end, displayedComponents: .hourAndMinute)
                }
                Section {
                    TextField("Label (optional) — e.g. CHEM 101", text: $label)
                } footer: {
                    Text("Recurs every week. Staff see a conflict warning if a shift overlaps this.")
                }
                if let error {
                    Section {
                        Text(error).font(.footnote).foregroundStyle(Color.statusText(.red))
                    }
                }
            }
            .navigationTitle("Add Availability")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .disabled(isSaving)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button {
                        Task { await save() }
                    } label: {
                        if isSaving {
                            ProgressView().controlSize(.small)
                        } else {
                            Text("Add").fontWeight(.semibold)
                        }
                    }
                    .disabled(isSaving)
                }
            }
            .interactiveDismissDisabled(isSaving)
        }
    }

    private func save() async {
        let startStr = Self.hhmm(start)
        let endStr = Self.hhmm(end)
        guard startStr < endStr else {
            error = "Start time must be before end time"
            Haptics.warning()
            return
        }
        isSaving = true
        error = nil
        let trimmed = label.trimmingCharacters(in: .whitespaces)
        do {
            _ = try await APIClient.shared.createAvailabilityBlock(
                userId: userId,
                dayOfWeek: dayOfWeek,
                startsAt: startStr,
                endsAt: endStr,
                label: trimmed.isEmpty ? nil : trimmed
            )
            Haptics.success()
            onAdded()
            dismiss()
        } catch {
            self.error = error.localizedDescription
            Haptics.warning()
        }
        isSaving = false
    }

    private static func hhmm(_ date: Date) -> String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "HH:mm"
        return f.string(from: date)
    }
}
