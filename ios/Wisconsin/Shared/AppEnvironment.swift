import Foundation

enum AppEnvironment {
    static let canonicalHost = "wisconsincreative.com"
    static let legacyHost = "gear.erikrole.com"
    static let baseURL = URL(string: "https://\(canonicalHost)")!
    static let origin = baseURL.absoluteString

    static func url(path: String) -> URL {
        baseURL.appendingPathComponent(path)
    }

    static func webcalURL(path: String) -> URL? {
        let normalizedPath = path.hasPrefix("/") ? path : "/\(path)"
        return URL(string: "webcal://\(canonicalHost)\(normalizedPath)")
    }
}
