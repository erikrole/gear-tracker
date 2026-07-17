import SwiftUI
import UserNotifications

struct NotificationSettingsView: View {
    @Environment(AppState.self) private var appState
    let prefsVM: NotificationPrefsViewModel
    @Binding var pushAuth: UNAuthorizationStatus
    let iosSettingsURL: URL
    let showPushPrompt: () -> Void

    @AppStorage(PushTokenStorage.currentTokenKey) private var currentPushToken = ""
    @State private var isSendingTestPush = false
    @State private var testPushMessage: String?
    @State private var testPushSucceeded = false

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

            if let prefs = prefsVM.prefs {
                Section {
                    channelToggle(
                        title: "Push alerts",
                        description: "Send push notifications to this device.",
                        isOn: prefs.channels.push,
                        onChange: { v in Task { await prefsVM.setChannel(.push, value: v) } }
                    )

                    if pushAllowed && !currentPushToken.isEmpty {
                        Button {
                            Task { await sendTestPush() }
                        } label: {
                            HStack(spacing: 12) {
                                Image(systemName: "paperplane.fill")
                                    .foregroundStyle(Color.statusText(.blue))
                                    .frame(width: 22)
                                Text("Send Test Notification")
                                    .foregroundStyle(.primary)
                                Spacer()
                                if isSendingTestPush {
                                    ProgressView()
                                        .controlSize(.small)
                                }
                            }
                        }
                        .disabled(isSendingTestPush)
                        .accessibilityHint("Sends a real push notification to this device.")
                    }

                    if let testPushMessage {
                        Label(
                            testPushMessage,
                            systemImage: testPushSucceeded ? "checkmark.circle.fill" : "exclamationmark.triangle.fill"
                        )
                        .font(.caption)
                        .foregroundStyle(testPushSucceeded ? Color.statusText(.green) : Color.statusText(.orange))
                        .fixedSize(horizontal: false, vertical: true)
                    }
                } header: {
                    Text("Delivery")
                } footer: {
                    Text("Push alerts go to devices signed in to this account. The test checks this device only.")
                }

                Section {
                    categoryToggle(
                        title: "Checkout due reminders",
                        description: "Notified before gear is due back.",
                        category: .checkoutDue
                    )

                    categoryToggle(
                        title: "Checkout overdue alerts",
                        description: "Notified when gear is past due.",
                        category: .checkoutOverdue
                    )

                    categoryToggle(
                        title: "Reservation updates",
                        description: "Confirmation, pickup-ready, and cancellation notices.",
                        category: .reservation
                    )

                    categoryToggle(
                        title: "License expiry reminders",
                        description: "Notified when one of your licenses is approaching expiry.",
                        category: .licenseExpiry
                    )

                    categoryToggle(
                        title: "Schedule updates",
                        description: "Published shift assignments, removals, and call-time changes.",
                        category: .schedule
                    )

                    categoryToggle(
                        title: "Trade updates",
                        description: "Claimed, approved, declined, completed, and expired shift trades.",
                        category: .trade
                    )

                    categoryToggle(
                        title: "Gear prep nudges",
                        description: "Staff-triggered reminders to reserve or prepare gear.",
                        category: .gearPrep
                    )
                } header: {
                    Text("Notification Types")
                } footer: {
                    Text("Choose which push alerts can reach you.")
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
        .onChange(of: testPushMessage) { _, message in
            if let message {
                AccessibilityNotification.Announcement(message).post()
            }
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
                        .foregroundStyle(Color.statusText(.blue))
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
    private func channelToggle(
        title: String,
        description: String,
        isOn: Bool,
        onChange: @escaping (Bool) -> Void
    ) -> some View {
        let binding = Binding(
            get: { isOn },
            set: { onChange($0) }
        )
        Toggle(isOn: binding) {
            Text(title)
                .font(.subheadline.weight(.medium))
        }
        .tint(Color.statusText(.green))
        .disabled(prefsVM.saving)
        .accessibilityHint(description)
    }

    @ViewBuilder
    private func categoryToggle(
        title: String,
        description: String,
        category: NotificationPrefsViewModel.Category
    ) -> some View {
        let binding = Binding(
            get: { prefsVM.categoryValue(category) },
            set: { value in Task { await prefsVM.setCategory(category, value: value) } }
        )
        Toggle(isOn: binding) {
            Text(title)
                .font(.subheadline.weight(.medium))
        }
        .tint(Color.statusText(.green))
        .disabled(prefsVM.saving)
        .accessibilityHint(description)
    }

    private var notificationSummaryText: String {
        if prefsVM.loading && prefsVM.prefs == nil {
            return "Loading push and notification type preferences."
        }
        if prefsVM.error != nil && prefsVM.prefs == nil {
            return "Preferences could not load. Retry below before changing alert behavior."
        }
        guard let prefs = prefsVM.prefs else {
            return "In-app notifications are always available."
        }
        return prefs.channels.push
            ? "Push alerts are enabled."
            : "Only the in-app inbox is enabled."
    }

    private var notificationSummaryIcon: String {
        if prefsVM.error != nil && prefsVM.prefs == nil { return "exclamationmark.triangle.fill" }
        return "bell.badge"
    }

    private var notificationSummaryTint: Color {
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

    private var pushAllowed: Bool {
        pushAuth == .authorized || pushAuth == .provisional || pushAuth == .ephemeral
    }

    @MainActor
    private func sendTestPush() async {
        guard !isSendingTestPush else { return }
        isSendingTestPush = true
        testPushMessage = nil
        defer { isSendingTestPush = false }

        do {
            let result = try await APIClient.shared.sendTestPush(deviceToken: currentPushToken)
            if result.delivered > 0 {
                testPushSucceeded = true
                testPushMessage = "Test notification sent to this device."
                Haptics.success()
            } else if result.devices == 0 {
                testPushSucceeded = false
                testPushMessage = "No registered device was found. Retry push registration above."
                Haptics.warning()
            } else {
                testPushSucceeded = false
                testPushMessage = "The test notification was not delivered. Retry registration and try again."
                Haptics.warning()
            }
        } catch {
            testPushSucceeded = false
            testPushMessage = error.localizedDescription
            Haptics.warning()
        }
    }

    private func refreshPushAuth() async {
        let settings = await UNUserNotificationCenter.current().notificationSettings()
        pushAuth = settings.authorizationStatus
    }
}
