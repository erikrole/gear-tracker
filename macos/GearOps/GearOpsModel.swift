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
    private var pendingDeviceToken: String?
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
        switch healthSeverity {
        case .healthy: "shippingbox.fill"
        case .attention: "shippingbox.and.arrow.backward.fill"
        case .critical: "shippingbox.trianglebadge.exclamationmark.fill"
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
        kioskDevices.filter(\.isIncludedInMonitoring)
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
        guard let token = await credentialStore.loadToken() else {
            clearAuthenticatedState()
            statusMessage = "Sign in to enable automatic updates."
            return
        }
        companionToken = token
        await bookingNotifications.requestAuthorization()
        await registerPendingDeviceToken()
        await refresh()
    }

    func signIn(email: String, password: String) async {
        guard !isSigningIn else { return }
        isSigningIn = true
        statusMessage = nil
        defer { isSigningIn = false }

        do {
            let response = try await client.login(email: email, password: password)
            guard !response.user.forcePasswordChange else {
                clearAuthenticatedState()
                statusMessage = "Open Gear Tracker in your browser to change your password."
                return
            }
            try await credentialStore.saveToken(response.companionToken)
            user = response.user
            companionToken = response.companionToken
            await install(response.companionProjection, deliverNotifications: false)
            await bookingNotifications.requestAuthorization()
            await registerPendingDeviceToken()
        } catch {
            statusMessage = error.localizedDescription
        }
    }

    func signOut(message: String? = nil) async {
        if let companionToken {
            await client.revokeCompanion(credential: companionToken)
        }
        await credentialStore.deleteToken()
        clearAuthenticatedState()
        statusMessage = message
    }

    /// Automatic refreshes read only Upstash. An explicit user refresh may
    /// rebuild the projection from source. Failure preserves the trusted local
    /// snapshot in either case.
    func refresh(fromSource: Bool = false) async {
        guard user != nil, let companionToken, !isRefreshing else { return }
        isRefreshing = true
        defer { isRefreshing = false }

        do {
            let projection = try await client.companionProjection(
                token: companionToken,
                refreshFromSource: fromSource
            )
            await install(projection, deliverNotifications: true)
        } catch GearOpsClientError.unauthorized {
            await credentialStore.deleteToken()
            clearAuthenticatedState()
            statusMessage = "Companion enrollment expired. Sign in again."
        } catch {
            statusMessage = "Automatic updates are unavailable. Showing the last confirmed data."
        }
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

    func openBooking(id: String) {
        open(path: "/bookings?highlight=\(id)")
    }

    func openPendingPickups() {
        open(path: "/bookings?status=PENDING_PICKUP")
    }

    func openKioskDevices() {
        open(path: "/settings/kiosk-devices")
    }

    func quit() {
        NSApplication.shared.terminate(nil)
    }

    private func open(path: String) {
        guard let url = URL(string: path, relativeTo: GearOpsClient.canonicalBaseURL)?.absoluteURL else { return }
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
                await self?.refresh()
            }
        }
    }

    private func receiveDeviceToken(_ token: String) async {
        pendingDeviceToken = token
        await registerPendingDeviceToken()
    }

    private func registerPendingDeviceToken() async {
        guard let pendingDeviceToken, let companionToken else { return }
        do {
            try await client.registerCompanionDevice(pendingDeviceToken, credential: companionToken)
            self.pendingDeviceToken = nil
        } catch {
            // APNs registration is supplementary. Keep the token in memory and
            // retry after the next successful enrollment or APNs callback.
        }
    }

    private func install(
        _ projection: CompanionProjection,
        deliverNotifications: Bool
    ) async {
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
        countDataIsPartial = false
        statusMessage = nil

        if deliverNotifications {
            for current in sortedActivity
                .filter({ previousActivity[$0.id] != $0 })
                .sorted(by: { $0.updatedAt < $1.updatedAt }) {
                let change = BookingChangeDetector.change(
                    from: previousActivity[current.id],
                    to: current
                )
                await bookingNotifications.deliver(change)
            }
        }

        knownBookingActivity = Dictionary(uniqueKeysWithValues: sortedActivity.map { ($0.id, $0) })
        persistCache()
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
        countDataIsPartial = false
        defaults.removeObject(forKey: Self.cacheKey)
    }
}
