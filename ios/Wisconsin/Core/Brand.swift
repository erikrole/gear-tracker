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

// MARK: - Design system foundation
//
// A small, consistent layout vocabulary so screens share the same rhythm and
// card treatment instead of re-deriving padding/radius per view. Pairs with the
// native iOS 26 Liquid Glass controls (`.buttonStyle(.glass/.glassProminent)`,
// material-backed floating controls) the app already uses.

/// Layout tokens — use instead of raw point literals so spacing stays in step.
enum Brand {
    /// Spacing scale (points). `md` is the default gutter.
    enum Space {
        static let xs: CGFloat = 6
        static let sm: CGFloat = 10
        static let md: CGFloat = 14
        static let lg: CGFloat = 20
        static let xl: CGFloat = 28
        static let xxl: CGFloat = 40
    }

    /// Corner-radius scale. `card` is the default container radius.
    enum Radius {
        static let sm: CGFloat = 12
        static let md: CGFloat = 16
        static let card: CGFloat = 20
        static let lg: CGFloat = 26
    }
}

extension Color {
    /// Standard elevated card surface — adapts to light/dark and reads correctly
    /// on a grouped background.
    static let cardSurface = Color(.secondarySystemGroupedBackground)

    /// A slightly raised surface for nested tiles inside a card.
    static let cardSurfaceRaised = Color(.tertiarySystemGroupedBackground)

    /// Hairline stroke tuned for card and divider edges.
    static let hairline = Color(.separator).opacity(0.5)
}

// MARK: - Card surface

private struct BrandCardModifier: ViewModifier {
    var padding: CGFloat
    var radius: CGFloat
    var fill: Color
    var stroke: Bool
    var alignment: Alignment

    func body(content: Content) -> some View {
        content
            .padding(padding)
            .frame(maxWidth: .infinity, alignment: alignment)
            .background(fill, in: RoundedRectangle(cornerRadius: radius, style: .continuous))
            .overlay {
                if stroke {
                    RoundedRectangle(cornerRadius: radius, style: .continuous)
                        .strokeBorder(Color.hairline, lineWidth: 0.5)
                }
            }
            .shadow(color: Color.black.opacity(0.05), radius: 10, x: 0, y: 4)
    }
}

extension View {
    /// Wraps content in the app's standard card: continuous radius, hairline
    /// edge, and a soft shadow. One source of truth for every card surface.
    func brandCard(
        padding: CGFloat = Brand.Space.md,
        radius: CGFloat = Brand.Radius.card,
        fill: Color = .cardSurface,
        stroke: Bool = true,
        alignment: Alignment = .leading
    ) -> some View {
        modifier(BrandCardModifier(padding: padding, radius: radius, fill: fill, stroke: stroke, alignment: alignment))
    }
}

// MARK: - Section header

/// Consistent section header used above grouped card stacks. Optional subtitle,
/// leading SF Symbol, and a trailing accessory (e.g. a "See all" button).
struct SectionHeader<Trailing: View>: View {
    let title: String
    var subtitle: String? = nil
    var systemImage: String? = nil
    @ViewBuilder var trailing: () -> Trailing

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: Brand.Space.sm) {
            if let systemImage {
                Image(systemName: systemImage)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Color.brandPrimary)
                    .accessibilityHidden(true)
            }
            VStack(alignment: .leading, spacing: 1) {
                Text(title)
                    .font(.headline)
                    .foregroundStyle(.primary)
                if let subtitle, !subtitle.isEmpty {
                    Text(subtitle)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            Spacer(minLength: Brand.Space.sm)
            trailing()
        }
        .accessibilityElement(children: .combine)
    }
}

extension SectionHeader where Trailing == EmptyView {
    init(_ title: String, subtitle: String? = nil, systemImage: String? = nil) {
        self.init(title: title, subtitle: subtitle, systemImage: systemImage, trailing: { EmptyView() })
    }
}

// MARK: - Filter chip

/// A selectable pill used for filter/scope strips. Replaces the ad-hoc
/// `.background(.regularMaterial, in: Capsule())` chips scattered across views.
struct FilterChip: View {
    let label: String
    var systemImage: String? = nil
    var isOn: Bool
    var tone: StatusTone = .blue
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                if let systemImage {
                    Image(systemName: systemImage)
                        .font(.caption.weight(.semibold))
                }
                Text(label)
                    .font(.subheadline.weight(.medium))
            }
            .foregroundStyle(isOn ? Color.statusText(tone) : Color.primary)
            .padding(.horizontal, Brand.Space.md)
            .padding(.vertical, Brand.Space.xs)
            .background {
                if isOn {
                    Capsule().fill(Color.statusBackground(tone))
                    Capsule().strokeBorder(Color.statusText(tone).opacity(0.35), lineWidth: 1)
                } else {
                    Capsule().fill(.regularMaterial)
                }
            }
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(isOn ? [.isButton, .isSelected] : .isButton)
    }
}

// MARK: - Stat tile

/// Compact metric tile used on Home and Settings. Tappable when `action` is set.
struct StatTile: View {
    let value: String
    let label: String
    var systemImage: String? = nil
    var tone: StatusTone = .gray
    var action: (() -> Void)? = nil

    var body: some View {
        if let action {
            Button(action: action) { content }
                .buttonStyle(.plain)
        } else {
            content
        }
    }

    private var content: some View {
        VStack(alignment: .leading, spacing: Brand.Space.xs) {
            HStack(spacing: 6) {
                if let systemImage {
                    Image(systemName: systemImage)
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(Color.statusText(tone))
                }
                Spacer(minLength: 0)
            }
            Text(value)
                .font(.title2.weight(.bold))
                .foregroundStyle(tone == .gray ? Color.primary : Color.statusText(tone))
                .lineLimit(1)
                .minimumScaleFactor(0.6)
            Text(label)
                .font(.caption.weight(.medium))
                .foregroundStyle(.secondary)
                .lineLimit(1)
        }
        .brandCard(padding: Brand.Space.md, fill: .cardSurface)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(value) \(label)")
    }
}
