import SwiftUI
import os

private let sessionPerformanceLog = Logger(subsystem: "com.erikrole.Wisconsin", category: "Launch")

private func elapsedMilliseconds(since start: Date) -> Int {
    Int(Date().timeIntervalSince(start) * 1_000)
}

@MainActor
@Observable
final class SessionStore {
    var currentUser: CurrentUser?
    var isLoading = false
    var isRestoring = true
    var error: String?
    var isOffline = false

    init() {
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
                    self.error = "Your session expired — please sign in again."
                }
            }
        }
    }

    func login(email: String, password: String) async {
        isLoading = true
        error = nil
        do {
            currentUser = try await APIClient.shared.login(email: email, password: password)
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
            currentUser = try await APIClient.shared.me()
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
        try? await APIClient.shared.logout()
        currentUser = nil
    }

    /// Clear a stale auth error — call from views when the user starts typing again.
    func clearError() {
        if error != nil { error = nil }
    }

    private func restoreSession() async {
        let startedAt = Date()
        var result = "unknown"
        defer {
            isRestoring = false
            sessionPerformanceLog.info("launch.session.restore result=\(result, privacy: .public) durationMs=\(elapsedMilliseconds(since: startedAt), privacy: .public)")
        }
        do {
            currentUser = try await APIClient.shared.me()
            isOffline = false
            result = "authenticated"
        } catch APIError.unauthorized {
            currentUser = nil
            result = "unauthorized"
        } catch {
            // Network failure — don't clear session state; let user retry
            isOffline = true
            result = "offline"
        }
    }
}
