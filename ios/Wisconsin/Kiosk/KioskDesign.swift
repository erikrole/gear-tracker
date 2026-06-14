import SwiftUI

// MARK: - Kiosk design tokens
//
// Single source of truth for the kiosk's dark surface scale, hairlines, corner
// radii, text tones, and brand type. Before this file each of the nine kiosk
// screens hand-picked its own near-black background and white-opacity fills
// (12+ ad-hoc values, radii from 9 to 24), which is exactly the route-level
// drift `docs/DESIGN_LANGUAGE.md` warns about. Mirrors how `Core/Brand.swift`
// centralizes the web-facing tokens.
//
// The kiosk is always dark (`KioskShellView` forces `.dark`), so these are
// fixed dark values rather than dynamic light/dark providers. Semantic status
// color still comes from `Color.statusText(_:)` in Brand.swift; the brand
// accent stays `Color.kioskRed` in KioskColors.swift.

/// Background and fill elevation scale. `base` is the full-screen backdrop;
/// the rest are translucent whites layered on top so they read consistently
/// over the dark base.
enum KioskSurface {
    /// Full-screen kiosk backdrop. One value for every screen (shell,
    /// activation, sheets) so screens never drift to slightly different blacks.
    static let base = Color(red: 11 / 255, green: 11 / 255, blue: 13 / 255) // #0B0B0D

    /// Large sunken areas -- the scrolling list panels beside a scan zone.
    static let sunken = Color.white.opacity(0.02)

    /// Quiet grouped container (dashboard list shells, top bars).
    static let low = Color.white.opacity(0.045)

    /// Standard card / row fill (battery status, checklist rows, event detail rows).
    static let card = Color.white.opacity(0.06)

    /// Interactive tile fill (numpad keys, roster tiles, stat tiles, action rows).
    static let cardRaised = Color.white.opacity(0.08)

    /// Selected interactive tile (a chosen stat tile).
    static let cardSelected = Color.white.opacity(0.13)

    /// Avatar / chip placeholder fill.
    static let placeholder = Color.white.opacity(0.16)

    /// Raised modal surface -- scrims, overlays, confirmation cards.
    static let modal = Color(red: 22 / 255, green: 22 / 255, blue: 26 / 255) // #16161A
}

/// Hairline stroke scale for card/tile separation on the dark base.
enum KioskStroke {
    static let hairline = Color.white.opacity(0.08)
    static let standard = Color.white.opacity(0.12)
    static let strong = Color.white.opacity(0.16)
    static let selected = Color.white.opacity(0.5)
    /// Divider lines between rows / panels.
    static let divider = Color.white.opacity(0.1)
}

/// Corner-radius scale. Operational controls stay small; only hero brand
/// surfaces (activation card, scan frame) use the largest radius.
enum KioskRadius {
    static let sm: CGFloat = 10   // small rows, asset thumbnails, chips
    static let md: CGFloat = 12   // standard cards, rows, banners
    static let lg: CGFloat = 14   // panels, primary buttons
    static let xl: CGFloat = 16   // stat tiles
    static let modal: CGFloat = 20 // confirmation cards
    static let hero: CGFloat = 24 // activation card, scan frame
}

/// Foreground text tones on the dark base. Named rungs replace the long tail
/// of `Color.white.opacity(...)` literals for the common cases.
enum KioskText {
    static let primary = Color.white
    static let secondary = Color.white.opacity(0.72)
    static let tertiary = Color.white.opacity(0.55)
    static let muted = Color.white.opacity(0.4)
}

// MARK: - Card modifier

extension View {
    /// Standard kiosk card treatment: translucent fill + matching rounded
    /// stroke. Collapses the repeated
    /// `.background(fill, in: RoundedRectangle).overlay(RoundedRectangle.stroke)`
    /// pattern that appeared on nearly every kiosk row and tile.
    func kioskCard(
        _ fill: Color = KioskSurface.card,
        radius: CGFloat = KioskRadius.md,
        stroke: Color = KioskStroke.standard,
        lineWidth: CGFloat = 1
    ) -> some View {
        self
            .background(fill, in: RoundedRectangle(cornerRadius: radius))
            .overlay(
                RoundedRectangle(cornerRadius: radius)
                    .stroke(stroke, lineWidth: lineWidth)
            )
    }
}

// MARK: - Feedback tone

/// Shared scan/feedback tone used by the in-flow feedback banner and the
/// camera overlay. Each kiosk flow keeps its own domain `ScanFeedback` enum
/// (flow-specific copy) but maps to this for rendering, so the banner looks
/// identical everywhere.
enum KioskBannerTone {
    case success, error, warning

    var color: Color {
        switch self {
        case .success: Color.statusText(.green)
        case .error:   Color.statusText(.red)
        case .warning: Color.statusText(.orange)
        }
    }

    var icon: String {
        switch self {
        case .success: "checkmark.circle.fill"
        case .error:   "xmark.circle.fill"
        case .warning: "exclamationmark.triangle.fill"
        }
    }
}

// MARK: - Brand type (kiosk brand moments)

extension Font {
    /// Activation hero title -- the biggest brand moment on the kiosk.
    static func kioskHeroTitle(size: CGFloat = 44) -> Font { .gothamBlack(size: size) }

    /// Flow screen titles (Checkout / Pickup / Return). Gotham mirrors the web
    /// `PageHeader`, making the kiosk read as the "little brother of web."
    static func kioskScreenTitle(size: CGFloat = 24) -> Font { .gothamBold(size: size) }

    /// Terminal success message.
    static func kioskSuccessTitle(size: CGFloat = 28) -> Font { .gothamBold(size: size) }
}
