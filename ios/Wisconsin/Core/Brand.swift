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
