import Foundation
import Observation

// Global reference so AppDelegate can check kiosk mode for orientation locking.
var sharedKioskStore: KioskStore?

/// A scanned item held in cross-flow state so a brief inactivity reset doesn't
/// silently discard a student's scan list.
struct KioskCartItem: Identifiable, Codable, Equatable {
    let id: String
    let name: String
    let tagName: String
    let type: String?
}

@Observable
@MainActor
final class KioskStore {
    var info: KioskInfo?
    var screen: KioskScreen = .activation
    var isActive: Bool = false
    var isKioskMode: Bool { info != nil }

    /// Active student's checkout cart, persisted in-memory across inactivity
    /// resets. Keyed by `userId` so a quick reset → re-tap restores the cart.
    private var checkoutCarts: [String: [KioskCartItem]] = [:]

    /// True when the inactivity warning should be shown ahead of the reset.
    var inactivityWarningVisible: Bool = false

    private var inactivityTask: Task<Void, Never>?
    private var heartbeatTask: Task<Void, Never>?

    private static let infoKey = "kiosk_info_v1"
    private static let inactivityTotal: UInt64 = 300_000_000_000        // 5 min
    private static let inactivityWarning: UInt64 = 270_000_000_000      // 4:30

    init() {
        if let data = UserDefaults.standard.data(forKey: Self.infoKey),
           let saved = try? JSONDecoder().decode(KioskInfo.self, from: data) {
            info = saved
            isActive = true
        }
    }

    // Called when the kiosk deeplink is opened or debug button tapped.
    func enterKiosk() {
        isActive = true
        if info != nil {
            Task { await validateSession() }
        } else {
            screen = .activation
        }
    }

    // Validates the stored kiosk_session cookie is still live.
    private func validateSession() async {
        do {
            try await KioskAPI.shared.kioskMe()
            screen = .idle
            startHeartbeat()
            resetInactivity()
        } catch {
            clearStoredInfo()
            screen = .activation
        }
    }

    func activate(response: KioskActivationResponse) {
        let newInfo = KioskInfo(
            kioskId: response.kioskId,
            name: response.name,
            locationId: response.location.id,
            locationName: response.location.name
        )
        info = newInfo
        if let data = try? JSONEncoder().encode(newInfo) {
            UserDefaults.standard.set(data, forKey: Self.infoKey)
        }
        screen = .idle
        startHeartbeat()
        resetInactivity()
    }

    func deactivate() {
        isActive = false
        clearStoredInfo()
        checkoutCarts.removeAll()
        screen = .activation
        for cookie in HTTPCookieStorage.shared.cookies ?? [] where cookie.name == "kiosk_session" {
            HTTPCookieStorage.shared.deleteCookie(cookie)
        }
    }

    /// Reset the 5-minute inactivity countdown. Schedules a 4:30 warning and a
    /// hard reset at 5:00. Any user touch (handled in KioskShellView's
    /// simultaneousGesture) calls this.
    func resetInactivity() {
        inactivityTask?.cancel()
        inactivityWarningVisible = false
        inactivityTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: Self.inactivityWarning)
            guard let self, !Task.isCancelled else { return }
            // Only show the warning if we're inside an active flow — idle
            // screen has nothing to lose.
            if case .idle = self.screen {
                // Idle → just wait the remaining time then no-op stays on idle.
            } else {
                self.inactivityWarningVisible = true
            }
            try? await Task.sleep(nanoseconds: Self.inactivityTotal - Self.inactivityWarning)
            guard !Task.isCancelled else { return }
            // Soft reset: keep the cart for the active student so a returning
            // tap restores progress; just route back to idle.
            self.inactivityWarningVisible = false
            self.screen = .idle
        }
    }

    /// Cancels the inactivity warning when the student dismisses it.
    func dismissInactivityWarning() {
        inactivityWarningVisible = false
        resetInactivity()
    }

    // MARK: - Cart persistence (P0 #2 fix)

    func cart(for userId: String) -> [KioskCartItem] {
        checkoutCarts[userId] ?? []
    }

    func setCart(_ cart: [KioskCartItem], for userId: String) {
        if cart.isEmpty {
            checkoutCarts.removeValue(forKey: userId)
        } else {
            checkoutCarts[userId] = cart
        }
    }

    func clearCart(for userId: String) {
        checkoutCarts.removeValue(forKey: userId)
    }

    // MARK: - Internals

    private func clearStoredInfo() {
        info = nil
        UserDefaults.standard.removeObject(forKey: Self.infoKey)
        inactivityTask?.cancel()
        heartbeatTask?.cancel()
    }

    private func startHeartbeat() {
        heartbeatTask?.cancel()
        heartbeatTask = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 60_000_000_000) // 60s
                guard let self else { return }
                do {
                    try await KioskAPI.shared.kioskHeartbeat()
                } catch APIError.unauthorized {
                    // Admin deactivated this kiosk (or cookie expired). Don't
                    // keep pretending — drop back to activation.
                    self.deactivate()
                    return
                } catch {
                    // Transient — keep heartbeating.
                }
            }
        }
    }
}
