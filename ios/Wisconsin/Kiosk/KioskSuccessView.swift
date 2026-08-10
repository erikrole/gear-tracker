import SwiftUI
import UIKit

struct KioskSuccessView: View {
    @Environment(KioskStore.self) private var store
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    let info: KioskSuccessInfo
    @State private var countdown: Int
    @State private var appeared = false

    init(info: KioskSuccessInfo) {
        self.info = info
        _countdown = State(initialValue: info.earnedBadges.isEmpty ? 5 : 9)
    }

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
        case .returned: return KioskStatus.ok
        case .pickup:   return KioskStatus.attention
        }
    }

    var body: some View {
        VStack(spacing: 28) {
            Spacer()

            successIcon

            VStack(spacing: 14) {
                Text(info.kind.label.uppercased())
                    .font(KioskType.sectionTitle)
                    .tracking(2)
                    .foregroundStyle(accent)

                Text(info.message)
                    .font(.kioskSuccessTitle())
                    .foregroundStyle(KioskText.primary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 48)
            }
            .modifier(EntranceFade(visible: appeared || reduceMotion, reduceMotion: reduceMotion, delay: 0.2))

            if let reward = info.earnedBadges.first {
                KioskBadgeRewardCard(
                    reward: reward,
                    additionalCount: max(0, info.earnedBadges.count - 1)
                )
                .modifier(EntranceFade(visible: appeared || reduceMotion, reduceMotion: reduceMotion, delay: 0.26))
            }

            countdownView
                .modifier(EntranceFade(visible: appeared || reduceMotion, reduceMotion: reduceMotion, delay: 0.3))

            Button {
                skip()
            } label: {
                Text("Done")
                    .font(KioskType.sectionTitle)
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
        .accessibilityLabel(accessibilitySummary)
        .accessibilityAction(named: "Return to home") { skip() }
        .accessibilityAddTraits(.isHeader)
        .onAppear { appeared = true }
        .task {
            Haptics.success()
            UIAccessibility.post(notification: .announcement, argument: accessibilitySummary)
            for i in stride(from: countdown - 1, through: 0, by: -1) {
                try? await Task.sleep(nanoseconds: 1_000_000_000)
                if Task.isCancelled { return }
                countdown = i
            }
            store.deferSleepMode()
            store.screen = .idle
        }
    }

    private var countdownDuration: Int {
        info.earnedBadges.isEmpty ? 5 : 9
    }

    private var accessibilitySummary: String {
        let rewards = info.earnedBadges.map(\.name)
        guard !rewards.isEmpty else { return "\(info.kind.label): \(info.message)" }
        return "\(info.kind.label): \(info.message) Badge earned: \(rewards.joined(separator: ", "))."
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
                .foregroundStyle(KioskStatus.ok)
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
            .font(KioskType.rowDetail)
            .foregroundStyle(KioskText.secondary)
            .monospacedDigit()

            if !reduceMotion {
                ZStack(alignment: .leading) {
                    Capsule()
                        .fill(KioskStroke.divider)
                    Capsule()
                        .fill(accent)
                        .frame(width: 180 * CGFloat(countdown) / CGFloat(countdownDuration))
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

private struct KioskBadgeRewardCard: View {
    let reward: EarnedBadgeReward
    let additionalCount: Int

    private var color: Color {
        switch reward.rarity.lowercased() {
        case "legendary": .purple
        case "rare": KioskStatus.attention
        case "uncommon": KioskStatus.scheduled
        default: Color.kioskRed
        }
    }

    var body: some View {
        HStack(spacing: 18) {
            ZStack {
                Circle().fill(color.opacity(0.18))
                Circle().stroke(color.opacity(0.55), lineWidth: 1.5)
                Image(systemName: reward.symbolName)
                    .font(.system(size: 28, weight: .semibold))
                    .foregroundStyle(color)
            }
            .frame(width: 68, height: 68)

            VStack(alignment: .leading, spacing: 5) {
                Text("BADGE EARNED")
                    .font(KioskType.overline)
                    .tracking(1.5)
                    .foregroundStyle(color)
                Text(reward.name)
                    .font(.gothamBold(size: 22))
                    .foregroundStyle(KioskText.primary)
                Text(reward.description)
                    .font(KioskType.rowDetail)
                    .foregroundStyle(KioskText.secondary)
                    .lineLimit(2)
            }

            Spacer(minLength: 12)

            if additionalCount > 0 {
                Text("+\(additionalCount)")
                    .font(.gothamBold(size: 18))
                    .foregroundStyle(color)
                    .padding(10)
                    .background(color.opacity(0.16), in: Circle())
                    .accessibilityLabel("\(additionalCount) more badges earned")
            }
        }
        .padding(.horizontal, 22)
        .padding(.vertical, 16)
        .frame(maxWidth: 620)
        .background(KioskSurface.card, in: RoundedRectangle(cornerRadius: KioskRadius.lg))
        .overlay(
            RoundedRectangle(cornerRadius: KioskRadius.lg)
                .stroke(color.opacity(0.4), lineWidth: 1.5)
        )
        .shadow(color: color.opacity(0.12), radius: 24, y: 10)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Badge earned. \(reward.name). \(reward.description)")
    }
}
