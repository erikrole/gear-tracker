import SwiftUI
import UIKit

/// Brand color tokens. Use these instead of raw `Color(red:…)` literals so a
/// future tint change flows everywhere.
///
/// `brandPrimary` adapts to light/dark per Apple HIG contrast guidance:
/// - Light mode: `#A00000` — dark maroon, readable on white (≥ 4.5:1).
/// - Dark mode: `#FF3B30` — system-red luminance, meets 4.5:1 on dark bg.
extension Color {
    /// Wisconsin red — primary brand color (used for accents, the W mark, etc.).
    /// Dark-mode adaptive via `UIColor(dynamicProvider:)`.
    static let brandPrimary = Color(UIColor(dynamicProvider: { trait in
        trait.userInterfaceStyle == .dark
            ? UIColor(red: 1.0, green: 0.231, blue: 0.188, alpha: 1)
            : UIColor(red: 0.627, green: 0, blue: 0, alpha: 1)
    }))

    /// Top stop of the login splash gradient — near-black with a violet shift.
    static let brandSplashTop = Color(red: 0.102, green: 0.063, blue: 0.090)

    /// Mid stop of the login splash gradient — deep burgundy.
    static let brandSplashMid = Color(red: 0.176, green: 0.039, blue: 0.055)

    /// Near-black surface — login hero band, dark splash backgrounds.
    static let brandSurface = Color(red: 0.11, green: 0.11, blue: 0.11)

    /// Slightly lighter surface for disabled / secondary surfaces on the dark band.
    static let brandSurfaceDim = Color(red: 0.18, green: 0.18, blue: 0.18)
}

// MARK: - Brand typography (mirrors web Gotham usage in src/app/globals.css)

extension Font {
    /// Gotham Black — the web `PageHeader` title face. Use for headline
    /// moments (scan hero card titles). Falls back to the system heavy
    /// weight if the bundled font fails to register.
    static func gothamBlack(size: CGFloat) -> Font {
        UIFont(name: "Gotham-Black", size: size) != nil
            ? .custom("Gotham-Black", size: size)
            : .system(size: size, weight: .heavy)
    }

    /// Gotham Bold — secondary brand emphasis weight.
    static func gothamBold(size: CGFloat) -> Font {
        UIFont(name: "Gotham-Bold", size: size) != nil
            ? .custom("Gotham-Bold", size: size)
            : .system(size: size, weight: .bold)
    }
}

// MARK: - Semantic status palette (mirrors web tokens in src/app/globals.css)
//
// Web uses paired bg/text tokens for status badges:
//   --green / --green-bg / --green-text  (Available)
//   --blue  / --blue-bg  / --blue-text   (Checked out, STAFF)
//   --red   / --red-bg   / --red-text    (Overdue)
//   --purple/ --purple-bg/ --purple-text (Reserved, ADMIN)
//   --orange/ --orange-bg/ --orange-text (Maintenance)
//   --gray  → bg-muted / text-muted-foreground (Retired, Inactive, STUDENT)
//
// iOS picks dark-mode adaptive values per Apple HIG contrast guidance:
// the darker `text` tone is used for typography, the soft `bg` for fills.

/// Semantic status color identity — same vocabulary the web uses.
enum StatusTone: String, CaseIterable {
    case green, blue, red, purple, orange, gray

    /// Maps a role string to the same tone the web's `RoleBadge` uses.
    static func forRole(_ role: String) -> StatusTone {
        switch role {
        case "ADMIN": return .purple
        case "STAFF": return .blue
        case "STUDENT": return .gray
        default: return .gray
        }
    }
}

extension Color {
    /// Foreground/text color for a status tone — matches web `--{tone}-text`.
    static func statusText(_ tone: StatusTone) -> Color {
        switch tone {
        case .green:
            return Color(UIColor(dynamicProvider: { $0.userInterfaceStyle == .dark
                ? UIColor(red: 0.32, green: 0.85, blue: 0.45, alpha: 1)
                : UIColor(red: 0.086, green: 0.639, blue: 0.290, alpha: 1) // #16a34a
            }))
        case .blue:
            return Color(UIColor(dynamicProvider: { $0.userInterfaceStyle == .dark
                ? UIColor(red: 0.40, green: 0.65, blue: 1.0, alpha: 1)
                : UIColor(red: 0.149, green: 0.388, blue: 0.922, alpha: 1) // #2563eb
            }))
        case .red:
            return Color(UIColor(dynamicProvider: { $0.userInterfaceStyle == .dark
                ? UIColor(red: 1.0, green: 0.40, blue: 0.40, alpha: 1)
                : UIColor(red: 0.863, green: 0.149, blue: 0.149, alpha: 1) // #dc2626
            }))
        case .purple:
            return Color(UIColor(dynamicProvider: { $0.userInterfaceStyle == .dark
                ? UIColor(red: 0.70, green: 0.55, blue: 1.0, alpha: 1)
                : UIColor(red: 0.486, green: 0.227, blue: 0.929, alpha: 1) // #7c3aed
            }))
        case .orange:
            return Color(UIColor(dynamicProvider: { $0.userInterfaceStyle == .dark
                ? UIColor(red: 1.0, green: 0.70, blue: 0.30, alpha: 1)
                : UIColor(red: 0.851, green: 0.467, blue: 0.024, alpha: 1) // #d97706
            }))
        case .gray:
            return Color.secondary
        }
    }

    /// Background fill for a status tone — matches web `--{tone}-bg`.
    /// Dark-mode mixes the text color at low alpha so contrast holds.
    static func statusBackground(_ tone: StatusTone) -> Color {
        switch tone {
        case .green:
            return Color(UIColor(dynamicProvider: { $0.userInterfaceStyle == .dark
                ? UIColor(red: 0.32, green: 0.85, blue: 0.45, alpha: 0.18)
                : UIColor(red: 0.941, green: 0.992, blue: 0.957, alpha: 1) // #f0fdf4
            }))
        case .blue:
            return Color(UIColor(dynamicProvider: { $0.userInterfaceStyle == .dark
                ? UIColor(red: 0.40, green: 0.65, blue: 1.0, alpha: 0.18)
                : UIColor(red: 0.937, green: 0.965, blue: 1.0, alpha: 1) // #eff6ff
            }))
        case .red:
            return Color(UIColor(dynamicProvider: { $0.userInterfaceStyle == .dark
                ? UIColor(red: 1.0, green: 0.40, blue: 0.40, alpha: 0.18)
                : UIColor(red: 0.996, green: 0.949, blue: 0.949, alpha: 1) // #fef2f2
            }))
        case .purple:
            return Color(UIColor(dynamicProvider: { $0.userInterfaceStyle == .dark
                ? UIColor(red: 0.70, green: 0.55, blue: 1.0, alpha: 0.18)
                : UIColor(red: 0.961, green: 0.953, blue: 1.0, alpha: 1) // #f5f3ff
            }))
        case .orange:
            return Color(UIColor(dynamicProvider: { $0.userInterfaceStyle == .dark
                ? UIColor(red: 1.0, green: 0.70, blue: 0.30, alpha: 0.18)
                : UIColor(red: 1.0, green: 0.984, blue: 0.922, alpha: 1) // #fffbeb
            }))
        case .gray:
            return Color.secondary.opacity(0.12)
        }
    }
}
