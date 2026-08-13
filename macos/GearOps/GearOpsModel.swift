import AppKit
import Foundation
import Observation

enum KioskAccessState: String, Codable, Equatable, Sendable {
    case unknown
    case available
    case restricted
    case failed
}

private struct GearOpsCachedState: Codable {
    let user: GearOpsUser
    let snapshot: GearOpsSnapshot?
    let openBookings: [OpenBooking]?
    let openBookingTotal: Int?
    let activeBookingActivity: [BookingActivitySnapshot]?
    let kioskDevices: [KioskDevice]?
    let kioskAccess: KioskAccessState?
}

@MainActor
@Observable
final class GearOpsModel {
    private static let cacheKey = "GearOpsCachedStateV1"

    private let client: any GearOpsServing
    private let defaults: UserDefaults
    private let bookingNotifications: any BookingNotificationDelivering
    private let credentialStore: any CompanionCredentialStoring
    private var companionToken: String?
    private var currentDeviceToken: String?
    private var registeredDeviceCredential: String?
    private var sessionGeneration: UInt64 = 0
    private var installedProjection: CompanionProjection?
    private var refreshQueued = false
    private var pushTask: Task<Void, Never>?
    private var automaticRefreshTask: Task<Void, Never>?
    private var knownBookingActivity: [String: BookingActivitySnapshot] = [:]

    var user: GearOpsUser?
    var snapshot: GearOpsSnapshot?
    var openBookings: [OpenBooking] = []
    var openBookingTotal: Int?
    var activeBookingActivity: [BookingActivitySnapshot] = []
    var kioskDevices: [KioskDevice] = []
    var kioskAccess: KioskAccessState = .unknown
    var isRestoring = true
    var isSigningIn = false
    var isSigningOut = false
    var isRefreshing = false
    var statusMessage: String?
    var countDataIsPartial = false

    init(
        client: any GearOpsServing = GearOpsClient(),
        defaults: UserDefaults = .standard,
        bookingNotifications: any BookingNotificationDelivering = BookingNotificationCenter(),
        credentialStore: any CompanionCredentialStoring = CompanionCredentialStore(),
        autoStart: Bool = true
    ) {
        self.client = client
        self.defaults = defaults
        self.bookingNotifications = bookingNotifications
        self.credentialStore = credentialStore

        if let data = defaults.data(forKey: Self.cacheKey),
           let cached = try? JSONDecoder().decode(GearOpsCachedState.self, from: data) {
            user = cached.user
            snapshot = cached.snapshot
            openBookings = cached.openBookings ?? []
            openBookingTotal = cached.openBookingTotal
            activeBookingActivity = (cached.activeBookingActivity ?? [])
                .sorted(using: KeyPathComparator(\.startsAt))
            kioskDevices = cached.kioskDevices ?? []
            kioskAccess = cached.kioskAccess ?? .unknown
            knownBookingActivity = Dictionary(
                uniqueKeysWithValues: activeBookingActivity.map { ($0.id, $0) }
            )
        }

        if autoStart {
            startObservingPushEvents()
            startAutomaticRefresh()
        } else {
            isRestoring = false
        }
    }

    var menuBarSymbol: String {
        if user == nil { return "shippingbox" }
        return switch healthSeverity {
        case .healthy: "shippingbox.fill"
        case .attention: "shippingbox.and.arrow.backward.fill"
        case .critical: "exclamationmark.triangle.fill"
        }
    }

    var menuBarAccessibilityLabel: String {
        guard let count = openBookingTotal else {
            return user == nil ? "Wisconsin Creative, signed out" : "Wisconsin Creative, status unavailable"
        }
        return "Wisconsin Creative, \(count) active checkout\(count == 1 ? "" : "s"), \(healthLabel.lowercased())"
    }

    var healthSeverity: GearOpsHealthSeverity {
        if user != nil, snapshot == nil, statusMessage != nil { return .critical }
        if monitoredKioskDevices.contains(where: { $0.connectionState() == .offline }) { return .critical }
        if user != nil, kioskAccess == .restricted { return .attention }
        if countDataIsPartial || statusMessage != nil { return .attention }
        if monitoredKioskDevices.contains(where: { $0.connectionState() == .stale }) { return .attention }
        return .healthy
    }

    var healthLabel: String {
        switch healthSeverity {
        case .healthy: "Healthy"
        case .attention: "Needs attention"
        case .critical: "Critical"
        }
    }

    var kioskFleetCounts: KioskFleetCounts {
        KioskFleetCounts(devices: monitoredKioskDevices)
    }

    var monitoredKioskDevices: [KioskDevice] {
        let now = Date.now
        return kioskDevices
            .filter(\.isIncludedInMonitoring)
            .sorted { lhs, rhs in
                let lhsPriority = Self.monitoringPriority(for: lhs.connectionState(at: now))
                let rhsPriority = Self.monitoringPriority(for: rhs.connectionState(at: now))
                if lhsPriority != rhsPriority { return lhsPriority < rhsPriority }

                let lhsLastSeen = lhs.lastSeenAt ?? .distantPast
                let rhsLastSeen = rhs.lastSeenAt ?? .distantPast
                if lhsLastSeen != rhsLastSeen { return lhsLastSeen < rhsLastSeen }
                let nameOrder = lhs.name.localizedCaseInsensitiveCompare(rhs.name)
                return nameOrder == .orderedSame ? lhs.id < rhs.id : nameOrder == .orderedAscending
            }
    }

    func pendingPickupBookings(at now: Date = .now) -> [BookingActivitySnapshot] {
        activeBookingActivity.filter { $0.isWaitingForPickup(at: now) }
    }

    /// Restore reads the external companion projection after loading the local
    /// enrollment. The projection endpoint is Upstash-only and cannot wake a
    /// suspended Neon compute.
    func restoreSession() async {
        isRestoring = true
        defer { isRestoring = false }

        guard user != nil else { return }
        let generation = sessionGeneration
        do {
            guard let token = try await credentialStore.loadToken() else {
                guard generation == sessionGeneration, user != nil else { return }
                sessionGeneration &+= 1
                clearAuthenticatedState()
                statusMessage = "Sign in to enable automatic updates."
                return
            }
            guard generation == sessionGeneration, user != nil else { return }
            companionToken = token
            registeredDeviceCredential = nil
            await bookingNotifications.requestAuthorization()
            guard sessionIsCurrent(generation: generation, token: token) else { return }
            await registerCurrentDeviceToken(expectedGeneration: generation)
            guard sessionIsCurrent(generation: generation, token: token) else { return }
            await refresh()
        } catch {
            guard generation == sessionGeneration, user != nil else { return }
            companionToken = nil
            statusMessage = "Secure credential access is unavailable. Showing the last confirmed data."
        }
    }

    func signIn(email: String, password: String) async {
        guard !isSigningIn, !isSigningOut else { return }
        let generation = sessionGeneration
        isSigningIn = true
        statusMessage = nil
        defer {
            if generation == sessionGeneration {
                isSigningIn = false
            }
        }

        do {
            let response = try await client.login(email: email, password: password)
            guard generation == sessionGeneration else { return }
            guard !response.user.forcePasswordChange else {
                clearAuthenticatedState()
                statusMessage = "Open Gear Tracker in your browser to change your password."
                return
            }
            try await credentialStore.saveToken(response.companionToken)
            guard generation == sessionGeneration else { return }
            user = response.user
            companionToken = response.companionToken
            registeredDeviceCredential = nil
            await install(
                response.companionProjection,
                deliverNotifications: false,
                expectedGeneration: generation
            )
            guard sessionIsCurrent(generation: generation, token: response.companionToken) else { return }
            await bookingNotifications.requestAuthorization()
            guard sessionIsCurrent(generation: generation, token: response.companionToken) else { return }
            await registerCurrentDeviceToken(expectedGeneration: generation)
        } catch {
            guard generation == sessionGeneration else { return }
            statusMessage = error.localizedDescription
        }
    }

    func signOut(message: String? = nil) async {
        guard !isSigningOut else { return }
        let tokenToRevoke = companionToken
        sessionGeneration &+= 1
        isSigningOut = true
        isSigningIn = false
        isRefreshing = false
        refreshQueued = false
        clearAuthenticatedState()
        statusMessage = message
        var credentialRemovalFailed = false
        do {
            try await credentialStore.deleteToken()
        } catch {
            credentialRemovalFailed = true
        }

        if let tokenToRevoke {
            await client.revokeCompanion(credential: tokenToRevoke)
        }

        if credentialRemovalFailed {
            do {
                try await credentialStore.deleteToken()
                credentialRemovalFailed = false
            } catch {
                // Keep local operational data cleared and surface that secure
                // credential removal still needs attention.
            }
        }
        isSigningOut = false
        if credentialRemovalFailed {
            let prefix = message.map { "\($0) " } ?? "Signed out locally. "
            statusMessage = prefix + "The saved companion credential could not be removed. Quit and try again."
        }
    }

    /// Every post-enrollment refresh reads only the external Upstash projection.
    /// Failure preserves the last trusted local snapshot.
    func refresh() async {
        guard user != nil, let companionToken else { return }
        if isRefreshing {
            refreshQueued = true
            return
        }
        let generation = sessionGeneration
        isRefreshing = true
        defer {
            if generation == sessionGeneration {
                isRefreshing = false
            }
        }

        repeat {
            refreshQueued = false
            do {
                let projection = try await client.companionProjection(token: companionToken)
                guard sessionIsCurrent(generation: generation, token: companionToken) else { return }

                if installedProjection == projection {
                    statusMessage = nil
                    await registerCurrentDeviceToken(expectedGeneration: generation)
                } else {
                    await install(
                        projection,
                        deliverNotifications: true,
                        expectedGeneration: generation
                    )
                    guard sessionIsCurrent(generation: generation, token: companionToken) else { return }
                    await registerCurrentDeviceToken(expectedGeneration: generation)
                }
            } catch GearOpsClientError.unauthorized {
                guard sessionIsCurrent(generation: generation, token: companionToken) else { return }
                await signOut(message: "Companion enrollment expired. Sign in again.")
                return
            } catch {
                guard sessionIsCurrent(generation: generation, token: companionToken) else { return }
                statusMessage = "Updates are unavailable. Showing the last confirmed data."
            }
        } while refreshQueued && sessionIsCurrent(generation: generation, token: companionToken)
    }

    func openDashboard() {
        open(path: "/")
    }

    func openCheckouts() {
        open(path: "/bookings?tab=checkouts&status=OPEN")
    }

    func openBooking(_ booking: OpenBooking) {
        open(path: "/bookings?tab=checkouts&highlight=\(booking.id)")
    }

    func openBooking(_ booking: BookingActivitySnapshot) {
        guard let url = BookingDeepLink.bookingURL(id: booking.id, kind: booking.kind) else { return }
        open(url: url)
    }

    func openPendingPickups() {
        guard let url = BookingDeepLink.pendingPickupsURL else { return }
        open(url: url)
    }

    func openKioskDevices() {
        open(path: "/settings/kiosk-devices")
    }

    func quit() {
        NSApplication.shared.terminate(nil)
    }

    private func open(path: String) {
        guard let url = URL(string: path, relativeTo: GearOpsClient.canonicalBaseURL)?.absoluteURL else { return }
        open(url: url)
    }

    private func open(url: URL) {
        NSWorkspace.shared.open(url)
    }

    private func startObservingPushEvents() {
        pushTask = Task { [weak self] in
            for await event in CompanionPushBridge.shared.events {
                guard !Task.isCancelled else { return }
                switch event {
                case .deviceToken(let token):
                    await self?.receiveDeviceToken(token)
                case .projectionChanged:
                    await self?.refresh()
                }
            }
        }
    }

    /// APNs is the fast path. This bounded poll is the reliability backstop for
    /// unsigned development builds, missed pushes, and transient registration
    /// failures. It reads only the external projection cache.
    private func startAutomaticRefresh() {
        automaticRefreshTask = Task { [weak self] in
            await self?.restoreSession()

            while !Task.isCancelled {
                do {
                    try await Task.sleep(for: .seconds(60))
                } catch {
                    return
                }
                guard !Task.isCancelled else { return }
                if let self, self.user != nil, self.companionToken == nil {
                    await self.restoreSession()
                } else {
                    await self?.refresh()
                }
            }
        }
    }

    func receiveDeviceToken(_ token: String) async {
        if currentDeviceToken != token {
            registeredDeviceCredential = nil
        }
        currentDeviceToken = token
        await registerCurrentDeviceToken(expectedGeneration: sessionGeneration)
    }

    private func registerCurrentDeviceToken(expectedGeneration: UInt64) async {
        guard expectedGeneration == sessionGeneration,
              let currentDeviceToken,
              let companionToken,
              registeredDeviceCredential != companionToken else { return }
        do {
            try await client.registerCompanionDevice(currentDeviceToken, credential: companionToken)
            guard sessionIsCurrent(generation: expectedGeneration, token: companionToken),
                  self.currentDeviceToken == currentDeviceToken else { return }
            registeredDeviceCredential = companionToken
        } catch {
            // APNs registration is supplementary. Retain the current token and
            // retry after the next successful projection refresh or enrollment.
        }
    }

    private func install(
        _ projection: CompanionProjection,
        deliverNotifications: Bool,
        expectedGeneration: UInt64
    ) async {
        guard expectedGeneration == sessionGeneration else { return }
        let previousActivity = knownBookingActivity
        let sortedActivity = projection.bookingActivity.sorted(using: KeyPathComparator(\.startsAt))

        snapshot = GearOpsSnapshot(
            stats: projection.stats,
            pendingPickupTotal: projection.pendingPickupTotal,
            receivedAt: projection.generatedAt,
            partialFailures: []
        )
        openBookings = projection.openBookings
        openBookingTotal = projection.openBookings.count
        activeBookingActivity = sortedActivity
        kioskDevices = projection.kioskDevices
        kioskAccess = KioskAccessState(rawValue: projection.kioskAccess) ?? .failed
        installedProjection = projection
        countDataIsPartial = false
        statusMessage = nil

        knownBookingActivity = Dictionary(uniqueKeysWithValues: sortedActivity.map { ($0.id, $0) })
        persistCache()

        if deliverNotifications {
            let changes = sortedActivity
                .filter({ previousActivity[$0.id] != $0 })
                .sorted(by: { $0.updatedAt < $1.updatedAt })
                .compactMap { current in
                    BookingChangeDetector.change(
                        from: previousActivity[current.id],
                        to: current
                    )
                }
            for change in changes {
                guard expectedGeneration == sessionGeneration else { return }
                await bookingNotifications.deliver(change)
            }
        }
    }

    private func persistCache() {
        guard let user else { return }
        let cached = GearOpsCachedState(
            user: user,
            snapshot: snapshot,
            openBookings: openBookings,
            openBookingTotal: openBookingTotal,
            activeBookingActivity: activeBookingActivity,
            kioskDevices: kioskDevices,
            kioskAccess: kioskAccess
        )
        guard let data = try? JSONEncoder().encode(cached) else { return }
        defaults.set(data, forKey: Self.cacheKey)
    }

    private func clearAuthenticatedState() {
        companionToken = nil
        user = nil
        snapshot = nil
        openBookings = []
        openBookingTotal = nil
        activeBookingActivity = []
        kioskDevices = []
        kioskAccess = .unknown
        knownBookingActivity = [:]
        installedProjection = nil
        refreshQueued = false
        registeredDeviceCredential = nil
        countDataIsPartial = false
        defaults.removeObject(forKey: Self.cacheKey)
    }

    private func sessionIsCurrent(generation: UInt64, token: String) -> Bool {
        generation == sessionGeneration && companionToken == token && user != nil
    }

    private static func monitoringPriority(for state: KioskConnectionState) -> Int {
        switch state {
        case .offline: 0
        case .stale: 1
        case .online: 2
        case .inactive: 3
        }
    }
}
