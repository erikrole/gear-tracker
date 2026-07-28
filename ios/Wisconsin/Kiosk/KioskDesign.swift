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

/// Dimming scrims layered *over* content (full-screen modal backdrops, floating
/// controls on top of the live camera). These are black-based — unlike
/// `KioskSurface`, which is white-on-dark elevation — so screens stop reaching
/// for ad-hoc `Color.black.opacity(...)` values.
enum KioskScrim {
    /// Full-screen backdrop behind a modal/confirmation card.
    static let modal = Color.black.opacity(0.7)
    /// Floating control pill resting on top of the live camera feed.
    static let control = Color.black.opacity(0.5)
    /// Manual-entry field panel over the camera feed.
    static let field = Color.black.opacity(0.58)
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

/// Spacing scale. Named rungs replace the drifting per-screen padding combos
/// (44/36 on activation, 32 on idle, 24/16 on the hub, 32/20/32 on checkout).
enum KioskSpacing {
    static let xs: CGFloat = 8    // chip gaps, row internals
    static let sm: CGFloat = 12   // intra-card stacks
    static let md: CGFloat = 16   // card padding, grid gutters
    static let lg: CGFloat = 24   // section gaps, panel padding (compact)
    static let xl: CGFloat = 32   // screen margins, panel padding (regular)
    /// Below the hidden status bar at the top of every screen.
    static let screenTop: CGFloat = 24
    static let screenBottom: CGFloat = 32
}

/// Shared layout dimensions that were previously inline magic numbers
/// recomputed per screen.
enum KioskLayout {
    /// Right-hand rail beside a scan zone (checkout items list and the
    /// pickup/return checklist share one width).
    static let sideRail: CGFloat = 430
    /// Checkout-setup form cards.
    static let formMaxWidth: CGFloat = 760
    /// Activation card in the wide layout.
    static let activationCardWidth: CGFloat = 450
    /// Below this width (or at accessibility sizes) two-panel screens stack.
    static let compactBreakpoint: CGFloat = 880
    /// Idle roster panel width: 42% of the screen, clamped so tiles stay
    /// tappable on 11" and the grid doesn't sprawl on 13".
    static func rosterWidth(for totalWidth: CGFloat) -> CGFloat {
        min(max(totalWidth * 0.42, 430), 560)
    }
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
    /// Depth comes from two restrained static gradients rather than blurs or
    /// shadows (the kiosk is an always-on display): a faint
    /// top glaze inside the shape and a stroke that fades toward the bottom,
    /// so every card reads as lit from above. Both layer over the caller's
    /// fill, so tinted cards (selected event chips, banners) keep working.
    func kioskCard(
        _ fill: Color = KioskSurface.card,
        radius: CGFloat = KioskRadius.md,
        stroke: Color = KioskStroke.standard,
        lineWidth: CGFloat = 1
    ) -> some View {
        self
            .background(fill, in: RoundedRectangle(cornerRadius: radius))
            .overlay(
                LinearGradient(
                    colors: [Color.white.opacity(0.04), .clear],
                    startPoint: .top,
                    endPoint: .center
                )
                .clipShape(RoundedRectangle(cornerRadius: radius))
                .allowsHitTesting(false)
            )
            .overlay(
                RoundedRectangle(cornerRadius: radius)
                    .stroke(
                        LinearGradient(
                            colors: [stroke, stroke.opacity(0.35)],
                            startPoint: .top,
                            endPoint: .bottom
                        ),
                        lineWidth: lineWidth
                    )
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

// MARK: - Type ramp

/// The kiosk reading order, in one place.
///
/// Before this, every screen picked from the raw system ramp
/// (`.title3.bold()`, `.headline`, `.subheadline.weight(.semibold)`,
/// `.caption.weight(.bold)`) at each call site, so two sibling cards could
/// disagree about what "a card title" is and nothing established what to read
/// first. These rungs are named for their *job on the screen*, not their size,
/// and they are what new kiosk UI should reach for.
///
/// Gotham carries identity and custody nouns (names, item titles, big numbers)
/// because that mirrors the web `PageHeader`; the system face carries prose,
/// because Gotham at small sizes on an always-on panel is hard to read.
/// All rungs stay Dynamic Type responsive via `.custom(_:size:relativeTo:)`
/// inside the Gotham helpers and the system ramp elsewhere.
enum KioskType {
    /// Screen-owning title. One per screen, at most.
    static var screenTitle: Font { .gothamBold(size: 26) }

    /// The identity moment: a student's name on the hub, the roster headline.
    static var identity: Font { .gothamBold(size: 34) }

    /// A number that is the point of its tile (stat counts, unit numbers).
    static var metric: Font { .gothamBlack(size: 40) }

    /// Section owner inside a panel ("Items", "Coming Up", "Scan Wiscard").
    static var sectionTitle: Font { .headline.weight(.bold) }

    /// Primary line of a row or card -- an item name, an action label.
    static var rowTitle: Font { .gothamBold(size: 16) }

    /// Hero action label, larger than a normal row because it is the one thing
    /// the screen wants tapped.
    static var actionTitle: Font { .title3.weight(.bold) }

    /// Supporting line under a title.
    static var rowDetail: Font { .subheadline }

    /// Body prose in empty states and explanations.
    static var body: Font { .subheadline }

    /// All-caps overline above a group ("YOUR SESSION", "GOOD MORNING").
    /// Always pair with `.tracking(1.2)` and `KioskText.muted`.
    static var overline: Font { .caption.weight(.bold) }

    /// Chip, badge, and timestamp text.
    static var chip: Font { .caption.weight(.semibold) }

    /// The smallest readable rung. Use sparingly -- students read this from
    /// arm's length at a counter.
    static var micro: Font { .caption2.weight(.semibold) }
}

// MARK: - Status language

/// One meaning per color, kiosk-wide.
///
/// The kiosk previously spent blue, green, orange, and white on overlapping
/// ideas -- "scanner ready" rendered white in the shell pill, blue in the
/// readiness badge, and green in the detail sheet, two of them visible at once.
/// Red is reserved: it is the brand accent and the primary-action color, so it
/// never doubles as a generic "warning" tint.
enum KioskStatus {
    /// Available / free. Also: scanner armed, item accepted.
    /// Never use for an active checkout — the item is not free.
    static let ok = Color.statusText(.green)

    /// Active use: an `OPEN` checkout, gear currently out with someone, a
    /// mutation in flight. This — not red — is what "checked out" looks like.
    static let active = Color.statusText(.blue)

    /// Reserved / claimed but not yet out: `BOOKED` reservations.
    static let scheduled = Color.statusText(.purple)

    /// Warning / waiting: pending pickup, scanner reconnecting, and an `OPEN`
    /// checkout on the day it comes due.
    static let attention = Color.statusText(.orange)

    /// Urgent / problem: overdue, errors, destructive actions. Deliberately
    /// distinct from `Color.kioskRed`, which is brand chrome you tap.
    static let problem = Color.statusText(.red)

    /// Custody urgency ramp for an `OPEN` checkout, mirroring the iOS app's
    /// `queueGearTone` and the deadline overlay sanctioned in
    /// `docs/COLOR_SYSTEM.md`: blue while it is simply out, orange on the day
    /// it is due, red once it is past due.
    static func custody(isOverdue: Bool, dueAt: Date) -> Color {
        if isOverdue { return problem }
        return Calendar.current.isDateInToday(dueAt) ? attention : active
    }
}

// MARK: - Button hierarchy

/// What a button is *for*, so call sites stop choosing a style and a tint.
///
/// The rule the kiosk was missing: brand red means "this is the action this
/// screen exists for." Everything else is quieter. A destructive action is red
/// too, but only ever inside a confirmation path, never competing with a
/// primary CTA for the same glance.
enum KioskButtonRole {
    /// The one action the screen is for. Brand red, prominent glass.
    case primary
    /// A supporting action -- Save, Edit, Camera. Neutral glass.
    case secondary
    /// Removes custody or data. Red, but compact and never hero-sized.
    case destructive
}

extension View {
    /// Applies the kiosk button hierarchy. Pair with `.controlSize(_:)` when a
    /// call site genuinely needs a different footprint.
    @ViewBuilder
    func kioskButtonRole(_ role: KioskButtonRole) -> some View {
        switch role {
        case .primary:
            self.buttonStyle(.glassProminent).tint(Color.kioskRed)
        case .secondary:
            self.buttonStyle(.glass).tint(KioskText.primary)
        case .destructive:
            self.buttonStyle(.bordered).tint(KioskStatus.problem)
        }
    }
}
