import SwiftUI

/// Brand color tokens. Use these instead of raw `Color(red:…)` literals so a
/// future tint change flows everywhere.
extension Color {
    /// Wisconsin red — primary brand color (used for accents, the W mark, etc.).
    static let brandPrimary = Color(red: 0.627, green: 0, blue: 0)

    /// Near-black surface — login hero band, dark splash backgrounds.
    static let brandSurface = Color(red: 0.11, green: 0.11, blue: 0.11)

    /// Slightly lighter surface for disabled / secondary surfaces on the dark band.
    static let brandSurfaceDim = Color(red: 0.18, green: 0.18, blue: 0.18)
}
