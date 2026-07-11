import SwiftUI
import UIKit
import UserNotifications

// MARK: - Settings

/// Dedicated settings page pushed from the gear button on `ProfileView`.
/// Holds account, notification, appearance, tools, and app sections that
/// previously shared the profile sheet.
struct SettingsView: View {
    @Environment(SessionStore.self) private var session

    let prefsVM: NotificationPrefsViewModel
    let pushAuth: UNAuthorizationStatus

    @State private var showSignOutConfirm = false
    @State private var showLinkStickerWizard = false
    @State private var showScannerDebugger = false
    @AppStorage("WisconsinThemeChoice") private var themeChoice: ThemeChoice = .system

    private static let iosSettingsURL = URL(string: UIApplication.openSettingsURLString)!

    private var isStaffOrAdmin: Bool {
        let role = session.currentUser?.role ?? ""
        return role == "ADMIN" || role == "STAFF"
    }

    var body: some View {
        List {
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

    // MARK: - Sections

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

    // MARK: - Helpers

    private var appVersion: String {
        let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "—"
        let build = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "—"
        return "\(version) (\(build))"
    }

    private var accountSummaryText: String {
        let email = session.currentUser?.email ?? "Signed in"
        return "\(email) · password and account access"
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
}
