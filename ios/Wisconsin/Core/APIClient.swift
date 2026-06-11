import Foundation

enum APIError: LocalizedError {
    case unauthorized
    case notFound
    case serverError(String)
    case decodingError(Error)
    case networkError(Error)

    var errorDescription: String? {
        switch self {
        case .unauthorized: "Your session has expired. Please sign in again."
        case .notFound: "The requested item could not be found."
        case .serverError(let msg): msg
        case .decodingError: "Unexpected response from server."
        case .networkError(let err): Self.humanize(err)
        }
    }

    private static func humanize(_ error: Error) -> String {
        let code = (error as? URLError)?.code
        switch code {
        case .notConnectedToInternet, .networkConnectionLost: return "No internet connection. Check your network and try again."
        case .timedOut: return "Request timed out. Try again in a moment."
        case .cannotFindHost, .cannotConnectToHost, .dnsLookupFailed: return "Couldn't reach the server. Try again shortly."
        case .cancelled: return "Request was cancelled."
        default: return "Network error. Check your connection and try again."
        }
    }
}

struct BulkReservationRequest: Encodable, Equatable {
    let bulkSkuId: String
    let quantity: Int
}

extension Notification.Name {
    /// Fired when any API call returns 401. SessionStore listens and clears
    /// `currentUser`, which lets RootView swap to LoginView automatically —
    /// no per-VM "Session expired" string needed.
    static let sessionDidExpire = Notification.Name("WisconsinSessionDidExpire")
}

@MainActor
final class APIClient {
    static let shared = APIClient()

    private let baseURL = URL(string: "https://gear.erikrole.com")!

    private let session: URLSession = {
        let config = URLSessionConfiguration.default
        config.httpCookieStorage = HTTPCookieStorage.shared
        config.httpShouldSetCookies = true
        config.httpCookieAcceptPolicy = .always
        config.waitsForConnectivity = false
        config.timeoutIntervalForRequest = 15
        config.timeoutIntervalForResource = 30
        config.multipathServiceType = .none
        return URLSession(configuration: config)
    }()

    private let decoder: JSONDecoder = {
        let d = JSONDecoder()
        d.keyDecodingStrategy = .convertFromSnakeCase
        d.dateDecodingStrategy = .iso8601
        return d
    }()

    // MARK: - Auth

    func login(email: String, password: String) async throws -> CurrentUser {
        struct Body: Encodable {
            let email: String
            let password: String
            let rememberMe: Bool
        }
        var req = request(path: "/api/auth/login", method: "POST")
        req.httpBody = try JSONEncoder().encode(Body(email: email, password: password, rememberMe: true))
        let resp: LoginResponse = try await perform(req)
        return resp.user
    }

    func logout() async throws {
        let req = request(path: "/api/auth/logout", method: "POST")
        // Best-effort server logout: local cookie clearing below must still run
        // if the network is down or the server session is already gone.
        _ = try? await session.data(for: req)
        HTTPCookieStorage.shared.removeCookies(since: .distantPast)
    }

    func registerDeviceToken(_ hexToken: String) async throws {
        struct Body: Encodable { let token: String; let platform: String; let appVersion: String? }
        var req = request(path: "/api/devices", method: "POST")
        let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String
        req.httpBody = try JSONEncoder().encode(Body(token: hexToken, platform: "IOS", appVersion: version))
        let _: SuccessResponse = try await perform(req)
    }

    func revokeAllDeviceTokens() async throws {
        let req = request(path: "/api/devices", method: "DELETE")
        let _: SuccessResponse = try await perform(req)
    }

    func me() async throws -> CurrentUser {
        let req = request(path: "/api/me")
        let resp: MeResponse = try await perform(req)
        return resp.user
    }

    func changePassword(currentPassword: String, newPassword: String, revokeOtherSessions: Bool = true) async throws {
        struct Body: Encodable {
            let currentPassword: String
            let newPassword: String
            let revokeOtherSessions: Bool
        }

        var req = request(path: "/api/me/change-password", method: "POST")
        req.httpBody = try JSONEncoder().encode(Body(
            currentPassword: currentPassword,
            newPassword: newPassword,
            revokeOtherSessions: revokeOtherSessions
        ))
        let _: ChangePasswordResponse = try await perform(req)
    }

    // MARK: - Bookings

    func reservations(activeOnly: Bool = true, search: String? = nil, requesterId: String? = nil, limit: Int = 30, offset: Int = 0) async throws -> PaginatedResponse<Booking> {
        try await perform(bookingListRequest(path: "/api/reservations", active: activeOnly, status: nil, statusList: nil, search: search, requesterId: requesterId, limit: limit, offset: offset))
    }

    func checkouts(activeOnly: Bool = true, search: String? = nil, requesterId: String? = nil, limit: Int = 30, offset: Int = 0) async throws -> PaginatedResponse<Booking> {
        try await perform(bookingListRequest(
            path: "/api/checkouts",
            active: false,
            status: nil,
            statusList: activeOnly ? [.open, .pendingPickup] : nil,
            search: search,
            requesterId: requesterId,
            limit: limit,
            offset: offset
        ))
    }

    private func bookingListRequest(path: String, active: Bool, status: BookingStatus?, statusList: [BookingStatus]?, search: String?, requesterId: String?, limit: Int, offset: Int) -> URLRequest {
        var items: [URLQueryItem] = [
            .init(name: "limit", value: "\(limit)"),
            .init(name: "offset", value: "\(offset)"),
        ]
        if active { items.append(.init(name: "active", value: "true")) }
        if let status { items.append(.init(name: "status", value: status.rawValue)) }
        if let statusList, !statusList.isEmpty {
            items.append(.init(name: "status_in", value: statusList.map(\.rawValue).joined(separator: ",")))
        }
        if let search, !search.isEmpty { items.append(.init(name: "q", value: search)) }
        if let requesterId, !requesterId.isEmpty { items.append(.init(name: "requester_id", value: requesterId)) }
        return request(path: path, queryItems: items)
    }

    func booking(id: String) async throws -> Booking {
        let req = request(path: "/api/bookings/\(id)")
        let resp: DataWrapper<Booking> = try await perform(req)
        return resp.data
    }

    func cancelBooking(id: String) async throws {
        let req = request(path: "/api/bookings/\(id)/cancel", method: "POST")
        let (data, response) = try await session.data(for: req)
        if let http = response as? HTTPURLResponse, !(200...299).contains(http.statusCode) {
            if http.statusCode == 401 { NotificationCenter.default.post(name: .sessionDidExpire, object: nil); throw APIError.unauthorized }
            let msg = (try? JSONDecoder().decode(ServerErrorBody.self, from: data))?.error ?? "Cancel failed"
            throw APIError.serverError(msg)
        }
    }

    func updateAssetQR(id: String, qrCodeValue: String) async throws {
        struct Body: Encodable { let qrCodeValue: String }
        var req = request(path: "/api/assets/\(id)", method: "PATCH")
        req.httpBody = try JSONEncoder().encode(Body(qrCodeValue: qrCodeValue))
        let (data, response) = try await session.data(for: req)
        if let http = response as? HTTPURLResponse, !(200...299).contains(http.statusCode) {
            if http.statusCode == 401 { NotificationCenter.default.post(name: .sessionDidExpire, object: nil); throw APIError.unauthorized }
            let msg = (try? JSONDecoder().decode(ServerErrorBody.self, from: data))?.error ?? "Update failed"
            throw APIError.serverError(msg)
        }
    }

    func updateAsset(id: String, name: String? = nil, serialNumber: String? = nil, notes: String? = nil) async throws {
        struct Body: Encodable {
            let name: String?
            let serialNumber: String?
            let notes: String?
        }
        var req = request(path: "/api/assets/\(id)", method: "PATCH")
        req.httpBody = try JSONEncoder().encode(Body(name: name, serialNumber: serialNumber, notes: notes))
        let (data, response) = try await session.data(for: req)
        if let http = response as? HTTPURLResponse, !(200...299).contains(http.statusCode) {
            if http.statusCode == 401 { NotificationCenter.default.post(name: .sessionDidExpire, object: nil); throw APIError.unauthorized }
            let msg = (try? JSONDecoder().decode(ServerErrorBody.self, from: data))?.error ?? "Update failed"
            throw APIError.serverError(msg)
        }
    }

    func updateBooking(id: String, title: String? = nil, notes: String? = nil, startsAt: Date? = nil, endsAt: Date? = nil, updatedAt: Date? = nil) async throws {
        struct Body: Encodable {
            let title: String?
            let notes: String?
            let startsAt: String?
            let endsAt: String?
        }
        var req = request(path: "/api/bookings/\(id)", method: "PATCH")
        if let updatedAt {
            req.setValue(httpDateString(updatedAt), forHTTPHeaderField: "If-Unmodified-Since")
        }
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        req.httpBody = try JSONEncoder().encode(Body(
            title: title,
            notes: notes,
            startsAt: startsAt.map { iso.string(from: $0) },
            endsAt: endsAt.map { iso.string(from: $0) }
        ))
        let (data, response) = try await session.data(for: req)
        if let http = response as? HTTPURLResponse, !(200...299).contains(http.statusCode) {
            if http.statusCode == 401 { NotificationCenter.default.post(name: .sessionDidExpire, object: nil); throw APIError.unauthorized }
            let msg = (try? JSONDecoder().decode(ServerErrorBody.self, from: data))?.error ?? "Update failed"
            throw APIError.serverError(msg)
        }
    }

    func checkinItems(bookingId: String, assetIds: [String]) async throws {
        struct Body: Encodable { let assetIds: [String] }
        var req = request(path: "/api/checkouts/\(bookingId)/checkin-items", method: "POST")
        req.httpBody = try JSONEncoder().encode(Body(assetIds: assetIds))
        let (data, response) = try await session.data(for: req)
        if let http = response as? HTTPURLResponse, !(200...299).contains(http.statusCode) {
            if http.statusCode == 401 { NotificationCenter.default.post(name: .sessionDidExpire, object: nil); throw APIError.unauthorized }
            let msg = (try? JSONDecoder().decode(ServerErrorBody.self, from: data))?.error ?? "Check-in failed"
            throw APIError.serverError(msg)
        }
    }

    func extendBooking(id: String, endsAt: Date) async throws {
        struct Body: Encodable { let endsAt: String }
        var req = request(path: "/api/bookings/\(id)/extend", method: "POST")
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        req.httpBody = try JSONEncoder().encode(Body(endsAt: iso.string(from: endsAt)))
        let (data, response) = try await session.data(for: req)
        if let http = response as? HTTPURLResponse, !(200...299).contains(http.statusCode) {
            if http.statusCode == 401 { NotificationCenter.default.post(name: .sessionDidExpire, object: nil); throw APIError.unauthorized }
            let msg = (try? JSONDecoder().decode(ServerErrorBody.self, from: data))?.error ?? "Extend failed"
            throw APIError.serverError(msg)
        }
    }

    func createReservation(
        title: String,
        requesterUserId: String,
        locationId: String,
        startsAt: Date,
        endsAt: Date,
        notes: String?,
        eventId: String? = nil,
        shiftAssignmentId: String? = nil,
        serializedAssetIds: [String] = [],
        bulkItems: [BulkReservationRequest] = []
    ) async throws -> String {
        struct Body: Encodable {
            let title: String
            let requesterUserId: String
            let locationId: String
            let startsAt: String
            let endsAt: String
            let notes: String?
            let serializedAssetIds: [String]
            let bulkItems: [BulkReservationRequest]
            let eventId: String?
            let shiftAssignmentId: String?
        }
        var req = request(path: "/api/reservations", method: "POST")
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        req.httpBody = try JSONEncoder().encode(Body(
            title: title,
            requesterUserId: requesterUserId,
            locationId: locationId,
            startsAt: iso.string(from: startsAt),
            endsAt: iso.string(from: endsAt),
            notes: notes?.isEmpty == true ? nil : notes,
            serializedAssetIds: serializedAssetIds,
            bulkItems: bulkItems,
            eventId: eventId,
            shiftAssignmentId: shiftAssignmentId
        ))
        let resp: DataWrapper<BookingStub> = try await perform(req)
        return resp.data.id
    }

    /// Returns scheduling conflicts keyed by asset ID for the given window, or an
    /// empty map on network/decode failure — callers treat this as a non-blocking
    /// hint (server enforcement at create/checkout is authoritative).
    ///
    /// `locationId` is required by the server schema; omitting it (or sending the
    /// wrong key) returns a 400 the caller never sees, so the map silently stays
    /// empty. Pass `excludeBookingId` so an existing booking does not conflict
    /// with itself.
    func checkAvailability(
        locationId: String,
        serializedAssetIds: [String],
        startsAt: Date,
        endsAt: Date,
        excludeBookingId: String? = nil
    ) async -> [String: AssetConflict] {
        guard !serializedAssetIds.isEmpty, !locationId.isEmpty else { return [:] }
        struct Body: Encodable {
            let locationId: String
            let serializedAssetIds: [String]
            let startsAt: String
            let endsAt: String
            let excludeBookingId: String?
        }
        // The server returns the availability result at the TOP level
        // (`{ conflicts, shortages, ... }`), not wrapped in `{ data: ... }`.
        // Decoding a `data` envelope here silently empties the conflict map
        // (this call swallows decode failures by design).
        struct CheckResponse: Decodable { let conflicts: [AssetConflict]? }

        var req = request(path: "/api/availability/check", method: "POST")
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        guard let body = try? JSONEncoder().encode(Body(
            locationId: locationId,
            serializedAssetIds: serializedAssetIds,
            startsAt: iso.string(from: startsAt),
            endsAt: iso.string(from: endsAt),
            excludeBookingId: excludeBookingId
        )) else { return [:] }
        req.httpBody = body
        // non-blocking advisory: server enforcement at create/checkout is authoritative,
        // so non-401 failures return an empty hint map.
        guard let (data, response) = try? await session.data(for: req),
              let http = response as? HTTPURLResponse else { return [:] }
        // Hint-style call, but a swallowed 401 hides an expired session until the
        // next mutation (IOS_PATTERNS R3 / the kioskHeartbeat P0). Broadcast it.
        if http.statusCode == 401 {
            NotificationCenter.default.post(name: .sessionDidExpire, object: nil)
            return [:]
        }
        guard (200...299).contains(http.statusCode),
              let resp = try? decoder.decode(CheckResponse.self, from: data) else { return [:] }
        var map: [String: AssetConflict] = [:]
        for conflict in resp.conflicts ?? [] { map[conflict.assetId] = conflict }
        return map
    }

    /// Availability conflicts for a shift, keyed by userId → human note (e.g.
    /// "Conflicts with class 14:00–15:00"). Non-blocking hint for the assign
    /// picker — empty on failure so the picker still works; broadcasts 401 so a
    /// swallowed expired session can't hide here (IOS_PATTERNS R3).
    func shiftConflicts(shiftId: String) async -> [String: String] {
        let req = request(path: "/api/shifts/\(shiftId)/conflicts")
        // Non-blocking hint: a swallowed expired session can't hide here.
        guard let (data, response) = try? await session.data(for: req),
              let http = response as? HTTPURLResponse else { return [:] }
        if http.statusCode == 401 {
            NotificationCenter.default.post(name: .sessionDidExpire, object: nil)
            return [:]
        }
        struct ConflictResponse: Decodable { let data: [String: String] }
        guard (200...299).contains(http.statusCode),
              let resp = try? decoder.decode(ConflictResponse.self, from: data) else { return [:] }
        return resp.data
    }

    // MARK: - Availability blocks

    func availabilityBlocks(userId: String) async throws -> [AvailabilityBlock] {
        let req = request(path: "/api/users/\(userId)/availability")
        let resp: AvailabilityBlocksResponse = try await perform(req)
        return resp.data
    }

    func createAvailabilityBlock(
        userId: String,
        dayOfWeek: Int,
        startsAt: String,
        endsAt: String,
        label: String?
    ) async throws -> AvailabilityBlock {
        struct Body: Encodable {
            let dayOfWeek: Int
            let startsAt: String
            let endsAt: String
            let label: String?
        }
        var req = request(path: "/api/users/\(userId)/availability", method: "POST")
        req.httpBody = try JSONEncoder().encode(Body(dayOfWeek: dayOfWeek, startsAt: startsAt, endsAt: endsAt, label: label))
        let resp: DataWrapper<AvailabilityBlock> = try await perform(req)
        return resp.data
    }

    func deleteAvailabilityBlock(userId: String, blockId: String) async throws {
        let req = request(path: "/api/users/\(userId)/availability/\(blockId)", method: "DELETE")
        let (data, response) = try await session.data(for: req)
        if let http = response as? HTTPURLResponse, !(200...299).contains(http.statusCode) {
            if http.statusCode == 401 { NotificationCenter.default.post(name: .sessionDidExpire, object: nil); throw APIError.unauthorized }
            let msg = (try? JSONDecoder().decode(ServerErrorBody.self, from: data))?.error ?? "Couldn't remove block"
            throw APIError.serverError(msg)
        }
    }

    func formOptions() async throws -> FormOptions {
        let req = request(path: "/api/form-options")
        let resp: DataWrapper<FormOptions> = try await perform(req)
        return resp.data
    }

    // MARK: - Dashboard

    func dashboard() async throws -> DashboardData {
        let req = request(path: "/api/dashboard")
        let resp: DataWrapper<DashboardData> = try await perform(req)
        return resp.data
    }

    /// Lightweight stats-only fetch for badge refresh. Avoids the heavy
    /// `/api/dashboard` payload when only counters and role are needed.
    func dashboardStats() async throws -> DashboardStatsPayload {
        let req = request(path: "/api/dashboard/stats")
        let resp: DataWrapper<DashboardStatsPayload> = try await perform(req)
        return resp.data
    }

    // MARK: - Reports

    /// `/api/reports/overdue` returns the report shape directly (no `data` envelope).
    func overdueReport() async throws -> OverdueReport {
        let req = request(path: "/api/reports/overdue")
        return try await perform(req)
    }

    // MARK: - Assets

    func assets(
        search: String? = nil,
        qr: String? = nil,
        statuses: Set<AssetComputedStatus> = [],
        categoryId: String? = nil,
        favoritesOnly: Bool = false,
        limit: Int = 30,
        offset: Int = 0
    ) async throws -> AssetsResponse {
        var items: [URLQueryItem] = [
            .init(name: "limit", value: "\(limit)"),
            .init(name: "offset", value: "\(offset)"),
        ]
        if let search, !search.isEmpty { items.append(.init(name: "q", value: search)) }
        if let qr, !qr.isEmpty { items.append(.init(name: "qr", value: qr)) }
        for status in statuses {
            items.append(.init(name: "status", value: status.rawValue))
        }
        if let categoryId { items.append(.init(name: "category_id", value: categoryId)) }
        if favoritesOnly { items.append(.init(name: "favorites_only", value: "true")) }
        return try await perform(request(path: "/api/assets", queryItems: items))
    }

    func asset(id: String) async throws -> AssetDetail {
        let req = request(path: "/api/assets/\(id)")
        let resp: DataWrapper<AssetDetail> = try await perform(req)
        return resp.data
    }

    func assetsLookup(rawScan: String) async throws -> String? {
        // Old kiosk QR codes encoded the asset's CUID as bg://item/{id}.
        // Try direct ID lookup first; if 404, fall through to the qrCodeValue
        // search below (which handles bg://item/{assetTag} stored verbatim).
        if rawScan.hasPrefix("bg://item/") {
            let embedded = String(rawScan.dropFirst("bg://item/".count))
            if !embedded.isEmpty {
                do {
                    return try await asset(id: embedded).id
                } catch APIError.notFound {
                    // Not a raw CUID — fall through to qrCodeValue search
                }
            }
        }

        // Pass the full raw scan as ?qr= so the server can do exact qrCodeValue
        // matches (e.g. bg://item/FB FX3 2, QR-CA083A13, ca083a13).
        // Strip URL-scheme prefixes only for the ?q= general-text search.
        let stripped = rawScan
            .replacingOccurrences(of: "bg://item/", with: "")
            .replacingOccurrences(of: "bg://case/", with: "")
        let req = request(path: "/api/assets", queryItems: [
            .init(name: "q", value: stripped),
            .init(name: "qr", value: rawScan),
            .init(name: "limit", value: "5"),
        ])
        let resp: AssetsResponse = try await perform(req)
        return resp.data.first?.id
    }

    func assetByQR(qrValue: String) async throws -> Asset? {
        let req = request(path: "/api/assets", queryItems: [
            .init(name: "qr", value: qrValue),
            .init(name: "limit", value: "1"),
        ])
        let resp: AssetsResponse = try await perform(req)
        return resp.data.first
    }

    // MARK: - Users

    func users(
        search: String? = nil,
        role: String? = nil,
        includeInactive: Bool = false,
        limit: Int = 50,
        offset: Int = 0
    ) async throws -> PaginatedResponse<AppUser> {
        var items: [URLQueryItem] = [
            .init(name: "limit", value: "\(limit)"),
            .init(name: "offset", value: "\(offset)"),
        ]
        if let search, !search.isEmpty { items.append(.init(name: "q", value: search)) }
        if let role, !role.isEmpty { items.append(.init(name: "role", value: role)) }
        if includeInactive { items.append(.init(name: "active", value: "all")) }
        return try await perform(request(path: "/api/users", queryItems: items))
    }

    func user(id: String) async throws -> AppUserDetail {
        let req = request(path: "/api/users/\(id)")
        let resp: DataWrapper<AppUserDetail> = try await perform(req)
        return resp.data
    }

    func userBadgeProfile(userId: String) async throws -> BadgeProfile {
        let req = request(path: "/api/badges/user/\(userId)")
        let resp: DataWrapper<BadgeProfile> = try await perform(req)
        return resp.data
    }

    func reservationsByUser(userId: String, limit: Int = 10) async throws -> PaginatedResponse<Booking> {
        try await perform(request(path: "/api/reservations", queryItems: [
            .init(name: "requester_id", value: userId),
            .init(name: "limit", value: "\(limit)"),
            .init(name: "offset", value: "0"),
        ]))
    }

    func checkoutsByUser(userId: String, limit: Int = 10) async throws -> PaginatedResponse<Booking> {
        try await perform(request(path: "/api/checkouts", queryItems: [
            .init(name: "requester_id", value: userId),
            .init(name: "limit", value: "\(limit)"),
            .init(name: "offset", value: "0"),
        ]))
    }

    // MARK: - Schedule

    func calendarEvents(
        includePast: Bool = false,
        limit: Int = 60
    ) async throws -> [ScheduleEvent] {
        var items: [URLQueryItem] = [
            .init(name: "limit", value: "\(limit)"),
            .init(name: "offset", value: "0"),
        ]
        if includePast { items.append(.init(name: "includePast", value: "true")) }
        let resp: ScheduleEventsResponse = try await perform(request(path: "/api/calendar-events", queryItems: items))
        return resp.data
    }

    func shiftGroup(eventId: String) async throws -> EventShiftGroup? {
        let req = request(path: "/api/shift-groups", queryItems: [
            .init(name: "eventId", value: eventId),
            .init(name: "limit", value: "1"),
        ])
        let resp: ShiftGroupsResponse = try await perform(req)
        return resp.data.first
    }

    /// Creates a new shift group for an event (STAFF/ADMIN).
    func createShiftGroup(eventId: String) async throws -> EventShiftGroup {
        struct Body: Encodable { let eventId: String }
        var req = request(path: "/api/shift-groups", method: "POST")
        req.httpBody = try JSONEncoder().encode(Body(eventId: eventId))
        struct Resp: Decodable { let data: EventShiftGroup }
        let resp: Resp = try await perform(req)
        return resp.data
    }

    func myShifts(limit: Int = 20) async throws -> [MyShift] {
        let req = request(path: "/api/my-shifts", queryItems: [.init(name: "limit", value: "\(limit)")])
        let resp: MyShiftsResponse = try await perform(req)
        return resp.data
    }

    // MARK: - Favorites

    @discardableResult
    func toggleFavorite(assetId: String) async throws -> Bool {
        struct Response: Decodable { let favorited: Bool }
        let req = request(path: "/api/assets/\(assetId)/favorite", method: "POST")
        let resp: Response = try await perform(req)
        return resp.favorited
    }

    // MARK: - Notifications

    func notifications(unreadOnly: Bool = false, limit: Int = 20, offset: Int = 0) async throws -> NotificationsResponse {
        var items: [URLQueryItem] = [
            .init(name: "limit", value: "\(limit)"),
            .init(name: "offset", value: "\(offset)"),
        ]
        if unreadOnly { items.append(.init(name: "unread", value: "true")) }
        return try await perform(request(path: "/api/notifications", queryItems: items))
    }

    func markNotificationRead(id: String) async throws {
        struct Body: Encodable { let action: String; let id: String }
        var req = request(path: "/api/notifications", method: "PATCH")
        req.httpBody = try JSONEncoder().encode(Body(action: "mark_read", id: id))
        let _: SuccessResponse = try await perform(req)
    }

    func markAllNotificationsRead() async throws {
        struct Body: Encodable { let action: String }
        var req = request(path: "/api/notifications", method: "PATCH")
        req.httpBody = try JSONEncoder().encode(Body(action: "mark_all_read"))
        let _: SuccessResponse = try await perform(req)
    }

    func notificationUnreadCount() async throws -> Int {
        struct Response: Decodable { let unreadCount: Int }
        let req = request(path: "/api/notifications/count")
        let resp: Response = try await perform(req)
        return resp.unreadCount
    }

    // MARK: - Notification preferences

    func notificationPreferences() async throws -> NotificationPreferences {
        let req = request(path: "/api/me/notification-preferences")
        let resp: DataWrapper<NotificationPreferences> = try await perform(req)
        return resp.data
    }

    func updateNotificationPreferences(_ prefs: NotificationPreferences) async throws {
        var req = request(path: "/api/me/notification-preferences", method: "PUT")
        req.httpBody = try JSONEncoder().encode(prefs)
        // Server returns `{ data: prefs }` on success — we don't reuse the
        // response body (the caller already holds the value it sent), but
        // running through `perform` gives us 401 propagation + error decode.
        let _: DataWrapper<NotificationPreferences> = try await perform(req)
    }

    // MARK: - Shift Trades

    func shiftTrades(status: String? = nil, limit: Int = 30, offset: Int = 0) async throws -> ShiftTradesResponse {
        var items: [URLQueryItem] = [
            .init(name: "limit", value: "\(limit)"),
            .init(name: "offset", value: "\(offset)"),
        ]
        if let status { items.append(.init(name: "status", value: status)) }
        return try await perform(request(path: "/api/shift-trades", queryItems: items))
    }

    func postShiftTrade(assignmentId: String, notes: String?) async throws -> ShiftTrade {
        struct Body: Encodable { let shiftAssignmentId: String; let notes: String? }
        var req = request(path: "/api/shift-trades", method: "POST")
        req.httpBody = try JSONEncoder().encode(Body(shiftAssignmentId: assignmentId, notes: notes))
        let resp: DataWrapper<ShiftTrade> = try await perform(req)
        return resp.data
    }

    func claimShiftTrade(id: String) async throws -> ShiftTrade {
        let req = request(path: "/api/shift-trades/\(id)/claim", method: "POST")
        let resp: DataWrapper<ShiftTrade> = try await perform(req)
        return resp.data
    }

    func cancelShiftTrade(id: String) async throws -> ShiftTrade {
        let req = request(path: "/api/shift-trades/\(id)/cancel", method: "PATCH")
        let resp: DataWrapper<ShiftTrade> = try await perform(req)
        return resp.data
    }

    // MARK: - Shift assignment / authoring

    /// Roster of users assigned to a sport (used as the eligibility list for
    /// assigning students to ST shifts on iOS).
    func sportRoster(sportCode: String) async throws -> [RosterEntry] {
        let req = request(path: "/api/sport-configs/\(sportCode)/roster")
        let resp: DataWrapper<[RosterEntry]> = try await perform(req)
        return resp.data
    }

    /// Direct-assign a user to a shift (STAFF/ADMIN).
    func assignShift(shiftId: String, userId: String) async throws {
        struct Body: Encodable { let shiftId: String; let userId: String }
        var req = request(path: "/api/shift-assignments", method: "POST")
        req.httpBody = try JSONEncoder().encode(Body(shiftId: shiftId, userId: userId))
        let (data, response) = try await session.data(for: req)
        if let http = response as? HTTPURLResponse, !(200...299).contains(http.statusCode) {
            if http.statusCode == 401 { NotificationCenter.default.post(name: .sessionDidExpire, object: nil); throw APIError.unauthorized }
            let msg = (try? JSONDecoder().decode(ServerErrorBody.self, from: data))?.error ?? "Couldn't assign shift"
            throw APIError.serverError(msg)
        }
    }

    /// Remove an assignment (STAFF/ADMIN).
    func unassignShift(assignmentId: String) async throws {
        let req = request(path: "/api/shift-assignments/\(assignmentId)", method: "DELETE")
        let (data, response) = try await session.data(for: req)
        if let http = response as? HTTPURLResponse, !(200...299).contains(http.statusCode) {
            if http.statusCode == 401 { NotificationCenter.default.post(name: .sessionDidExpire, object: nil); throw APIError.unauthorized }
            let msg = (try? JSONDecoder().decode(ServerErrorBody.self, from: data))?.error ?? "Couldn't remove assignment"
            throw APIError.serverError(msg)
        }
    }

    func updateShiftTimes(shiftId: String, startsAt: Date, endsAt: Date) async throws {
        struct Body: Encodable { let startsAt: String; let endsAt: String }
        let iso = ISO8601DateFormatter()
        var req = request(path: "/api/shifts/\(shiftId)", method: "PATCH")
        req.httpBody = try JSONEncoder().encode(Body(startsAt: iso.string(from: startsAt), endsAt: iso.string(from: endsAt)))
        let (data, response) = try await session.data(for: req)
        if let http = response as? HTTPURLResponse, !(200...299).contains(http.statusCode) {
            if http.statusCode == 401 { NotificationCenter.default.post(name: .sessionDidExpire, object: nil); throw APIError.unauthorized }
            let msg = (try? JSONDecoder().decode(ServerErrorBody.self, from: data))?.error ?? "Couldn't update shift times"
            throw APIError.serverError(msg)
        }
    }

    func approveShift(assignmentId: String) async throws {
        let req = request(path: "/api/shift-assignments/\(assignmentId)/approve", method: "PATCH")
        let (data, response) = try await session.data(for: req)
        if let http = response as? HTTPURLResponse, !(200...299).contains(http.statusCode) {
            if http.statusCode == 401 { NotificationCenter.default.post(name: .sessionDidExpire, object: nil); throw APIError.unauthorized }
            let msg = (try? JSONDecoder().decode(ServerErrorBody.self, from: data))?.error ?? "Couldn't approve request"
            throw APIError.serverError(msg)
        }
    }

    func declineShift(assignmentId: String) async throws {
        let req = request(path: "/api/shift-assignments/\(assignmentId)/decline", method: "PATCH")
        let (data, response) = try await session.data(for: req)
        if let http = response as? HTTPURLResponse, !(200...299).contains(http.statusCode) {
            if http.statusCode == 401 { NotificationCenter.default.post(name: .sessionDidExpire, object: nil); throw APIError.unauthorized }
            let msg = (try? JSONDecoder().decode(ServerErrorBody.self, from: data))?.error ?? "Couldn't decline request"
            throw APIError.serverError(msg)
        }
    }

    func requestShift(shiftId: String) async throws {
        struct Body: Encodable { let shiftId: String }
        var req = request(path: "/api/shift-assignments/request", method: "POST")
        req.httpBody = try JSONEncoder().encode(Body(shiftId: shiftId))
        let (data, response) = try await session.data(for: req)
        if let http = response as? HTTPURLResponse, !(200...299).contains(http.statusCode) {
            if http.statusCode == 401 { NotificationCenter.default.post(name: .sessionDidExpire, object: nil); throw APIError.unauthorized }
            let msg = (try? JSONDecoder().decode(ServerErrorBody.self, from: data))?.error ?? "Couldn't request shift"
            throw APIError.serverError(msg)
        }
    }

    /// Delete a shift from a shift group (STAFF/ADMIN). Pass force=true to remove even if assigned.
    func deleteShift(shiftGroupId: String, shiftId: String) async throws {
        let req = request(
            path: "/api/shift-groups/\(shiftGroupId)/shifts/\(shiftId)",
            method: "DELETE",
            queryItems: [.init(name: "force", value: "true")]
        )
        let (data, response) = try await session.data(for: req)
        if let http = response as? HTTPURLResponse, !(200...299).contains(http.statusCode) {
            if http.statusCode == 401 { NotificationCenter.default.post(name: .sessionDidExpire, object: nil); throw APIError.unauthorized }
            let msg = (try? JSONDecoder().decode(ServerErrorBody.self, from: data))?.error ?? "Couldn't delete shift"
            throw APIError.serverError(msg)
        }
    }

    /// Add a new shift to a shift group (STAFF/ADMIN).
    func addShift(
        shiftGroupId: String,
        area: String,
        workerType: String,
        startsAt: Date? = nil,
        endsAt: Date? = nil
    ) async throws {
        struct Body: Encodable {
            let area: String
            let workerType: String
            let startsAt: String?
            let endsAt: String?
        }
        let isoFormatter = ISO8601DateFormatter()
        let body = Body(
            area: area,
            workerType: workerType,
            startsAt: startsAt.map { isoFormatter.string(from: $0) },
            endsAt: endsAt.map { isoFormatter.string(from: $0) }
        )
        var req = request(path: "/api/shift-groups/\(shiftGroupId)/shifts", method: "POST")
        req.httpBody = try JSONEncoder().encode(body)
        let (data, response) = try await session.data(for: req)
        if let http = response as? HTTPURLResponse, !(200...299).contains(http.statusCode) {
            if http.statusCode == 401 { NotificationCenter.default.post(name: .sessionDidExpire, object: nil); throw APIError.unauthorized }
            let msg = (try? JSONDecoder().decode(ServerErrorBody.self, from: data))?.error ?? "Couldn't add shift"
            throw APIError.serverError(msg)
        }
    }

    // MARK: - Internals

    /// `path` must be a pure path — `appendingPathComponent` percent-encodes
    /// `?`, so a query string embedded in `path` becomes part of the last
    /// route param (`shifts/abc%3Fforce=true` → shiftId "abc?force=true").
    /// Pass query parameters via `queryItems` instead.
    private func request(path: String, method: String = "GET", queryItems: [URLQueryItem]? = nil) -> URLRequest {
        var url = baseURL.appendingPathComponent(path)
        if let queryItems, !queryItems.isEmpty {
            var components = URLComponents(url: url, resolvingAgainstBaseURL: false)!
            components.queryItems = queryItems
            url = components.url!
        }
        var req = URLRequest(url: url)
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("WisconsinApp/1.0 iOS", forHTTPHeaderField: "User-Agent")
        req.setValue(baseURL.absoluteString, forHTTPHeaderField: "Origin")
        return req
    }

    private func httpDateString(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        formatter.dateFormat = "EEE, dd MMM yyyy HH:mm:ss 'GMT'"
        return formatter.string(from: date)
    }

    private func perform<T: Decodable>(_ request: URLRequest) async throws -> T {
        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: request)
        } catch {
            throw APIError.networkError(error)
        }

        guard let http = response as? HTTPURLResponse else {
            throw APIError.serverError("Invalid response")
        }

        switch http.statusCode {
        case 200...299:
            do {
                return try decoder.decode(T.self, from: data)
            } catch {
                throw APIError.decodingError(error)
            }
        case 401:
            // Single point where 401 broadcasts globally; SessionStore listens
            // and routes the user back to login.
            NotificationCenter.default.post(name: .sessionDidExpire, object: nil)
            throw APIError.unauthorized
        case 404:
            throw APIError.notFound
        case 409:
            if let body = try? decoder.decode(ConflictResponseBody.self, from: data),
               let d = body.data {
                var parts: [String] = []
                for c in d.conflicts ?? [] {
                    if let title = c.conflictingBookingTitle {
                        parts.append("conflicts with \"\(title)\"")
                    } else {
                        parts.append("scheduling conflict")
                    }
                }
                for u in d.unavailableAssets ?? [] {
                    let readable = u.status.lowercased().replacingOccurrences(of: "_", with: " ")
                    parts.append("unavailable (\(readable))")
                }
                for s in d.shortages ?? [] {
                    parts.append("only \(s.available) of \(s.requested) available")
                }
                if !parts.isEmpty {
                    throw APIError.serverError("Some equipment is no longer available: \(parts.joined(separator: "; ")). Remove it and try again.")
                }
            }
            let msg409 = (try? decoder.decode(ServerErrorBody.self, from: data))?.error
                ?? "This equipment is no longer available — please try again."
            throw APIError.serverError(msg409)
        default:
            let msg = (try? JSONDecoder().decode(ServerErrorBody.self, from: data))?.error
                ?? "Server error (\(http.statusCode))"
            throw APIError.serverError(msg)
        }
    }

    // MARK: - ICS Calendar Feed

    /// Returns the user's existing ICS token, or nil if one hasn't been generated yet.
    func icsToken() async throws -> String? {
        struct Response: Decodable { let data: TokenData }
        struct TokenData: Decodable { let token: String? }
        let req = request(path: "/api/shifts/ics-token")
        let resp: Response = try await perform(req)
        return resp.data.token
    }

    /// Generates (or rotates) the user's ICS token. Returns the new token.
    func generateICSToken() async throws -> String {
        struct Response: Decodable { let data: TokenData }
        struct TokenData: Decodable { let token: String }
        var req = request(path: "/api/shifts/ics-token", method: "POST")
        req.httpBody = Data()
        let resp: Response = try await perform(req)
        return resp.data.token
    }
}

// MARK: - Private response shapes

private struct DataWrapper<T: Decodable>: Decodable {
    let data: T
}

private struct LoginResponse: Decodable {
    let user: CurrentUser
}

private struct MeResponse: Decodable {
    let user: CurrentUser
}

private struct ChangePasswordResponse: Decodable {
    let success: Bool
}

private struct SuccessResponse: Decodable {
    let success: Bool
}

private struct ServerErrorBody: Decodable {
    let error: String
}

private struct ConflictResponseBody: Decodable {
    let error: String?
    let data: ConflictData?

    struct ConflictData: Decodable {
        let conflicts: [ConflictItem]?
        let unavailableAssets: [UnavailableItem]?
        let shortages: [Shortage]?

        struct ConflictItem: Decodable {
            let assetId: String
            let conflictingBookingTitle: String?
        }
        struct UnavailableItem: Decodable {
            let assetId: String
            let status: String
        }
        struct Shortage: Decodable {
            let bulkSkuId: String
            let requested: Int
            let available: Int
        }
    }
}
