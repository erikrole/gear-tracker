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
        try? await APIClient.shared.logout()
        currentUser = nil
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
