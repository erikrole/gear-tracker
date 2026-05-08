import SwiftUI

// MARK: - Theme override

/// Per-device theme override mirrored from web's `/settings/appearance`.
/// `system` follows the OS preference; `light` / `dark` force a fixed scheme.
enum ThemeChoice: String, CaseIterable, Identifiable {
    case system, light, dark

    var id: String { rawValue }

    var label: String {
        switch self {
        case .system: "System"
        case .light:  "Light"
        case .dark:   "Dark"
        }
    }

    var systemImage: String {
        switch self {
        case .system: "circle.lefthalf.filled"
        case .light:  "sun.max.fill"
        case .dark:   "moon.fill"
        }
    }

    /// `nil` = follow the OS; non-nil = force the corresponding scheme.
    var colorScheme: ColorScheme? {
        switch self {
        case .system: nil
        case .light:  .light
        case .dark:   .dark
        }
    }
}

// MARK: - Notification preferences view model

/// Drives the Notifications section in `ProfileView`. Loads the caller's
/// preferences from `/api/me/notification-preferences`, applies optimistic
/// updates locally, and reverts on save failure.
@MainActor
@Observable
final class NotificationPrefsViewModel {
    var prefs: NotificationPreferences?
    var loading: Bool = false
    var saving: Bool = false
    var error: String?

    private static let isoWithFractional: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()

    private static let isoBasic: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f
    }()

    func load() async {
        if loading { return }
        loading = true
        error = nil
        defer { loading = false }
        do {
            prefs = try await APIClient.shared.notificationPreferences()
        } catch {
            self.error = (error as? APIError)?.errorDescription ?? "Couldn't load preferences"
        }
    }

    /// Toggle a single channel; reverts on save failure.
    func setChannel(_ channel: Channel, value: Bool) async {
        guard var current = prefs else { return }
        let prev = current
        switch channel {
        case .email: current.channels.email = value
        case .push:  current.channels.push  = value
        }
        prefs = current
        await save(current, fallbackTo: prev)
    }

    func pause(for seconds: TimeInterval) async {
        guard var current = prefs else { return }
        let prev = current
        let until = Date().addingTimeInterval(seconds)
        current.pausedUntil = Self.isoWithFractional.string(from: until)
        prefs = current
        await save(current, fallbackTo: prev)
    }

    func resume() async {
        guard var current = prefs else { return }
        let prev = current
        current.pausedUntil = nil
        prefs = current
        await save(current, fallbackTo: prev)
    }

    /// Resolves the stored `pausedUntil` ISO string to a `Date` if it's still in
    /// the future. Returns nil for already-elapsed or missing values.
    var pausedUntilDate: Date? {
        guard let s = prefs?.pausedUntil else { return nil }
        let parsed = Self.isoWithFractional.date(from: s) ?? Self.isoBasic.date(from: s)
        guard let d = parsed, d > Date() else { return nil }
        return d
    }

    var isPaused: Bool { pausedUntilDate != nil }

    enum Channel { case email, push }

    private func save(
        _ next: NotificationPreferences,
        fallbackTo prev: NotificationPreferences
    ) async {
        saving = true
        defer { saving = false }
        do {
            try await APIClient.shared.updateNotificationPreferences(next)
            Haptics.selection()
        } catch {
            // Revert UI; surface a one-shot inline error.
            prefs = prev
            self.error = (error as? APIError)?.errorDescription ?? "Couldn't save"
            Haptics.error()
        }
    }
}
