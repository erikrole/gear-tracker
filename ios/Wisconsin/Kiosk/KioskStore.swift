import Foundation
import Observation
import Security
import UIKit

// Global reference so AppDelegate can check kiosk mode for orientation locking.
@MainActor var sharedKioskStore: KioskStore?

/// Keychain-backed storage for the kiosk_session token. HTTPCookieStorage and
/// UserDefaults live in the app container, which Xcode reinstalls can wipe.
/// The activation endpoint returns the raw session token to the native app so
/// it can be stored here and re-created as a cookie on launch.
private enum KioskSessionVault {
    private static let service = "com.wisconsin.kiosk"
    private static let account = "kiosk_session"

    private static var baseQuery: [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
    }

    @discardableResult
    static func save(_ token: String) -> Bool {
        let data = Data(token.utf8)
        let attrs: [String: Any] = [
            kSecValueData as String: data,
            // AfterFirstUnlock: the kiosk iPad reboots unattended; the token
            // must be readable as soon as the device has been unlocked once.
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlock,
        ]
        let status = SecItemUpdate(baseQuery as CFDictionary, attrs as CFDictionary)
        if status == errSecItemNotFound {
            var add = baseQuery
            add.merge(attrs) { _, new in new }
            return SecItemAdd(add as CFDictionary, nil) == errSecSuccess
        }
        return status == errSecSuccess
    }

    static func load() -> String? {
        var query = baseQuery
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: AnyObject?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    static func clear() {
        SecItemDelete(baseQuery as CFDictionary)
    }
}

/// A scanned item held in cross-flow state so a brief inactivity reset doesn't
/// silently discard a student's scan list.
struct KioskCartItem: Identifiable, Codable, Equatable {
    let id: String
    let name: String
    let tagName: String
    let type: String?
    let imageUrl: String?
    let bulkSkuId: String?
    let unitNumber: Int?

    var isNumberedBulk: Bool {
        bulkSkuId != nil && unitNumber != nil
    }

    var itemListPrimaryTitle: String {
        tagName.nonBlankText ?? name
    }

    var itemListSecondaryTitle: String? {
        itemListPrimaryTitle.isSameListText(as: name) ? nil : name
    }
}

struct KioskCheckoutDraft: Equatable {
    let isLinkedToEvent: Bool
    let selectedEventId: String?
    let customPurpose: String
    let dueBackAt: Date
    let contextReady: Bool
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
    private var checkoutDrafts: [String: KioskCheckoutDraft] = [:]

    /// True when the inactivity warning should be shown ahead of the reset.
    var inactivityWarningVisible: Bool = false
    var sleepDismissedUntil: Date?

    /// True while a cold-launch session restore is in flight, so the shell can
    /// show a brief splash instead of flashing the activation numpad.
    var isResuming: Bool = false
    private var didAttemptResume = false

    private var inactivityTask: Task<Void, Never>?
    private var heartbeatTask: Task<Void, Never>?
    @ObservationIgnored private var unauthorizedObserver: NSObjectProtocol?

    private static let infoKey = "kiosk_info_v1"
    private static let inactivityTotal: UInt64 = 300_000_000_000        // 5 min
    private static let inactivityWarning: UInt64 = 270_000_000_000      // 4:30
    private static let sleepDismissalDuration: TimeInterval = 10 * 60

    init() {
        if let data = UserDefaults.standard.data(forKey: Self.infoKey),
           let saved = try? JSONDecoder().decode(KioskInfo.self, from: data) {
            info = saved
            isActive = true
        } else if KioskSessionVault.load() != nil {
            // A reinstall/update wiped the app container (UserDefaults + cookie
            // jar) but the Keychain kiosk token survived. Treat the device as a
            // kiosk so it boots back into kiosk mode; `resumeIfNeeded()` rebuilds
            // device info from /api/kiosk/me without an activation code.
            isActive = true
        }
        unauthorizedObserver = NotificationCenter.default.addObserver(
            forName: .kioskSessionUnauthorized,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            Task { @MainActor [weak self] in
                self?.handleUnauthorizedSession()
            }
        }
    }

    /// Restore an activated kiosk on a cold launch (icon tap, Xcode rebuild, OS
    /// relaunch) WITHOUT requiring the `wisconsin://kiosk` deeplink. Runs once
    /// when the kiosk shell first appears. A dedicated kiosk iPad therefore
    /// always comes back up in kiosk mode and only ever asks for a code after a
    /// manual deactivation or a genuine 7-day-dark session expiry.
    func resumeIfNeeded() {
        guard !didAttemptResume else { return }
        didAttemptResume = true
        if info != nil || KioskSessionVault.load() != nil {
            isResuming = true
        }
        enterKiosk()
    }

    // Called when the kiosk deeplink is opened or debug button tapped.
    func enterKiosk() {
        isActive = true
        restoreSessionCookieIfNeeded()
        // Validate when we have local info OR a surviving Keychain token —
        // the latter rebuilds info from /api/kiosk/me after a reinstall.
        if info != nil || KioskSessionVault.load() != nil {
            Task { await validateSession() }
        } else {
            isResuming = false
            screen = .activation
        }
    }

    // Validates the stored kiosk_session cookie is still live.
    private func validateSession() async {
        defer { isResuming = false }
        do {
            let me = try await KioskAPI.shared.kioskMe()
            if info == nil {
                // Reinstall wiped UserDefaults but the Keychain token held —
                // rebuild device info from the server.
                saveInfo(KioskInfo(
                    kioskId: me.kioskId,
                    name: me.name ?? "Gear Room",
                    locationId: me.locationId,
                    locationName: me.locationName
                ))
            }
            persistSessionCookie()
            screen = .idle
            startHeartbeat()
            resetInactivity()
        } catch APIError.unauthorized {
            // Definitive: session expired or device deactivated by an admin.
            KioskSessionVault.clear()
            clearStoredInfo()
            screen = .activation
        } catch {
            // Transient (offline at launch, 5xx, decode hiccup) — don't throw
            // away a valid activation; go idle and let the heartbeat catch a
            // real deactivation via its own 401 path. Without local info
            // there's nothing to render, so fall back to activation.
            if info != nil {
                screen = .idle
                startHeartbeat()
                resetInactivity()
            } else {
                screen = .activation
            }
        }
    }

    func activate(response: KioskActivationResponse) {
        saveInfo(KioskInfo(
            kioskId: response.kioskId,
            name: response.name,
            locationId: response.location.id,
            locationName: response.location.name
        ))
        if let sessionToken = response.sessionToken {
            #if DEBUG
            let saved = KioskSessionVault.save(sessionToken)
            print("[KioskStore] kiosk session token saved to Keychain: \(saved)")
            #else
            KioskSessionVault.save(sessionToken)
            #endif
        } else {
            persistSessionCookie()
        }
        screen = .idle
        startHeartbeat()
        resetInactivity()
    }

    func deactivate() {
        isActive = false
        isResuming = false
        didAttemptResume = false
        clearStoredInfo()
        KioskSessionVault.clear()
        checkoutCarts.removeAll()
        checkoutDrafts.removeAll()
        screen = .activation
        for cookie in HTTPCookieStorage.shared.cookies ?? [] where cookie.name == "kiosk_session" {
            HTTPCookieStorage.shared.deleteCookie(cookie)
        }
    }

    private func handleUnauthorizedSession() {
        guard info != nil || isActive else { return }
        deactivate()
        UIAccessibility.post(
            notification: .announcement,
            argument: "This kiosk session expired. Enter a new activation code."
        )
    }

    // MARK: - Session persistence across reinstalls

    /// Mirror the kiosk_session cookie value into the Keychain.
    private func persistSessionCookie() {
        guard let cookie = HTTPCookieStorage.shared.cookies?
            .first(where: { $0.name == "kiosk_session" }) else { return }
        KioskSessionVault.save(cookie.value)
    }

    /// Re-create the kiosk_session cookie from the Keychain when the cookie
    /// jar is empty (fresh install). The local expiry is a placeholder — the
    /// server re-issues the cookie with its authoritative expiry on the first
    /// authenticated response, and requireKiosk() rejects expired sessions.
    private func restoreSessionCookieIfNeeded() {
        let hasCookie = HTTPCookieStorage.shared.cookies?
            .contains { $0.name == "kiosk_session" } ?? false
        guard !hasCookie, let token = KioskSessionVault.load() else { return }
        let properties: [HTTPCookiePropertyKey: Any] = [
            .name: "kiosk_session",
            .value: token,
            .domain: KioskAPI.host,
            .path: "/",
            .secure: "TRUE",
            .expires: Date().addingTimeInterval(7 * 24 * 3600),
        ]
        if let cookie = HTTPCookie(properties: properties) {
            HTTPCookieStorage.shared.setCookie(cookie)
        }
    }

    private func saveInfo(_ newInfo: KioskInfo) {
        info = newInfo
        if let data = try? JSONEncoder().encode(newInfo) {
            UserDefaults.standard.set(data, forKey: Self.infoKey)
        }
    }

    /// Reset the 5-minute inactivity countdown. Schedules a 4:30 warning and a
    /// hard reset at 5:00. Any user touch (handled by KioskShellView's
    /// non-cancelling UIKit activity monitor) calls this.
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

    /// Keep standby from immediately covering the idle screen after a real
    /// interaction, even if the user briefly leaves and returns to idle.
    func deferSleepMode(for duration: TimeInterval = 10 * 60) {
        sleepDismissedUntil = Date().addingTimeInterval(duration)
        resetInactivity()
    }

    func clearSleepModeDismissal() {
        sleepDismissedUntil = nil
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

    func checkoutDraft(for userId: String) -> KioskCheckoutDraft? {
        checkoutDrafts[userId]
    }

    func setCheckoutDraft(_ draft: KioskCheckoutDraft, for userId: String) {
        checkoutDrafts[userId] = draft
    }

    func clearCheckoutDraft(for userId: String) {
        checkoutDrafts.removeValue(forKey: userId)
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
