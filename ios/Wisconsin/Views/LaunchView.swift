import SwiftUI

/// The shared splash scene behind LaunchView and LoginView — mirrors the web
/// login's layered background (src/app/globals.css `.login-bg`): a deep
/// Badger-dark base with a crimson glow from the top leading edge and an
/// ember glow from the bottom trailing corner. Both screens draw the exact
/// same scene so the Launch → Login hand-off is a steady-background
/// cross-dissolve.
struct BrandSplashScene: View {
    /// Crimson glow — web `rgba(196, 18, 48, 0.55)`.
    private static let crimson = Color(red: 0.769, green: 0.071, blue: 0.188)
    /// Ember glow — web `rgba(160, 0, 0, 0.65)`.
    private static let ember = Color(red: 0.627, green: 0, blue: 0)

    var body: some View {
        ZStack {
            LinearGradient(
                stops: [
                    .init(color: Color(red: 0.078, green: 0.043, blue: 0.063), location: 0),   // #140b10
                    .init(color: Color(red: 0.133, green: 0.035, blue: 0.051), location: 0.5), // #22090d
                    .init(color: Color(red: 0.227, green: 0.020, blue: 0.035), location: 1),   // #3a0509
                ],
                startPoint: .top,
                endPoint: .bottom
            )

            GeometryReader { geo in
                ZStack {
                    RadialGradient(
                        colors: [Self.crimson.opacity(0.55), .clear],
                        center: UnitPoint(x: 0.15, y: 0),
                        startRadius: 0,
                        endRadius: geo.size.height * 0.9
                    )
                    RadialGradient(
                        colors: [Self.ember.opacity(0.65), .clear],
                        center: UnitPoint(x: 0.9, y: 1),
                        startRadius: 0,
                        endRadius: geo.size.height * 0.8
                    )
                }
            }
        }
        .ignoresSafeArea()
    }
}

/// The brand lockup shared by LaunchView and LoginView — mark + white
/// wordmark sitting directly on the splash scene, matching the web login's
/// lockup-above-the-card composition.
struct BrandSplashLockup: View {
    var subtitle: String? = nil

    var body: some View {
        VStack(spacing: 0) {
            Image("Badgers")
                .resizable()
                .scaledToFit()
                .frame(width: 64, height: 64)
                .shadow(color: .black.opacity(0.35), radius: 10, y: 4)
                .accessibilityHidden(true)
                .padding(.bottom, 14)

            Text("Wisconsin Creative")
                .font(.gothamBlack(size: 26, relativeTo: .title2))
                .foregroundStyle(.white)
                .shadow(color: .black.opacity(0.45), radius: 8, y: 2)

            if let subtitle {
                Text(subtitle)
                    .font(.subheadline)
                    .foregroundStyle(.white.opacity(0.65))
                    .padding(.top, 4)
            }
        }
    }
}

/// Branded launch splash shown while the session is being restored and the app
/// doesn't yet know whether it's headed to Login or the tab shell. It draws
/// the same `BrandSplashScene` and `BrandSplashLockup` as LoginView, so the
/// hand-off into LoginView is a seamless cross-dissolve (steady background,
/// the sign-in card simply fades in) rather than a blank-screen flash. This is
/// the main-app counterpart to the kiosk's `KioskResumeSplash`.
struct LaunchView: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var showsProgress = false

    var body: some View {
        ZStack {
            BrandSplashScene()

            VStack(spacing: 0) {
                BrandSplashLockup()

                // Only reveal the spinner if restore takes a beat, so a fast
                // launch never flashes it.
                ProgressView()
                    .tint(.white)
                    .padding(.top, 24)
                    .opacity(showsProgress ? 1 : 0)
                    .animation(reduceMotion ? nil : .easeIn(duration: 0.2), value: showsProgress)
            }
        }
        .preferredColorScheme(.dark)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Loading Wisconsin Creative")
        .task {
            try? await Task.sleep(for: .milliseconds(500))
            showsProgress = true
        }
    }
}
