import SwiftUI

// MARK: - Kiosk screen chrome
//
// Screen-level scaffolding shared by every kiosk screen: the ambient backdrop
// behind the shell's screen switch and the standard screen padding. Leaf
// components live in KioskComponents.swift; tokens live in KioskDesign.swift.

/// Ambient full-screen backdrop mounted once in `KioskShellView` behind every
/// screen. Two static gradients over the base color — a faint brand-red wash
/// from the top-leading corner and a bottom vignette — give the whole kiosk
/// depth without blurs, materials, or animation (safe for an always-on display
/// on older iPads; the red stays ≤ 5% opacity with no hard edges, so there is
/// nothing crisp to burn in).
struct KioskBackdrop: View {
    var body: some View {
        ZStack {
            KioskSurface.base
            RadialGradient(
                colors: [Color.kioskRed.opacity(0.05), .clear],
                center: .topLeading,
                startRadius: 0,
                endRadius: 1100
            )
            LinearGradient(
                colors: [.clear, Color.black.opacity(0.25)],
                startPoint: .center,
                endPoint: .bottom
            )
        }
        .ignoresSafeArea()
        .accessibilityHidden(true)
    }
}

// MARK: - Screen padding

extension View {
    /// Standard edge padding for a kiosk screen's root content: `xl`
    /// horizontal margins, `screenTop` below the hidden status bar, and
    /// `screenBottom` above the home indicator. Replaces the per-screen
    /// 44/36 / 32 / 24/16 / 32/20/32 padding drift.
    func kioskScreenPadding() -> some View {
        self
            .padding(.horizontal, KioskSpacing.xl)
            .padding(.top, KioskSpacing.screenTop)
            .padding(.bottom, KioskSpacing.screenBottom)
    }
}
