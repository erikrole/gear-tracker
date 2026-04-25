import SwiftUI

@MainActor
@Observable
final class SessionStore {
    var currentUser: CurrentUser?
    var isLoading = false
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
        do {
            currentUser = try await APIClient.shared.me()
            isOffline = false
        } catch APIError.unauthorized {
            // No active session — show login
            currentUser = nil
        } catch {
            // Network failure — don't clear session state; let user retry
            isOffline = true
        }
    }
}
