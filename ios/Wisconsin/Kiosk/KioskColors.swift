import SwiftUI

extension Color {
    /// Wisconsin red used by every kiosk surface. Single source so brand
    /// updates touch one file instead of five.
    ///
    /// This is `#A00000` — the same `--wi-red` the web app uses. It was
    /// previously `#C5050C`, a hot saturated red sitting in the same hue and
    /// luminance band as the kiosk's error tone (`statusText(.red)`, `#FF6666`
    /// on dark). With brand and alarm indistinguishable on a near-black canvas,
    /// every brand accent and primary button read as a warning.
    ///
    /// The split that `docs/COLOR_SYSTEM.md` depends on: brand red is a deep
    /// *fill* you act on, status red is a lighter *foreground* that means
    /// overdue or error. Never use `kioskRed` to express a status — statuses
    /// come from `KioskStatus`.
    ///
    /// White text on this fill measures ~8.5:1, well past WCAG AA.
    static let kioskRed = Color(red: 160 / 255, green: 0, blue: 0) // #A00000

    /// Pressed state for a brand-red surface, mirroring web `--wi-red-hover`.
    static let kioskRedPressed = Color(red: 144 / 255, green: 0, blue: 0) // #900000

    /// Brand red lifted for use as a *stroke or glyph* on the near-black
    /// canvas, where the `#A00000` fill is too dark to read as a 3pt line.
    /// Strokes and icons only — as a surface fill it drifts back toward the
    /// alarm read this file exists to prevent.
    static let kioskRedGlyph = Color(red: 198 / 255, green: 38 / 255, blue: 38 / 255) // #C62626
}
