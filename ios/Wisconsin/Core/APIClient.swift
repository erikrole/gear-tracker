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
        case .networkError(let err): err.localizedDescription
        }
    }
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
        _ = try? await session.data(for: req)
        HTTPCookieStorage.shared.removeCookies(since: .distantPast)
    }

    func me() async throws -> CurrentUser {
        let req = request(path: "/api/me")
        let resp: MeResponse = try await perform(req)
        return resp.user
    }

    // MARK: - Bookings

    func reservations(activeOnly: Bool = true, search: String? = nil, limit: Int = 30, offset: Int = 0) async throws -> PaginatedResponse<Booking> {
        try await perform(bookingListRequest(path: "/api/reservations", active: activeOnly, status: nil, search: search, limit: limit, offset: offset))
    }

    func checkouts(activeOnly: Bool = true, search: String? = nil, limit: Int = 30, offset: Int = 0) async throws -> PaginatedResponse<Booking> {
        try await perform(bookingListRequest(path: "/api/checkouts", active: false, status: activeOnly ? .open : nil, search: search, limit: limit, offset: offset))
    }

    private func bookingListRequest(path: String, active: Bool, status: BookingStatus?, search: String?, limit: Int, offset: Int) -> URLRequest {
        var components = URLComponents(url: baseURL.appendingPathComponent(path), resolvingAgainstBaseURL: false)!
        var items: [URLQueryItem] = [
            .init(name: "limit", value: "\(limit)"),
            .init(name: "offset", value: "\(offset)"),
        ]
        if active { items.append(.init(name: "active", value: "true")) }
        if let status { items.append(.init(name: "status", value: status.rawValue)) }
        if let search, !search.isEmpty { items.append(.init(name: "q", value: search)) }
        components.queryItems = items
        var req = URLRequest(url: components.url!)
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("WisconsinApp/1.0 iOS", forHTTPHeaderField: "User-Agent")
        req.setValue(baseURL.absoluteString, forHTTPHeaderField: "Origin")
        return req
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
            if http.statusCode == 401 { throw APIError.unauthorized }
            let msg = (try? JSONDecoder().decode(ServerErrorBody.self, from: data))?.error ?? "Cancel failed"
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
            if http.statusCode == 401 { throw APIError.unauthorized }
            let msg = (try? JSONDecoder().decode(ServerErrorBody.self, from: data))?.error ?? "Update failed"
            throw APIError.serverError(msg)
        }
    }

    func updateBooking(id: String, title: String? = nil, notes: String? = nil, startsAt: Date? = nil, endsAt: Date? = nil) async throws {
        struct Body: Encodable {
            let title: String?
            let notes: String?
            let startsAt: String?
            let endsAt: String?
        }
        var req = request(path: "/api/bookings/\(id)", method: "PATCH")
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
            if http.statusCode == 401 { throw APIError.unauthorized }
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
            if http.statusCode == 401 { throw APIError.unauthorized }
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
            if http.statusCode == 401 { throw APIError.unauthorized }
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
        serializedAssetIds: [String] = []
    ) async throws -> String {
        struct Body: Encodable {
            let title: String
            let requesterUserId: String
            let locationId: String
            let startsAt: String
            let endsAt: String
            let notes: String?
            let serializedAssetIds: [String]
            let bulkItems: [String]
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
            bulkItems: [],
            eventId: eventId,
            shiftAssignmentId: shiftAssignmentId
        ))
        let resp: DataWrapper<BookingStub> = try await perform(req)
        return resp.data.id
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

    // MARK: - Assets

    func assets(
        search: String? = nil,
        status: AssetComputedStatus? = nil,
        categoryId: String? = nil,
        limit: Int = 30,
        offset: Int = 0
    ) async throws -> AssetsResponse {
        var components = URLComponents(url: baseURL.appendingPathComponent("/api/assets"), resolvingAgainstBaseURL: false)!
        var items: [URLQueryItem] = [
            .init(name: "limit", value: "\(limit)"),
            .init(name: "offset", value: "\(offset)"),
        ]
        if let search, !search.isEmpty { items.append(.init(name: "q", value: search)) }
        if let status { items.append(.init(name: "status", value: status.rawValue)) }
        if let categoryId { items.append(.init(name: "category_id", value: categoryId)) }
        components.queryItems = items
        var req = URLRequest(url: components.url!)
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("WisconsinApp/1.0 iOS", forHTTPHeaderField: "User-Agent")
        return try await perform(req)
    }

    func asset(id: String) async throws -> AssetDetail {
        let req = request(path: "/api/assets/\(id)")
        let resp: DataWrapper<AssetDetail> = try await perform(req)
        return resp.data
    }

    func assetsLookup(rawScan: String) async throws -> Asset? {
        let stripped = rawScan
            .replacingOccurrences(of: "bg://item/", with: "")
            .replacingOccurrences(of: "bg://case/", with: "")
        var components = URLComponents(url: baseURL.appendingPathComponent("/api/assets"), resolvingAgainstBaseURL: false)!
        components.queryItems = [
            .init(name: "q", value: stripped),
            .init(name: "qr", value: stripped),
            .init(name: "limit", value: "5"),
        ]
        var req = URLRequest(url: components.url!)
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("WisconsinApp/1.0 iOS", forHTTPHeaderField: "User-Agent")
        let resp: AssetsResponse = try await perform(req)
        return resp.data.first
    }

    func assetByQR(qrValue: String) async throws -> Asset? {
        var components = URLComponents(url: baseURL.appendingPathComponent("/api/assets"), resolvingAgainstBaseURL: false)!
        components.queryItems = [.init(name: "qr", value: qrValue), .init(name: "limit", value: "1")]
        var req = URLRequest(url: components.url!)
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("WisconsinApp/1.0 iOS", forHTTPHeaderField: "User-Agent")
        let resp: AssetsResponse = try await perform(req)
        return resp.data.first
    }

    // MARK: - Users

    func users(search: String? = nil, limit: Int = 10) async throws -> PaginatedResponse<AppUser> {
        var components = URLComponents(url: baseURL.appendingPathComponent("/api/users"), resolvingAgainstBaseURL: false)!
        var items: [URLQueryItem] = [.init(name: "limit", value: "\(limit)")]
        if let search, !search.isEmpty { items.append(.init(name: "q", value: search)) }
        components.queryItems = items
        var req = URLRequest(url: components.url!)
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("WisconsinApp/1.0 iOS", forHTTPHeaderField: "User-Agent")
        return try await perform(req)
    }

    func user(id: String) async throws -> AppUserDetail {
        let req = request(path: "/api/users/\(id)")
        let resp: DataWrapper<AppUserDetail> = try await perform(req)
        return resp.data
    }

    func reservationsByUser(userId: String, limit: Int = 10) async throws -> PaginatedResponse<Booking> {
        var components = URLComponents(url: baseURL.appendingPathComponent("/api/reservations"), resolvingAgainstBaseURL: false)!
        components.queryItems = [
            .init(name: "requester_id", value: userId),
            .init(name: "limit", value: "\(limit)"),
            .init(name: "offset", value: "0"),
        ]
        var req = URLRequest(url: components.url!)
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("WisconsinApp/1.0 iOS", forHTTPHeaderField: "User-Agent")
        req.setValue(baseURL.absoluteString, forHTTPHeaderField: "Origin")
        return try await perform(req)
    }

    func checkoutsByUser(userId: String, limit: Int = 10) async throws -> PaginatedResponse<Booking> {
        var components = URLComponents(url: baseURL.appendingPathComponent("/api/checkouts"), resolvingAgainstBaseURL: false)!
        components.queryItems = [
            .init(name: "requester_id", value: userId),
            .init(name: "limit", value: "\(limit)"),
            .init(name: "offset", value: "0"),
        ]
        var req = URLRequest(url: components.url!)
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("WisconsinApp/1.0 iOS", forHTTPHeaderField: "User-Agent")
        req.setValue(baseURL.absoluteString, forHTTPHeaderField: "Origin")
        return try await perform(req)
    }

    // MARK: - Schedule

    func calendarEvents(
        includePast: Bool = false,
        limit: Int = 60
    ) async throws -> [ScheduleEvent] {
        var components = URLComponents(url: baseURL.appendingPathComponent("/api/calendar-events"), resolvingAgainstBaseURL: false)!
        var items: [URLQueryItem] = [
            .init(name: "limit", value: "\(limit)"),
            .init(name: "offset", value: "0"),
        ]
        if includePast { items.append(.init(name: "includePast", value: "true")) }
        components.queryItems = items
        var req = URLRequest(url: components.url!)
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("WisconsinApp/1.0 iOS", forHTTPHeaderField: "User-Agent")
        let resp: ScheduleEventsResponse = try await perform(req)
        return resp.data
    }

    func shiftGroup(eventId: String) async throws -> EventShiftGroup? {
        var components = URLComponents(url: baseURL.appendingPathComponent("/api/shift-groups"), resolvingAgainstBaseURL: false)!
        components.queryItems = [
            .init(name: "eventId", value: eventId),
            .init(name: "limit", value: "1"),
        ]
        var req = URLRequest(url: components.url!)
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("WisconsinApp/1.0 iOS", forHTTPHeaderField: "User-Agent")
        let resp: ShiftGroupsResponse = try await perform(req)
        return resp.data.first
    }

    func myShifts(limit: Int = 20) async throws -> [MyShift] {
        var components = URLComponents(url: baseURL.appendingPathComponent("/api/my-shifts"), resolvingAgainstBaseURL: false)!
        components.queryItems = [.init(name: "limit", value: "\(limit)")]
        var req = URLRequest(url: components.url!)
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("WisconsinApp/1.0 iOS", forHTTPHeaderField: "User-Agent")
        let resp: MyShiftsResponse = try await perform(req)
        return resp.data
    }

    // MARK: - Internals

    private func request(path: String, method: String = "GET") -> URLRequest {
        var req = URLRequest(url: baseURL.appendingPathComponent(path))
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("WisconsinApp/1.0 iOS", forHTTPHeaderField: "User-Agent")
        req.setValue(baseURL.absoluteString, forHTTPHeaderField: "Origin")
        return req
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
            throw APIError.unauthorized
        case 404:
            throw APIError.notFound
        default:
            let msg = (try? JSONDecoder().decode(ServerErrorBody.self, from: data))?.error
                ?? "Server error (\(http.statusCode))"
            throw APIError.serverError(msg)
        }
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

private struct ServerErrorBody: Decodable {
    let error: String
}
