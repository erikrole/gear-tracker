import SwiftUI
import UserNotifications

struct NotificationSettingsView: View {
    @Environment(AppState.self) private var appState
    let prefsVM: NotificationPrefsViewModel
    @Binding var pushAuth: UNAuthorizationStatus
    let currentEmail: String
    let iosSettingsURL: URL
    let showPushPrompt: () -> Void

    @ScaledMetric(relativeTo: .subheadline) private var iconWidth: CGFloat = 22

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

                if pushAuth == .authorized || pushAuth == .provisional || pushAuth == .ephemeral {
                    pushRegistrationRow
                }

                if prefsVM.loading && prefsVM.prefs == nil {
                    HStack {
                        ProgressView().controlSize(.small)
                        Text("Loading preferences…")
                            .foregroundStyle(.secondary)
                            .font(.subheadline)
                    }
                } else if prefsVM.prefs == nil, let err = prefsVM.error {
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
            } footer: {
                Text("In-app notifications always show in your inbox, regardless of these settings.")
            }

            if prefsVM.prefs != nil {
                Section {
                    if let until = prefsVM.pausedUntilDate {
                        pausedRow(until: until)
                    } else {
                        pauseChipsRow
                    }
                } header: {
                    Text("Pause Alerts")
                } footer: {
                    if prefsVM.pausedUntilDate == nil {
                        Text("Temporarily silence email and push alerts. In-app notifications keep arriving.")
                    }
                }
            }

            if let prefs = prefsVM.prefs {
                Section {
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
                } header: {
                    Text("Delivery")
                }

                Section {
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
                } header: {
                    Text("Notification Types")
                } footer: {
                    Text("Choose which email and push alerts can reach you.")
                }
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
    private var pushRegistrationRow: some View {
        switch appState.pushRegistrationState {
        case .unknown:
            EmptyView()
        case .registering:
            HStack(spacing: 12) {
                ProgressView()
                    .controlSize(.small)
                Text("Registering this device for push…")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        case .registered:
            Label("This device is registered for push", systemImage: "checkmark.circle.fill")
                .font(.caption)
                .foregroundStyle(Color.statusText(.green))
        case .failed:
            VStack(alignment: .leading, spacing: 10) {
                Label {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Push registration needs attention")
                            .font(.subheadline.weight(.medium))
                        Text("The app could not register this device with the notification server.")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                } icon: {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .foregroundStyle(Color.statusText(.orange))
                }

                Button {
                    Haptics.tap()
                    appState.requestRemoteNotificationRegistration()
                } label: {
                    Label("Retry registration", systemImage: "arrow.clockwise")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
                .accessibilityHint("Attempts to register this device for push notifications again.")
            }
            .padding(.vertical, 2)
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
                        .frame(width: iconWidth)
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
                        .foregroundStyle(Color.statusText(.blue))
                        .frame(width: iconWidth)
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
        HStack(spacing: 8) {
            pauseChip(label: "1 Hour",  seconds: 3600)
            pauseChip(label: "1 Day",   seconds: 86_400)
            pauseChip(label: "1 Week",  seconds: 604_800)
        }
        .padding(.vertical, 2)
    }

    private func pauseChip(label: String, seconds: TimeInterval) -> some View {
        Button {
            Task {
                await prefsVM.pause(for: seconds)
            }
        } label: {
            Text(label)
                .font(.footnote.weight(.medium))
                .frame(maxWidth: .infinity)
                .padding(.vertical, 6)
        }
        .buttonStyle(.bordered)
        .controlSize(.small)
        .disabled(prefsVM.saving)
        .accessibilityLabel("Pause alerts for \(label)")
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
        .accessibilityElement(children: .contain)
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
                    .frame(width: iconWidth)
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
        .disabled(prefsVM.isPaused)
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
                    .frame(width: iconWidth)
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
        return Color.statusText(.blue)
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
