import SwiftUI
import UIKit
import UserNotifications

// MARK: - Profile

struct ProfileView: View {
    @Environment(SessionStore.self) private var session
    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss
    @Environment(\.scenePhase) private var scenePhase
    @State private var showPushPrompt = false
    @State private var prefsVM = NotificationPrefsViewModel()
    @State private var pushAuth: UNAuthorizationStatus = .notDetermined

    private static let manageAccountURL = AppEnvironment.baseURL
    private static let iosSettingsURL = URL(string: UIApplication.openSettingsURLString)!

    private var isStaffOrAdmin: Bool {
        let role = session.currentUser?.role ?? ""
        return role == "ADMIN" || role == "STAFF"
    }

    private var isStudentWorker: Bool {
        if session.currentUser?.staffingType == "ST" { return true }
        return session.currentUser?.staffingType == nil && (session.currentUser?.role ?? "") == "STUDENT"
    }

    private var profileTitle: String {
        session.currentUser?.name.split(separator: " ").first.map(String.init) ?? "Profile"
    }

    var body: some View {
        NavigationStack {
            List {
                headerSection
                scheduleSection
            }
            .listStyle(.insetGrouped)
            .navigationTitle(profileTitle)
            .navigationBarTitleDisplayMode(.inline)
            .sheet(isPresented: $showPushPrompt) {
                PushPrePromptView()
                    .presentationDetents([.medium])
                    .presentationDragIndicator(.visible)
            }
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    NavigationLink(value: ProfileDestination.settings) {
                        Image(systemName: "gearshape")
                    }
                    .accessibilityLabel("Settings")
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
            .navigationDestination(for: ProfileDestination.self) { dest in
                destinationView(for: dest)
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
            if isStudentWorker {
                NavigationLink(value: ProfileDestination.availability) {
                    SettingsMenuRow(
                        title: "My Availability",
                        subtitle: "Add unavailable times so staff can schedule around them.",
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
            if isStudentWorker {
                Text("Availability blocks are advisory. Staff can still override after confirming.")
            }
        }
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

    private func refreshPushAuth() async {
        let settings = await UNUserNotificationCenter.current().notificationSettings()
        pushAuth = settings.authorizationStatus
    }

    @ViewBuilder
    private func destinationView(for destination: ProfileDestination) -> some View {
        switch destination {
        case .settings:
            SettingsView(prefsVM: prefsVM, pushAuth: pushAuth)
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

    @ScaledMetric(relativeTo: .subheadline) private var iconSize: CGFloat = 34

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: iconSize * 0.24, style: .continuous)
                .fill(tint.opacity(0.14))
            Image(systemName: systemImage)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(tint)
        }
        .frame(width: iconSize, height: iconSize)
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
    case settings
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
            Image(systemName: systemImage)
                .font(.largeTitle)
                .foregroundStyle(.secondary)
            Text(message)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(.systemGroupedBackground))
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.inline)
    }

    private var systemImage: String {
        switch destination {
        case .upcomingShifts:
            "calendar"
        case .overdueBookings:
            "calendar.badge.exclamationmark"
        default:
            "lock"
        }
    }

    private var title: String {
        switch destination {
        case .upcomingShifts:
            "My Shifts"
        case .overdueBookings:
            "Overdue"
        default:
            "Unavailable"
        }
    }

    private var message: String {
        switch destination {
        case .upcomingShifts:
            "Open the Schedule tab to see your shifts."
        case .overdueBookings:
            "Open the Bookings tab to see overdue items."
        default:
            "This page is not available for your role on this device."
        }
    }
}
