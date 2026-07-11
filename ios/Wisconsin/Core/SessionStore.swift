import SwiftUI
import os

private let sessionPerformanceLog = Logger(subsystem: "com.erikrole.Wisconsin", category: "Launch")

private func elapsedMilliseconds(since start: Date) -> Int {
    Int(Date().timeIntervalSince(start) * 1_000)
}

/// A lightweight cache of the last authenticated user, stored in UserDefaults.
/// It lets the app draw the correct shell (tab bar + Home's own skeleton) on
/// the next cold launch without first blocking on the `/me` round-trip. The
/// auth **cookie** in `HTTPCookieStorage` remains the real credential and
/// source of truth; this snapshot is only a UI hint and never gates access.
/// `restoreSession()` revalidates on every launch and clears this on a
/// confirmed 401, so a revoked session bounces to Login.
private enum SessionSnapshot {
    private static let key = "WisconsinSessionSnapshot"

    static func load() -> CurrentUser? {
        guard let data = UserDefaults.standard.data(forKey: key) else { return nil }
        return try? JSONDecoder().decode(CurrentUser.self, from: data)
    }

    static func save(_ user: CurrentUser) {
        guard let data = try? JSONEncoder().encode(user) else { return }
        UserDefaults.standard.set(data, forKey: key)
    }

    static func clear() {
        UserDefaults.standard.removeObject(forKey: key)
    }
}

@MainActor
@Observable
final class SessionStore {
    var currentUser: CurrentUser?
    var isLoading = false
    var isRestoring = true
    var error: String?
    var isOffline = false

    /// True when this launch optimistically seeded `currentUser` from a stored
    /// snapshot, so the app shell rendered before `/me` confirmed the session.
    private var didSeedFromSnapshot = false

    init() {
        // Optimistic launch: if the last session left a snapshot, render the
        // app shell immediately (Home shows its own skeleton while fresh data
        // loads) instead of blocking the entire UI on the /me round-trip. No
        // cached *content* is shown — only the shell and the device owner's own
        // identity. `restoreSession()` validates in the background and bounces
        // to Login on a confirmed 401. Users mid forced-password-change take
        // the strict path so they can't slip past that gate.
        if let snapshot = SessionSnapshot.load(), !snapshot.forcePasswordChange {
            currentUser = snapshot
            isRestoring = false
            didSeedFromSnapshot = true
        }
        Task { await restoreSession() }
        // Listen for global 401s posted from APIClient and route the user back to login.
        NotificationCenter.default.addObserver(
            forName: .sessionDidExpire,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            Task { @MainActor in
                guard let self else { return }
                if self.currentUser != nil {
                    self.currentUser = nil
                    SessionSnapshot.clear()
                    self.error = "Your session expired — please sign in again."
                }
            }
        }
    }

    func login(email: String, password: String) async {
        isLoading = true
        error = nil
        do {
            let user = try await APIClient.shared.login(email: email, password: password)
            currentUser = user
            SessionSnapshot.save(user)
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }

    func completeForcedPasswordChange(currentPassword: String, newPassword: String) async {
        isLoading = true
        error = nil
        do {
            try await APIClient.shared.changePassword(
                currentPassword: currentPassword,
                newPassword: newPassword,
                revokeOtherSessions: true
            )
            let user = try await APIClient.shared.me()
            currentUser = user
            SessionSnapshot.save(user)
            isOffline = false
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }

    func logout() async {
        // Best-effort: a stuck server must not strand the user signed in.
        // Local sign-out (clear `currentUser` + cookies) always wins.
        try? await APIClient.shared.revokeAllDeviceTokens()
        try? await APIClient.shared.revokeCheckoutReturnLiveActivityStartTokens()
        try? await APIClient.shared.logout()
        SessionSnapshot.clear()
        currentUser = nil
    }

    func clearDeletedAccountLocally() async {
        try? await APIClient.shared.logout()
        SessionSnapshot.clear()
        currentUser = nil
    }

    /// Clear a stale auth error — call from views when the user starts typing again.
    func clearError() {
        if error != nil { error = nil }
    }

    private func restoreSession() async {
        let startedAt = Date()
        let optimistic = didSeedFromSnapshot
        var result = "unknown"
        defer {
            isRestoring = false
            // Distinguish the optimistic path (shell already shown) from a cold
            // blocking restore so launch timings stay comparable in Console.
            let phase = optimistic ? "launch.session.optimistic" : "launch.session.restore"
            sessionPerformanceLog.info("\(phase, privacy: .public) result=\(result, privacy: .public) durationMs=\(elapsedMilliseconds(since: startedAt), privacy: .public)")
        }
        do {
            let user = try await APIClient.shared.me()
            currentUser = user
            SessionSnapshot.save(user)
            isOffline = false
            result = "authenticated"
        } catch APIError.unauthorized {
            // Confirmed revoked/expired session — drop the optimistic shell and
            // send the user to Login.
            SessionSnapshot.clear()
            currentUser = nil
            result = "unauthorized"
        } catch {
            // Network failure — don't clear session state; keep any optimistic
            // session and let the user retry.
            isOffline = true
            result = optimistic ? "offline-optimistic" : "offline"
        }
    }
}
