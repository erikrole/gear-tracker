import SwiftUI
import UIKit
import UserNotifications

// MARK: - Settings

/// Dedicated settings page pushed from the gear button on `ProfileView`.
/// Follows the system Settings app conventions: plain body-text rows with
/// solid-color icon squares, short trailing values instead of subtitles,
/// and a centered destructive Sign Out row.
struct SettingsView: View {
    @Environment(SessionStore.self) private var session

    let prefsVM: NotificationPrefsViewModel
    let pushAuth: UNAuthorizationStatus

    @State private var showSignOutConfirm = false
    @State private var showLinkStickerWizard = false
    @State private var showScannerDebugger = false
    @AppStorage("WisconsinThemeChoice") private var themeChoice: ThemeChoice = .system

    private static let iosSettingsURL = URL(string: UIApplication.openSettingsURLString)!
    private static let privacyURL = AppEnvironment.baseURL.appending(path: "privacy")
    private static let supportURL = URL(string: "mailto:erole@athletics.wisc.edu?subject=Wisconsin%20Creative%20Support")!

    private var isStaffOrAdmin: Bool {
        let role = session.currentUser?.role ?? ""
        return role == "ADMIN" || role == "STAFF"
    }

    var body: some View {
        List {
            Section {
                NavigationLink(value: ProfileDestination.accountSecurity) {
                    SettingsRow(title: "Account & Security", systemImage: "lock.fill", color: .blue)
                }
                NavigationLink(value: ProfileDestination.notifications) {
                    SettingsRow(title: "Notifications", systemImage: "bell.badge.fill", color: .red) {
                        Text(notificationStatusText)
                            .foregroundStyle(.secondary)
                    }
                }
            }

            Section {
                Picker(selection: $themeChoice) {
                    ForEach(ThemeChoice.allCases) { choice in
                        Label(choice.label, systemImage: choice.systemImage)
                            .tag(choice)
                    }
                } label: {
                    SettingsRow(title: "Theme", systemImage: "circle.lefthalf.filled", color: .indigo)
                }
                .pickerStyle(.menu)
            } footer: {
                Text("Your theme choice is saved on this device only.")
            }

            if isStaffOrAdmin {
                Section("Staff Tools") {
                    Button {
                        showLinkStickerWizard = true
                    } label: {
                        SettingsRow(title: "Link Sticker Codes", systemImage: "qrcode", color: .teal)
                    }
                    Button {
                        showScannerDebugger = true
                    } label: {
                        SettingsRow(title: "Scanner Debugger", systemImage: "barcode.viewfinder", color: .green)
                    }
                }
            }

            Section {
                Link(destination: Self.privacyURL) {
                    SettingsRow(title: "Privacy Policy", systemImage: "hand.raised.fill", color: .blue) {
                        Image(systemName: "arrow.up.forward")
                            .font(.footnote.weight(.semibold))
                            .foregroundStyle(.tertiary)
                    }
                }
                Link(destination: Self.supportURL) {
                    SettingsRow(title: "Contact Support", systemImage: "envelope.fill", color: .green) {
                        Image(systemName: "arrow.up.forward")
                            .font(.footnote.weight(.semibold))
                            .foregroundStyle(.tertiary)
                    }
                }
                SettingsRow(title: "Version", systemImage: "app.badge", color: .gray) {
                    Text(appVersion)
                        .foregroundStyle(.secondary)
                        .monospacedDigit()
                }
                Link(destination: Self.iosSettingsURL) {
                    SettingsRow(title: "Open iOS Settings", systemImage: "gear", color: .gray) {
                        Image(systemName: "arrow.up.forward")
                            .font(.footnote.weight(.semibold))
                            .foregroundStyle(.tertiary)
                    }
                }
            } footer: {
                Text("Camera, notification, and other system permissions live in iOS Settings.")
            }

            Section {
                Button("Sign Out", role: .destructive) {
                    showSignOutConfirm = true
                }
                .frame(maxWidth: .infinity)
            }
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

    // MARK: - Helpers

    private var pushAllowed: Bool {
        pushAuth == .authorized || pushAuth == .provisional || pushAuth == .ephemeral
    }

    private var notificationStatusText: String {
        if prefsVM.pausedUntilDate != nil { return "Paused" }
        guard let prefs = prefsVM.prefs else { return "" }
        var channels: [String] = []
        if prefs.channels.email { channels.append("Email") }
        if prefs.channels.push && pushAllowed { channels.append("Push") }
        return channels.isEmpty ? "In-app only" : channels.joined(separator: " & ")
    }

    private var appVersion: String {
        let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "—"
        let build = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "—"
        return "\(version) (\(build))"
    }
}

// MARK: - Row

/// System-Settings-style row: solid-color rounded square with a white
/// glyph, body-text title, optional short trailing value.
private struct SettingsRow<Trailing: View>: View {
    let title: String
    let systemImage: String
    let color: Color
    let trailing: () -> Trailing

    @ScaledMetric(relativeTo: .body) private var iconSize: CGFloat = 29

    init(
        title: String,
        systemImage: String,
        color: Color,
        @ViewBuilder trailing: @escaping () -> Trailing = { EmptyView() }
    ) {
        self.title = title
        self.systemImage = systemImage
        self.color = color
        self.trailing = trailing
    }

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: systemImage)
                .font(.system(size: iconSize * 0.52, weight: .medium))
                .foregroundStyle(.white)
                .frame(width: iconSize, height: iconSize)
                .background(color.gradient, in: RoundedRectangle(cornerRadius: iconSize * 0.22, style: .continuous))
                .accessibilityHidden(true)
            Text(title)
                .foregroundStyle(.primary)
            Spacer(minLength: 8)
            trailing()
        }
        .accessibilityElement(children: .combine)
    }
}
