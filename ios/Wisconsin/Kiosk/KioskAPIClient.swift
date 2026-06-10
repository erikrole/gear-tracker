import Foundation

// Standalone kiosk API client. Uses HTTPCookieStorage.shared so the
// kiosk_session cookie set during activation is sent automatically.
struct KioskAPI {
    static let shared = KioskAPI()

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

    // MARK: - Session

    func kioskMe() async throws {
        // `/api/kiosk/me` returns `{kioskId, locationId, locationName}` at the
        // TOP level — no `data` envelope. Decoding a wrapper here failed every
        // call, and KioskStore.validateSession treated that as a dead session,
        // so the kiosk forced re-activation on every app re-entry.
        struct Response: Decodable { let kioskId: String }
        let req = request(path: "/api/kiosk/me")
        let _: Response = try await perform(req)
    }

    func kioskActivate(code: String) async throws -> KioskActivationResponse {
        struct Body: Encodable { let code: String }
        var req = request(path: "/api/kiosk/activate", method: "POST")
        req.httpBody = try JSONEncoder().encode(Body(code: code))
        return try await perform(req)
    }

    func kioskHeartbeat() async throws {
        struct Response: Decodable { let status: String; let kioskId: String }
        let req = request(path: "/api/kiosk/heartbeat", method: "POST")
        // Route through `perform` so APIError.unauthorized propagates — the
        // caller (`KioskStore.startHeartbeat`) catches it specifically to
        // detect admin-deactivation. The prior `try?` swallowed 401 silently
        // and the kiosk would heartbeat into the void until the next user
        // mutation finally surfaced the auth failure.
        let _: Response = try await perform(req)
    }

    // MARK: - Dashboard

    func kioskDashboard() async throws -> KioskDashboard {
        let req = request(path: "/api/kiosk/dashboard")
        return try await perform(req)
    }

    func kioskUsers() async throws -> [KioskUser] {
        struct Resp: Decodable { let data: [KioskUser] }
        let req = request(path: "/api/kiosk/users")
        let resp: Resp = try await perform(req)
        return resp.data
    }

    // MARK: - Student

    func kioskStudentContext(userId: String) async throws -> KioskStudentContext {
        let req = request(path: "/api/kiosk/student/\(userId)")
        return try await perform(req)
    }

    // MARK: - Checkout

    func kioskCheckoutScan(actorId: String, scanValue: String) async throws -> KioskScanResult {
        struct Body: Encodable { let actorId: String; let scanValue: String }
        var req = request(path: "/api/kiosk/checkout/scan", method: "POST")
        req.httpBody = try JSONEncoder().encode(Body(actorId: actorId, scanValue: scanValue))
        return try await perform(req)
    }

    func kioskCheckoutComplete(actorId: String, locationId: String, assetIds: [String]) async throws {
        struct AssetRef: Encodable { let assetId: String }
        struct Body: Encodable { let actorId: String; let locationId: String; let items: [AssetRef] }
        var req = request(path: "/api/kiosk/checkout/complete", method: "POST")
        let items = assetIds.map { AssetRef(assetId: $0) }
        req.httpBody = try JSONEncoder().encode(Body(actorId: actorId, locationId: locationId, items: items))
        let (data, response) = try await session.data(for: req)
        if let http = response as? HTTPURLResponse, !(200...299).contains(http.statusCode) {
            let msg = (try? decoder.decode(ErrorBody.self, from: data))?.error ?? "Checkout failed"
            throw APIError.serverError(msg)
        }
    }

    func kioskCheckoutDetail(id: String) async throws -> KioskCheckoutDetail {
        let req = request(path: "/api/kiosk/checkout/\(id)")
        return try await perform(req)
    }

    // MARK: - Checkin (Return)

    func kioskCheckinScan(bookingId: String, scanValue: String) async throws -> KioskScanResult {
        struct Body: Encodable { let scanValue: String }
        var req = request(path: "/api/kiosk/checkin/\(bookingId)/scan", method: "POST")
        req.httpBody = try JSONEncoder().encode(Body(scanValue: scanValue))
        return try await perform(req)
    }

    func kioskCheckinComplete(bookingId: String, actorId: String) async throws -> KioskCheckinCompleteResult {
        struct Body: Encodable { let actorId: String }
        var req = request(path: "/api/kiosk/checkin/\(bookingId)/complete", method: "POST")
        req.httpBody = try JSONEncoder().encode(Body(actorId: actorId))
        // Route through `perform` so 401/404/409/5xx propagate as APIError —
        // the prior `try?` swallowed every failure mode and produced phantom
        // successes (booking stayed OPEN server-side, kiosk showed the
        // success screen, asset showed up on tomorrow's overdue report).
        return try await perform(req)
    }

    // MARK: - Pickup

    func kioskPickupScan(bookingId: String, scanValue: String) async throws -> KioskScanResult {
        struct Body: Encodable { let scanValue: String }
        var req = request(path: "/api/kiosk/pickup/\(bookingId)/scan", method: "POST")
        req.httpBody = try JSONEncoder().encode(Body(scanValue: scanValue))
        return try await perform(req)
    }

    func kioskPickupConfirm(bookingId: String, actorId: String) async throws {
        struct Body: Encodable { let actorId: String }
        struct Response: Decodable { let success: Bool; let bookingId: String }
        var req = request(path: "/api/kiosk/pickup/\(bookingId)/confirm", method: "POST")
        req.httpBody = try JSONEncoder().encode(Body(actorId: actorId))
        // Route through `perform` so 401/404/409/5xx propagate as APIError —
        // the prior `try?` swallowed every failure mode and produced phantom
        // successes (booking stayed PENDING_PICKUP server-side, kiosk showed
        // the confirmation screen).
        let _: Response = try await perform(req)
    }

    // MARK: - Internals

    private func request(path: String, method: String = "GET") -> URLRequest {
        var req = URLRequest(url: baseURL.appendingPathComponent(path))
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("WisconsinApp/1.0 iOS Kiosk", forHTTPHeaderField: "User-Agent")
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
            let msg = (try? decoder.decode(ErrorBody.self, from: data))?.error ?? "Server error (\(http.statusCode))"
            throw APIError.serverError(msg)
        }
    }
}

private struct DataWrapper<T: Decodable>: Decodable { let data: T }
private struct ErrorBody: Decodable { let error: String }
