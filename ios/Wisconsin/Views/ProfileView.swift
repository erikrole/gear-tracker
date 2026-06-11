import SwiftUI
import UserNotifications

struct ProfileView: View {
    @Environment(SessionStore.self) private var session
    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss
    @Environment(\.scenePhase) private var scenePhase
    @State private var showSignOutConfirm = false
    @State private var showLinkStickerWizard = false
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

struct SettingsMenuRow<Trailing: View>: View {
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

private enum ProfileDestination: Hashable {
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
