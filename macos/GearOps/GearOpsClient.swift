import Foundation

enum GearOpsClientError: LocalizedError, Equatable, Sendable {
    case unauthorized
    case forbidden(String)
    case invalidResponse
    case network(String)
    case server(statusCode: Int, message: String)

    var errorDescription: String? {
        switch self {
        case .unauthorized:
            "Your session expired. Sign in again."
        case .forbidden(let message):
            message
        case .invalidResponse:
            "Gear Tracker returned an unreadable response."
        case .network(let message):
            message
        case .server(_, let message):
            message
        }
    }
}

protocol GearOpsServing: Sendable {
    func login(email: String, password: String) async throws -> LoginResponse
    func companionProjection(token: String, refreshFromSource: Bool) async throws -> CompanionProjection
    func registerCompanionDevice(_ deviceToken: String, credential: String) async throws
    func revokeCompanion(credential: String) async
}

actor GearOpsClient: GearOpsServing {
    static let canonicalBaseURL = URL(string: "https://wisconsincreative.com")!

    private let baseURL: URL
    private let session: URLSession
    private let cookieStorage: HTTPCookieStorage
    private let decoder: JSONDecoder

    init(
        baseURL: URL = GearOpsClient.canonicalBaseURL,
        sessionConfiguration: URLSessionConfiguration? = nil,
        cookieStorage: HTTPCookieStorage = .shared
    ) {
        self.baseURL = baseURL
        self.cookieStorage = cookieStorage

        let configuration = sessionConfiguration ?? .default
        configuration.httpCookieStorage = cookieStorage
        configuration.httpShouldSetCookies = true
        configuration.httpCookieAcceptPolicy = .always
        configuration.timeoutIntervalForRequest = 15
        configuration.timeoutIntervalForResource = 30
        configuration.waitsForConnectivity = false
        session = URLSession(configuration: configuration)

        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        decoder.dateDecodingStrategy = .iso8601
        self.decoder = decoder
    }

    func login(email: String, password: String) async throws -> LoginResponse {
        struct Body: Encodable {
            let email: String
            let password: String
            let rememberMe: Bool
            let companion: Bool
        }

        var request = makeRequest(path: "/api/auth/login", method: "POST")
        request.httpBody = try JSONEncoder().encode(Body(
            email: email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased(),
            password: password,
            rememberMe: false,
            companion: true
        ))
        return try await perform(request)
    }

    func companionProjection(token: String, refreshFromSource: Bool = false) async throws -> CompanionProjection {
        var request = makeRequest(
            path: "/api/companion/projection",
            method: refreshFromSource ? "POST" : "GET"
        )
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        let response: CompanionProjectionEnvelope = try await perform(request)
        return response.data
    }

    func registerCompanionDevice(_ deviceToken: String, credential: String) async throws {
        struct Body: Encodable { let token: String }
        var request = makeRequest(path: "/api/companion/devices", method: "POST")
        request.setValue("Bearer \(credential)", forHTTPHeaderField: "Authorization")
        request.httpBody = try JSONEncoder().encode(Body(token: deviceToken))
        let _: SuccessResponse = try await perform(request)
    }

    func revokeCompanion(credential: String) async {
        var request = makeRequest(path: "/api/companion/devices", method: "DELETE")
        request.setValue("Bearer \(credential)", forHTTPHeaderField: "Authorization")
        _ = try? await session.data(for: request)
    }

    private func makeRequest(
        path: String,
        method: String = "GET",
        queryItems: [URLQueryItem] = []
    ) -> URLRequest {
        var components = URLComponents(url: baseURL.appendingPathComponent(path), resolvingAgainstBaseURL: false)!
        components.queryItems = queryItems.isEmpty ? nil : queryItems
        var request = URLRequest(url: components.url!)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("GearOps/1.0 macOS", forHTTPHeaderField: "User-Agent")
        request.setValue(baseURL.absoluteString, forHTTPHeaderField: "Origin")
        return request
    }

    private func perform<T: Decodable & Sendable>(_ request: URLRequest) async throws -> T {
        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: request)
        } catch {
            throw GearOpsClientError.network(Self.networkMessage(for: error))
        }

        guard let http = response as? HTTPURLResponse else {
            throw GearOpsClientError.invalidResponse
        }

        if (200...299).contains(http.statusCode) {
            do {
                return try decoder.decode(T.self, from: data)
            } catch {
                throw GearOpsClientError.invalidResponse
            }
        }

        let message = (try? decoder.decode(ServerErrorResponse.self, from: data).error)
            ?? "Gear Tracker returned HTTP \(http.statusCode)."
        switch http.statusCode {
        case 401:
            throw GearOpsClientError.unauthorized
        case 403:
            throw GearOpsClientError.forbidden(message)
        default:
            throw GearOpsClientError.server(statusCode: http.statusCode, message: message)
        }
    }

    private static func networkMessage(for error: Error) -> String {
        switch (error as? URLError)?.code {
        case .notConnectedToInternet, .networkConnectionLost:
            "No internet connection. Showing the last confirmed Gear Tracker data."
        case .timedOut:
            "Gear Tracker timed out. Showing the last confirmed data."
        case .cannotFindHost, .cannotConnectToHost, .dnsLookupFailed:
            "Gear Tracker could not be reached. Showing the last confirmed data."
        default:
            "Gear Tracker could not refresh. Showing the last confirmed data."
        }
    }
}

private struct SuccessResponse: Decodable, Sendable {
    let success: Bool
}
