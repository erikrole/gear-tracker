import SwiftUI

/// The shared splash scene behind LaunchView, LoginView, and PasswordSetupView.
/// Its base is the exact color used by the system-owned launch screen. The
/// layered light can fade in after SwiftUI takes over without a first-frame
/// color jump.
struct BrandSplashScene: View {
    var accentOpacity = 1.0

    /// Crimson glow — web `rgba(196, 18, 48, 0.55)`.
    private static let crimson = Color(red: 0.769, green: 0.071, blue: 0.188)
    /// Ember glow — web `rgba(160, 0, 0, 0.65)`.
    private static let ember = Color(red: 0.627, green: 0, blue: 0)

    var body: some View {
        ZStack {
            Color.brandSplashTop

            ZStack {
                LinearGradient(
                    stops: [
                        .init(color: .clear, location: 0),
                        .init(color: Color.brandSplashMid.opacity(0.85), location: 0.5),
                        .init(color: .brandSplashBottom, location: 1),
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
            .opacity(accentOpacity)
        }
        .ignoresSafeArea()
        .accessibilityHidden(true)
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
                .frame(width: 72, height: 72)
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

/// Branded launch state shown only while the app has no optimistic session
/// snapshot and is validating `/me`. The lockup stays centered exactly where
/// the system launch image placed it. Progress appears only when validation
/// takes long enough to need an explanation.
struct LaunchView: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var accentsVisible = false
    @State private var restoreProgress: RestoreProgress = .hidden

    private enum RestoreProgress {
        case hidden
        case checking
        case stillChecking

        var label: String? {
            switch self {
            case .hidden: nil
            case .checking: "Checking your session"
            case .stillChecking: "Still checking your session"
            }
        }
    }

    private var accessibilityStatus: String {
        restoreProgress.label ?? "Opening Wisconsin Creative"
    }

    var body: some View {
        ZStack {
            BrandSplashScene(accentOpacity: accentsVisible ? 1 : 0)

            BrandSplashLockup()
                .accessibilityHidden(true)

            if let progressLabel = restoreProgress.label {
                HStack(spacing: 9) {
                    ProgressView()
                        .controlSize(.small)
                        .tint(.white)
                        .accessibilityHidden(true)

                    Text(progressLabel)
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(.white.opacity(0.82))
                        .lineLimit(1)
                }
                .padding(.horizontal, 14)
                .frame(minHeight: 34)
                .background(.white.opacity(0.08), in: Capsule())
                .overlay {
                    Capsule()
                        .strokeBorder(.white.opacity(0.12), lineWidth: 0.5)
                }
                .offset(y: 112)
                .transition(.opacity)
                .accessibilityHidden(true)
            }
        }
        .preferredColorScheme(.dark)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(accessibilityStatus)
        .task {
            if reduceMotion {
                accentsVisible = true
            } else {
                withAnimation(.easeOut(duration: 0.45)) {
                    accentsVisible = true
                }
            }

            do {
                try await Task.sleep(for: .milliseconds(650))
            } catch {
                return
            }
            revealProgress(.checking)
            AccessibilityNotification.Announcement("Checking your session").post()

            do {
                try await Task.sleep(for: .seconds(3.35))
            } catch {
                return
            }
            revealProgress(.stillChecking)
            AccessibilityNotification.Announcement("Still checking your session").post()
        }
    }

    private func revealProgress(_ progress: RestoreProgress) {
        if reduceMotion {
            restoreProgress = progress
        } else {
            withAnimation(.easeIn(duration: 0.2)) {
                restoreProgress = progress
            }
        }
    }
}
