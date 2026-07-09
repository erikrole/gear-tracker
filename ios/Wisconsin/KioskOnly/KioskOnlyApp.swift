import Foundation
import SwiftUI
import UIKit

@main
struct WisconsinKioskApp: App {
    @State private var kioskStore = KioskStore()

    var body: some Scene {
        WindowGroup {
            KioskShellView()
                .environment(kioskStore)
                .preferredColorScheme(.dark)
                .frame(minWidth: 640, minHeight: 540)
                .onAppear {
                    sharedKioskStore = kioskStore
                    kioskStore.enterKiosk()
                }
        }
        .windowResizability(.contentMinSize)
    }
}

enum APIError: LocalizedError {
    case unauthorized
    case notFound
    case serverError(String)
    case decodingError(Error)
    case networkError(Error)

    var errorDescription: String? {
        switch self {
        case .unauthorized:
            return "This kiosk session expired. Enter a fresh activation code."
        case .notFound:
            return "The requested item could not be found."
        case .serverError(let message):
            return message
        case .decodingError:
            return "Unexpected response from server."
        case .networkError(let error):
            return Self.humanize(error)
        }
    }

    private static func humanize(_ error: Error) -> String {
        let code = (error as? URLError)?.code
        switch code {
        case .notConnectedToInternet, .networkConnectionLost:
            return "No internet connection. Check the kiosk network and try again."
        case .timedOut:
            return "Request timed out. Try again in a moment."
        case .cannotFindHost, .cannotConnectToHost, .dnsLookupFailed:
            return "Couldn't reach the server. Try again shortly."
        case .cancelled:
            return "Request was cancelled."
        default:
            return "Network error. Check the kiosk connection and try again."
        }
    }
}

enum Haptics {
    @MainActor static func success() {
        UINotificationFeedbackGenerator().notificationOccurred(.success)
    }

    @MainActor static func error() {
        UINotificationFeedbackGenerator().notificationOccurred(.error)
    }

    @MainActor static func warning() {
        UINotificationFeedbackGenerator().notificationOccurred(.warning)
    }

    @MainActor static func selection() {
        UISelectionFeedbackGenerator().selectionChanged()
    }

    @MainActor static func tap() {
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
    }
}

enum StatusTone: String, CaseIterable {
    case green, blue, red, purple, orange, gray
}

extension Color {
    static func statusText(_ tone: StatusTone) -> Color {
        switch tone {
        case .green:
            return Color(UIColor(dynamicProvider: { $0.userInterfaceStyle == .dark
                ? UIColor(red: 0.32, green: 0.85, blue: 0.45, alpha: 1)
                : UIColor(red: 0.086, green: 0.639, blue: 0.290, alpha: 1)
            }))
        case .blue:
            return Color(UIColor(dynamicProvider: { $0.userInterfaceStyle == .dark
                ? UIColor(red: 0.40, green: 0.65, blue: 1.0, alpha: 1)
                : UIColor(red: 0.149, green: 0.388, blue: 0.922, alpha: 1)
            }))
        case .red:
            return Color(UIColor(dynamicProvider: { $0.userInterfaceStyle == .dark
                ? UIColor(red: 1.0, green: 0.40, blue: 0.40, alpha: 1)
                : UIColor(red: 0.863, green: 0.149, blue: 0.149, alpha: 1)
            }))
        case .purple:
            return Color(UIColor(dynamicProvider: { $0.userInterfaceStyle == .dark
                ? UIColor(red: 0.70, green: 0.55, blue: 1.0, alpha: 1)
                : UIColor(red: 0.486, green: 0.227, blue: 0.929, alpha: 1)
            }))
        case .orange:
            return Color(UIColor(dynamicProvider: { $0.userInterfaceStyle == .dark
                ? UIColor(red: 1.0, green: 0.70, blue: 0.30, alpha: 1)
                : UIColor(red: 0.851, green: 0.467, blue: 0.024, alpha: 1)
            }))
        case .gray:
            return Color.secondary
        }
    }
}

extension Font {
    static func gothamBlack(size: CGFloat) -> Font {
        UIFont(name: "Gotham-Black", size: size) != nil
            ? .custom("Gotham-Black", size: size)
            : .system(size: size, weight: .heavy)
    }

    static func gothamBold(size: CGFloat) -> Font {
        UIFont(name: "Gotham-Bold", size: size) != nil
            ? .custom("Gotham-Bold", size: size)
            : .system(size: size, weight: .bold)
    }
}
