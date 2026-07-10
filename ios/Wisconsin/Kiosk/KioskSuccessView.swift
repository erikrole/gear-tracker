import SwiftUI
import UIKit

struct KioskSuccessView: View {
    @Environment(KioskStore.self) private var store
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    let info: KioskSuccessInfo
    @State private var countdown = 5
    @State private var appeared = false

    /// Entrance values driven by the keyframe animators below. The icon pops
    /// in with a small overshoot; the checkmark badge follows a beat later.
    private struct Entrance {
        var scale: CGFloat = 0.6
        var opacity: Double = 0
        var badgeScale: CGFloat = 0
    }

    private var accent: Color {
        switch info.kind {
        case .checkout: return Color.kioskRed
        case .returned: return Color.statusText(.green)
        case .pickup:   return Color.statusText(.orange)
        }
    }

    var body: some View {
        VStack(spacing: 28) {
            Spacer()

            successIcon

            VStack(spacing: 14) {
                Text(info.kind.label.uppercased())
                    .font(.headline.weight(.bold))
                    .tracking(2)
                    .foregroundStyle(accent)

                Text(info.message)
                    .font(.kioskSuccessTitle())
                    .foregroundStyle(KioskText.primary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 48)
            }
            .modifier(EntranceFade(visible: appeared || reduceMotion, reduceMotion: reduceMotion, delay: 0.2))

            countdownView
                .modifier(EntranceFade(visible: appeared || reduceMotion, reduceMotion: reduceMotion, delay: 0.3))

            Button {
                skip()
            } label: {
                Text("Done")
                    .font(.headline)
                    .foregroundStyle(KioskText.primary)
                    .padding(.horizontal, 44)
                    .frame(minHeight: 56)
                    .background(
                        LinearGradient(
                            colors: [Color.kioskRed, Color.kioskRed.opacity(0.85)],
                            startPoint: .top,
                            endPoint: .bottom
                        ),
                        in: Capsule()
                    )
            }
            .buttonStyle(KioskPressStyle())
            .accessibilityLabel("Done — return to home now")
            .modifier(EntranceFade(visible: appeared || reduceMotion, reduceMotion: reduceMotion, delay: 0.3))

            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .contentShape(Rectangle())
        .onTapGesture { skip() }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("\(info.kind.label): \(info.message)")
        .accessibilityAction(named: "Return to home") { skip() }
        .accessibilityAddTraits(.isHeader)
        .onAppear { appeared = true }
        .task {
            Haptics.success()
            UIAccessibility.post(notification: .announcement, argument: "\(info.kind.label). \(info.message)")
            for i in stride(from: 4, through: 0, by: -1) {
                try? await Task.sleep(nanoseconds: 1_000_000_000)
                if Task.isCancelled { return }
                countdown = i
            }
            store.deferSleepMode()
            store.screen = .idle
        }
    }

    // MARK: - Icon moment

    /// Kind-tinted icon in a ring, sitting on a soft radial glow. The glow is
    /// a layout-free background so it can breathe past the cluster's bounds.
    private var successIcon: some View {
        ZStack(alignment: .bottomTrailing) {
            ZStack {
                Circle()
                    .fill(accent.opacity(0.12))
                Circle()
                    .stroke(accent.opacity(0.35), lineWidth: 1.5)
                Image(systemName: info.kind.icon)
                    .font(.system(size: 64))
                    .foregroundStyle(accent)
            }
            .frame(width: 132, height: 132)
            .modifier(IconEntrance(trigger: appeared, reduceMotion: reduceMotion))

            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 40))
                .foregroundStyle(Color.statusText(.green))
                .background(KioskSurface.base, in: Circle())
                .offset(x: 10, y: 10)
                .modifier(BadgeEntrance(trigger: appeared, reduceMotion: reduceMotion))
        }
        .background(
            Circle()
                .fill(
                    RadialGradient(
                        colors: [accent.opacity(0.10), .clear],
                        center: .center,
                        startRadius: 0,
                        endRadius: 210
                    )
                )
                .frame(width: 420, height: 420)
        )
        .accessibilityHidden(true)
    }

    /// Pop-in for the icon ring: fade up while overshooting to 106% and
    /// settling. Holds the settled state after the run. Static under Reduce
    /// Motion.
    private struct IconEntrance: ViewModifier {
        let trigger: Bool
        let reduceMotion: Bool

        func body(content: Content) -> some View {
            if reduceMotion {
                content
            } else {
                content.keyframeAnimator(initialValue: Entrance(), trigger: trigger) { view, value in
                    view
                        .scaleEffect(value.scale)
                        .opacity(value.opacity)
                } keyframes: { _ in
                    KeyframeTrack(\.scale) {
                        SpringKeyframe(1.06, duration: 0.3, spring: .snappy)
                        SpringKeyframe(1.0, duration: 0.2, spring: .smooth)
                    }
                    KeyframeTrack(\.opacity) {
                        LinearKeyframe(1.0, duration: 0.18)
                    }
                }
            }
        }
    }

    /// The green checkmark lands a beat after the icon: held at zero scale for
    /// 0.25s, then springs past full size and settles.
    private struct BadgeEntrance: ViewModifier {
        let trigger: Bool
        let reduceMotion: Bool

        func body(content: Content) -> some View {
            if reduceMotion {
                content
            } else {
                content.keyframeAnimator(initialValue: Entrance(), trigger: trigger) { view, value in
                    view.scaleEffect(value.badgeScale)
                } keyframes: { _ in
                    KeyframeTrack(\.badgeScale) {
                        LinearKeyframe(0, duration: 0.25)
                        SpringKeyframe(1.15, duration: 0.22, spring: .bouncy)
                        SpringKeyframe(1.0, duration: 0.18, spring: .smooth)
                    }
                }
            }
        }
    }

    /// Fade-and-rise entrance for the text/CTA blocks under the icon.
    private struct EntranceFade: ViewModifier {
        let visible: Bool
        let reduceMotion: Bool
        let delay: Double

        func body(content: Content) -> some View {
            content
                .opacity(visible ? 1 : 0)
                .offset(y: visible || reduceMotion ? 0 : 12)
                .animation(reduceMotion ? nil : .easeOut(duration: 0.35).delay(delay), value: visible)
        }
    }

    // MARK: - Countdown

    /// "Returning home" with numeric seconds and a thin draining capsule so
    /// the auto-return is visible at a glance. Decorative — the whole screen
    /// is one tap target and the copy is announced on entry.
    private var countdownView: some View {
        VStack(spacing: 10) {
            HStack(spacing: 5) {
                Text("Returning home in")
                Text("\(countdown)s")
                    .contentTransition(.numericText(countsDown: true))
                    .animation(reduceMotion ? nil : .easeInOut(duration: 0.2), value: countdown)
            }
            .font(.subheadline)
            .foregroundStyle(KioskText.secondary)
            .monospacedDigit()

            if !reduceMotion {
                ZStack(alignment: .leading) {
                    Capsule()
                        .fill(KioskStroke.divider)
                    Capsule()
                        .fill(accent)
                        .frame(width: 180 * CGFloat(countdown) / 5)
                        .animation(.linear(duration: 1), value: countdown)
                }
                .frame(width: 180, height: 4)
            }
        }
        .accessibilityHidden(true)
    }

    /// Tap "Done" or anywhere on the screen to short-circuit the 5 s countdown
    /// and return to idle immediately.
    private func skip() {
        store.deferSleepMode()
        store.screen = .idle
    }
}
