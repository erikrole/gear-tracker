import Foundation
import Observation

// Global reference so AppDelegate can check kiosk mode for orientation locking.
var sharedKioskStore: KioskStore?

@Observable
@MainActor
final class KioskStore {
    var info: KioskInfo?
    var screen: KioskScreen = .activation
    var isKioskMode: Bool { info != nil }

    private var inactivityTask: Task<Void, Never>?
    private var heartbeatTask: Task<Void, Never>?

    private static let infoKey = "kiosk_info_v1"

    init() {
        if let data = UserDefaults.standard.data(forKey: Self.infoKey),
           let saved = try? JSONDecoder().decode(KioskInfo.self, from: data) {
            info = saved
        }
    }

    // Called when the kiosk deeplink is opened.
    func enterKiosk() {
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
        clearStoredInfo()
        screen = .activation
        for cookie in HTTPCookieStorage.shared.cookies ?? [] where cookie.name == "kiosk_session" {
            HTTPCookieStorage.shared.deleteCookie(cookie)
        }
    }

    func resetInactivity() {
        inactivityTask?.cancel()
        inactivityTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: 300_000_000_000) // 5 minutes
            guard !Task.isCancelled else { return }
            self?.screen = .idle
        }
    }

    private func clearStoredInfo() {
        info = nil
        UserDefaults.standard.removeObject(forKey: Self.infoKey)
        inactivityTask?.cancel()
        heartbeatTask?.cancel()
    }

    private func startHeartbeat() {
        heartbeatTask?.cancel()
        heartbeatTask = Task {
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 60_000_000_000) // 60s
                try? await KioskAPI.shared.kioskHeartbeat()
            }
        }
    }
}
