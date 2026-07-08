import Foundation

enum AppEnvironment {
    static let canonicalHost = "wisconsincreative.com"
    static let legacyHost = "gear.erikrole.com"
    static let appReviewHost = "review.wisconsincreative.com"
    static let appReviewEmail = "appreview@wisconsincreative.com"
    static let baseURL = URL(string: "https://\(canonicalHost)")!
    static let origin = baseURL.absoluteString

    private static let activeAPIHostKey = "WisconsinActiveAPIHost"

    static var activeAPIHost: String {
        UserDefaults.standard.string(forKey: activeAPIHostKey) ?? canonicalHost
    }

    static var activeAPIBaseURL: URL {
        URL(string: "https://\(activeAPIHost)")!
    }

    static var activeAPIOrigin: String {
        activeAPIBaseURL.absoluteString
    }

    static func apiHost(forLoginEmail email: String) -> String {
        let normalized = email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        return normalized == appReviewEmail ? appReviewHost : canonicalHost
    }

    static func setActiveAPIHost(_ host: String) {
        if host == canonicalHost {
            UserDefaults.standard.removeObject(forKey: activeAPIHostKey)
        } else {
            UserDefaults.standard.set(host, forKey: activeAPIHostKey)
        }
    }

    static func resetActiveAPIHost() {
        UserDefaults.standard.removeObject(forKey: activeAPIHostKey)
    }

    static func url(path: String) -> URL {
        baseURL.appendingPathComponent(path)
    }

    static func webcalURL(path: String) -> URL? {
        let normalizedPath = path.hasPrefix("/") ? path : "/\(path)"
        return URL(string: "webcal://\(canonicalHost)\(normalizedPath)")
    }
}
