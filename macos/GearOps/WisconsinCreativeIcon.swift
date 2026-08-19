import AppKit
import SwiftUI

/// Vector Block W taken from the shared icon source
/// `ios/Wisconsin/AppIcons/AppIcon.icon/Assets/BlockW 2.svg`, so the mark stays
/// identical to the compiled app icon at any size.
struct BlockWMark: Shape {
    private static let viewBox = CGSize(width: 371.04, height: 305.88)

    private static let outline: [CGPoint] = [
        CGPoint(x: 371.04, y: 0), CGPoint(x: 264.74, y: 0),
        CGPoint(x: 264.74, y: 56.39), CGPoint(x: 279.14, y: 56.39),
        CGPoint(x: 255.51, y: 133.27), CGPoint(x: 214.55, y: 0.06),
        CGPoint(x: 156.49, y: 0.07), CGPoint(x: 115.57, y: 133.17),
        CGPoint(x: 91.93, y: 56.4), CGPoint(x: 106.3, y: 56.4),
        CGPoint(x: 106.3, y: 0), CGPoint(x: 0, y: 0),
        CGPoint(x: 0, y: 56.4), CGPoint(x: 14.25, y: 56.4),
        CGPoint(x: 91.51, y: 305.86), CGPoint(x: 140.26, y: 305.88),
        CGPoint(x: 185.63, y: 158.74), CGPoint(x: 230.78, y: 305.87),
        CGPoint(x: 279.77, y: 305.86), CGPoint(x: 356.8, y: 56.39),
        CGPoint(x: 371.04, y: 56.39),
    ]

    func path(in rect: CGRect) -> Path {
        let scale = min(rect.width / Self.viewBox.width, rect.height / Self.viewBox.height)
        let drawn = CGSize(width: Self.viewBox.width * scale, height: Self.viewBox.height * scale)
        let origin = CGPoint(x: rect.midX - drawn.width / 2, y: rect.midY - drawn.height / 2)

        var path = Path()
        for (index, point) in Self.outline.enumerated() {
            let resolved = CGPoint(x: origin.x + point.x * scale, y: origin.y + point.y * scale)
            if index == 0 {
                path.move(to: resolved)
            } else {
                path.addLine(to: resolved)
            }
        }
        path.closeSubpath()
        return path
    }
}

/// Resolves the compiled Wisconsin Creative app icon out of the running bundle.
///
/// `NSApplication.applicationIconImage` is deliberately not used: it substitutes
/// Apple's generic application placeholder whenever the icon cannot be resolved
/// and reports no failure, which is exactly what an `LSUIElement` bundle built
/// without compiled icon resources produces. Both lookups below return `nil`
/// when the resource is genuinely absent, so a missing icon falls through to the
/// vector mark instead of rendering a foreign placeholder.
enum WisconsinCreativeIconSource {
    static let bundled: NSImage? = resolveBundledIcon()

    static func resolveBundledIcon(in bundle: Bundle = .main) -> NSImage? {
        if let catalog = bundle.image(forResource: "AppIcon") {
            return catalog
        }
        if let url = bundle.url(forResource: "AppIcon", withExtension: "icns") {
            return NSImage(contentsOf: url)
        }
        return nil
    }
}

/// Wisconsin Creative app identity for in-app surfaces.
struct WisconsinCreativeIcon: View {
    let size: CGFloat

    var body: some View {
        Group {
            if let bundled = WisconsinCreativeIconSource.bundled {
                Image(nsImage: bundled)
                    .resizable()
                    .interpolation(.high)
                    .scaledToFit()
            } else {
                fallbackMark
            }
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }

    /// Mirrors the compiled icon: the icon source's red gradient behind a white
    /// Block W, so a bundle missing its icon still reads as Wisconsin Creative.
    private var fallbackMark: some View {
        RoundedRectangle(cornerRadius: size * 0.225, style: .continuous)
            .fill(
                LinearGradient(
                    colors: [
                        Color(.displayP3, red: 0.71655, green: 0.27252, blue: 0.23420),
                        Color(.displayP3, red: 0.57227, green: 0.10974, blue: 0.06982),
                    ],
                    startPoint: .top,
                    endPoint: .bottom
                )
            )
            .overlay {
                BlockWMark()
                    .fill(.white)
                    .padding(size * 0.19)
            }
    }
}
