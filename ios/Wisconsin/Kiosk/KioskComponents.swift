import SwiftUI
import UIKit

// MARK: - Shared kiosk components
//
// One implementation each for UI that was previously copied across the kiosk
// flows: the feedback banner existed in four places, the scan-zone header /
// progress ring / battery status / unit chips / error state / completion CTA
// in two or three each. Centralizing them kills the drift (so a polish change
// lands everywhere at once) and lets every flow share the same hit targets,
// motion, and color rules. Pure presentation -- no business logic.

// MARK: Flow header

/// Back · centered title (optional subtitle) · optional trailing content ·
/// optional camera. The title is optically centered via an overlay so unequal
/// side widths don't shift it. Buttons keep a 44pt touch target per
/// `docs/DESIGN_LANGUAGE.md`. The trailing slot lets screens hang their own
/// content (e.g. the student hub's avatar + name) off the shared header
/// instead of hand-rolling a top bar.
struct KioskFlowHeader<Trailing: View>: View {
    let title: String
    var subtitle: String?
    var backAccessibilityLabel: String = "Back to roster"
    let onBack: () -> Void
    var onCamera: (() -> Void)?
    @ViewBuilder var trailing: () -> Trailing

    var body: some View {
        HStack(spacing: KioskSpacing.sm) {
            KioskHeaderButton(
                systemImage: "chevron.left",
                label: "Back",
                accessibilityLabel: backAccessibilityLabel,
                action: onBack
            )
            Spacer(minLength: 0)
            trailing()
            if let onCamera {
                KioskHeaderButton(
                    systemImage: "camera.fill",
                    label: "Camera",
                    accessibilityLabel: "Use camera to scan instead",
                    action: onCamera
                )
            } else if Trailing.self == EmptyView.self {
                Color.clear.frame(width: 44, height: 44)
            }
        }
        .overlay {
            VStack(spacing: 2) {
                Text(title)
                    .font(.kioskScreenTitle())
                    .foregroundStyle(KioskText.primary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
                    .accessibilityAddTraits(.isHeader)
                if let subtitle {
                    Text(subtitle)
                        .font(.caption.weight(.medium))
                        .foregroundStyle(KioskText.tertiary)
                        .lineLimit(1)
                }
            }
            .allowsHitTesting(false)
        }
    }
}

extension KioskFlowHeader where Trailing == EmptyView {
    /// Existing call-site shape: back · title · optional camera.
    init(
        title: String,
        subtitle: String? = nil,
        backAccessibilityLabel: String = "Back to roster",
        onBack: @escaping () -> Void,
        onCamera: (() -> Void)? = nil
    ) {
        self.init(
            title: title,
            subtitle: subtitle,
            backAccessibilityLabel: backAccessibilityLabel,
            onBack: onBack,
            onCamera: onCamera,
            trailing: { EmptyView() }
        )
    }
}

private struct KioskHeaderButton: View {
    let systemImage: String
    let label: String
    let accessibilityLabel: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Label(label, systemImage: systemImage)
                .font(.subheadline.weight(.medium))
                .foregroundStyle(KioskText.primary)
                .padding(.horizontal, 6)
                .frame(minHeight: 44)
                .contentShape(Rectangle())
        }
        .buttonStyle(.glass)
        .controlSize(.regular)
        .accessibilityLabel(accessibilityLabel)
    }
}

// MARK: Section icon

/// Leading glyph for a card section header: a tinted rounded square instead of
/// a bare SF Symbol floating in space. Purely decorative.
struct KioskSectionIcon: View {
    let systemImage: String
    var tint: Color = Color.kioskRed
    var size: CGFloat = 40

    var body: some View {
        RoundedRectangle(cornerRadius: KioskRadius.sm)
            .fill(tint.opacity(0.14))
            .frame(width: size, height: size)
            .overlay {
                Image(systemName: systemImage)
                    .font(.system(size: size * 0.42, weight: .semibold))
                    .foregroundStyle(tint)
            }
            .accessibilityHidden(true)
    }
}

// MARK: Scan target

/// The scan-zone focal point: viewfinder corner brackets around a barcode
/// glyph, tinted by the flow's scan-feedback color. The brackets breathe
/// gently while waiting for a scan (static under Reduce Motion).
struct KioskScanTarget: View {
    var tint: Color
    var width: CGFloat = 220
    var height: CGFloat = 140
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        ZStack {
            brackets
            Image(systemName: "barcode.viewfinder")
                .font(.system(size: 56))
                .foregroundStyle(tint)
        }
        .frame(width: width, height: height)
        .accessibilityHidden(true)
    }

    @ViewBuilder
    private var brackets: some View {
        let shape = KioskCornerBrackets()
            .stroke(tint, style: StrokeStyle(lineWidth: 3, lineCap: .round))
        if reduceMotion {
            shape
        } else {
            shape.phaseAnimator([0.55, 1.0]) { view, phase in
                view.opacity(phase)
            } animation: { _ in
                .easeInOut(duration: 1.6)
            }
        }
    }
}

/// Four rounded viewfinder corners.
private struct KioskCornerBrackets: Shape {
    var arm: CGFloat = 26
    var radius: CGFloat = 20

    func path(in rect: CGRect) -> Path {
        var path = Path()

        // Top-leading
        path.move(to: CGPoint(x: rect.minX, y: rect.minY + arm))
        path.addArc(
            tangent1End: CGPoint(x: rect.minX, y: rect.minY),
            tangent2End: CGPoint(x: rect.minX + arm, y: rect.minY),
            radius: radius
        )
        path.addLine(to: CGPoint(x: rect.minX + arm, y: rect.minY))

        // Top-trailing
        path.move(to: CGPoint(x: rect.maxX - arm, y: rect.minY))
        path.addArc(
            tangent1End: CGPoint(x: rect.maxX, y: rect.minY),
            tangent2End: CGPoint(x: rect.maxX, y: rect.minY + arm),
            radius: radius
        )
        path.addLine(to: CGPoint(x: rect.maxX, y: rect.minY + arm))

        // Bottom-trailing
        path.move(to: CGPoint(x: rect.maxX, y: rect.maxY - arm))
        path.addArc(
            tangent1End: CGPoint(x: rect.maxX, y: rect.maxY),
            tangent2End: CGPoint(x: rect.maxX - arm, y: rect.maxY),
            radius: radius
        )
        path.addLine(to: CGPoint(x: rect.maxX - arm, y: rect.maxY))

        // Bottom-leading
        path.move(to: CGPoint(x: rect.minX + arm, y: rect.maxY))
        path.addArc(
            tangent1End: CGPoint(x: rect.minX, y: rect.maxY),
            tangent2End: CGPoint(x: rect.minX, y: rect.maxY - arm),
            radius: radius
        )
        path.addLine(to: CGPoint(x: rect.minX, y: rect.maxY - arm))

        return path
    }
}

// MARK: Feedback banner

/// Tinted icon + message banner used for scan results across every flow and
/// the camera overlay. Replaces four near-identical private copies.
struct KioskFeedbackBanner: View {
    let tone: KioskBannerTone
    let message: String

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: tone.icon).accessibilityHidden(true)
            Text(message).font(.subheadline.weight(.medium))
        }
        .foregroundStyle(tone.color)
        .padding(.horizontal, 20)
        .padding(.vertical, 12)
        .background(tone.color.opacity(0.15), in: RoundedRectangle(cornerRadius: KioskRadius.md))
        .overlay(
            RoundedRectangle(cornerRadius: KioskRadius.md)
                .stroke(tone.color.opacity(0.4), lineWidth: 1)
        )
        .accessibilityElement(children: .combine)
    }
}

// MARK: Progress ring

/// Count-of-total scan progress ring. In-progress stroke is blue (active
/// progress) and turns green on completion -- one rule for both pickup and
/// return, which previously used red and blue respectively.
struct KioskProgressRing: View {
    let count: Int
    let total: Int
    let isComplete: Bool
    let reduceMotion: Bool
    var inProgressColor: Color = Color.statusText(.blue)
    var size: CGFloat = 176
    var accessibilityText: String?

    var body: some View {
        ZStack {
            Circle()
                .stroke(KioskStroke.divider, lineWidth: 10)
            Circle()
                .trim(from: 0, to: total > 0 ? CGFloat(count) / CGFloat(total) : 0)
                .stroke(
                    isComplete ? Color.statusText(.green) : inProgressColor,
                    style: StrokeStyle(lineWidth: 10, lineCap: .round)
                )
                .rotationEffect(.degrees(-90))
                .animation(reduceMotion ? nil : .spring(response: 0.4), value: count)
            VStack(spacing: 2) {
                Text("\(count)")
                    .font(.system(size: 52, weight: .bold, design: .rounded))
                    .foregroundStyle(KioskText.primary)
                    .contentTransition(.numericText())
                    .animation(reduceMotion ? nil : .easeInOut(duration: 0.25), value: count)
                    .monospacedDigit()
                Text("of \(total)")
                    .font(.subheadline)
                    .foregroundStyle(KioskText.tertiary)
            }
        }
        .frame(width: size, height: size)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(accessibilityText ?? "\(count) of \(total)")
    }
}

// MARK: Completion CTA

/// Primary bottom action for the scan flows (Complete Checkout / Confirm
/// Pickup / Complete Return). Native prominent glass carries the shared
/// interactive hierarchy while disabled and busy states stay system-driven.
struct KioskCompletionButton: View {
    let title: String
    var icon: String?
    let isEnabled: Bool
    let isBusy: Bool
    var busyTitle: String = "Processing..."
    let accessibilityLabel: String
    let action: () -> Void

    private var isActive: Bool { isEnabled && !isBusy }

    var body: some View {
        Button(action: action) {
            HStack(spacing: 10) {
                if !isBusy, let icon {
                    Image(systemName: icon)
                        .font(.headline)
                        .accessibilityHidden(true)
                }
                Text(isBusy ? busyTitle : title)
                    .font(.headline)
                if isBusy {
                    ProgressView().tint(.white).scaleEffect(0.8)
                }
            }
            .foregroundStyle(KioskText.primary)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 16)
        }
        .buttonStyle(.glassProminent)
        .tint(Color.kioskRed)
        .controlSize(.large)
        .disabled(!isActive)
        .accessibilityLabel(accessibilityLabel)
    }
}

// MARK: Checklist row

/// A single scannable line in the pickup/return checklist. `strikethroughWhenDone`
/// is true for returns (the item is leaving) and false for pickups (the item is
/// being confirmed into the student's hands).
struct KioskChecklistRow: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    let name: String
    let tag: String
    let isDone: Bool
    var isBattery: Bool = false
    var strikethroughWhenDone: Bool = false

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: isDone ? "checkmark.circle.fill" : "circle")
                .foregroundStyle(isDone ? Color.statusText(.green) : KioskText.muted)
                .font(.title3)
                .frame(width: 28)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text(tag)
                        .font(.gothamBold(size: 16))
                        .foregroundStyle(isDone ? KioskText.tertiary : KioskText.primary)
                        .strikethrough(isDone && strikethroughWhenDone, color: KioskText.muted)
                    if isBattery {
                        Image(systemName: "battery.100percent")
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(Color.statusText(.orange))
                            .accessibilityLabel("Battery unit")
                    }
                }
                // Hide the name line when it just repeats the tag so
                // rows stay scannable.
                if tag.caseInsensitiveCompare(name) != .orderedSame {
                    Text(name)
                        .font(.caption)
                        .foregroundStyle(KioskText.tertiary)
                }
            }
            Spacer()
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 16)
        .animation(reduceMotion ? nil : .spring(response: 0.25, dampingFraction: 1), value: isDone)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(tag), \(name), \(isDone ? "done" : "pending")")
    }
}

// MARK: Checklist progress summary

/// "n of m <verb>" line + thin progress bar for the pickup/return checklist
/// header. In-progress fill is blue (matching `KioskProgressRing`), green when
/// complete. Shared by pickup ("confirmed") and return ("returned").
struct ChecklistProgressSummary: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    let done: Int
    let total: Int
    let verb: String
    let complete: Bool
    var inProgressColor: Color = Color.statusText(.blue)

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("\(done) of \(total) \(verb)")
                .font(.caption.weight(.semibold).monospacedDigit())
                .foregroundStyle(complete ? Color.statusText(.green) : KioskText.secondary)
                .contentTransition(.numericText())
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule()
                        .fill(KioskStroke.divider)
                    Capsule()
                        .fill(complete ? Color.statusText(.green) : inProgressColor)
                        .frame(width: total > 0 ? geo.size.width * CGFloat(done) / CGFloat(total) : 0)
                        .animation(reduceMotion ? nil : .spring(response: 0.4, dampingFraction: 1), value: done)
                }
            }
            .frame(height: 4)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(done) of \(total) \(verb)")
    }
}

// MARK: Battery scan status

/// A scanned numbered battery unit, decoupled from the pickup/return payload
/// types so both flows feed the shared chips/status views.
struct KioskScannedUnit: Identifiable, Equatable {
    let id: String
    let tag: String
}

/// Numbered-battery scan progress card shown above the flow CTA. `unitsHeader`
/// differs by flow ("Scanned units" vs "Returned units").
struct KioskBatteryScanStatus: View {
    let title: String
    let count: Int
    let total: Int
    let pendingCopy: String
    let completeCopy: String
    let progressCopy: String
    let unitsHeader: String
    let scannedUnits: [KioskScannedUnit]

    private var complete: Bool { count >= total && total > 0 }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 10) {
                Image(systemName: complete ? "battery.100percent" : "battery.25percent")
                    .font(.title3)
                    .foregroundStyle(complete ? Color.statusText(.green) : Color.statusText(.orange))
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(KioskText.primary)
                    Text(complete ? completeCopy : progressCopy)
                        .font(.caption.monospacedDigit())
                        .foregroundStyle(KioskText.tertiary)
                    if !complete {
                        Text(pendingCopy)
                            .font(.caption2)
                            .foregroundStyle(KioskText.tertiary)
                    }
                }
                Spacer()
            }
            if !scannedUnits.isEmpty {
                VStack(alignment: .leading, spacing: 6) {
                    Text(unitsHeader)
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(KioskText.tertiary)
                    KioskUnitChips(units: scannedUnits)
                }
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .kioskCard(KioskSurface.card, stroke: KioskStroke.hairline)
        .accessibilityElement(children: .combine)
    }
}

/// Wrapping row of scanned numbered-unit tag chips.
struct KioskUnitChips: View {
    let units: [KioskScannedUnit]

    var body: some View {
        ViewThatFits(in: .horizontal) {
            HStack(spacing: 6) { chipContent }
            VStack(alignment: .leading, spacing: 6) { chipContent }
        }
    }

    @ViewBuilder
    private var chipContent: some View {
        ForEach(units) { unit in
            Text(unit.tag)
                .font(.caption2.monospaced().weight(.semibold))
                .foregroundStyle(Color.statusText(.green))
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(Color.statusText(.green).opacity(0.12), in: Capsule())
                .overlay(Capsule().stroke(Color.statusText(.green).opacity(0.25), lineWidth: 1))
        }
    }
}

// MARK: Error state

/// Connection/load error with an optional message and a brand retry button.
/// Replaces the per-flow `wifi.exclamationmark` + retry blocks.
struct KioskErrorState: View {
    var icon: String = "wifi.exclamationmark"
    let title: String
    var message: String?
    var retryTitle: String = "Try again"
    let onRetry: () -> Void

    var body: some View {
        VStack(spacing: 14) {
            Image(systemName: icon)
                .font(.system(size: 44))
                .foregroundStyle(KioskText.tertiary)
                .accessibilityHidden(true)
            Text(title)
                .font(.headline)
                .foregroundStyle(KioskText.primary)
                .multilineTextAlignment(.center)
            if let message {
                Text(message)
                    .font(.subheadline)
                    .foregroundStyle(KioskText.tertiary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 32)
            }
            Button(action: onRetry) {
                Text(retryTitle)
                    .font(.headline)
                    .foregroundStyle(KioskText.primary)
                    .padding(.horizontal, 24)
                    .frame(minHeight: 44)
                    .background(Color.kioskRed, in: Capsule())
            }
            .buttonStyle(.plain)
            .accessibilityLabel(retryTitle)
        }
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .contain)
    }
}

// MARK: Skeleton

/// A shimmering placeholder block for loading states — softer than a bare
/// spinner and matches the dark kiosk surfaces. Respects Reduce Motion (it
/// holds a static dim fill instead of animating).
struct KioskSkeletonBox: View {
    var cornerRadius: CGFloat = KioskRadius.md
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var animate = false

    var body: some View {
        RoundedRectangle(cornerRadius: cornerRadius)
            .fill(KioskSurface.cardRaised)
            .overlay {
                if !reduceMotion {
                    GeometryReader { geo in
                        RoundedRectangle(cornerRadius: cornerRadius)
                            .fill(
                                LinearGradient(
                                    colors: [.clear, Color.white.opacity(0.07), .clear],
                                    startPoint: .leading,
                                    endPoint: .trailing
                                )
                            )
                            .frame(width: geo.size.width * 0.6)
                            .offset(x: animate ? geo.size.width : -geo.size.width * 0.6)
                    }
                }
            }
            .clipShape(RoundedRectangle(cornerRadius: cornerRadius))
            .onAppear {
                guard !reduceMotion else { return }
                withAnimation(.linear(duration: 1.15).repeatForever(autoreverses: false)) {
                    animate = true
                }
            }
            .accessibilityHidden(true)
    }
}

// MARK: Avatar

/// Async avatar with an initials fallback, used by the roster, student hub,
/// active-checkout rows, and event worker rows. Initials type scales with size.
struct KioskAvatar: View {
    let url: String?
    let initials: String
    var size: CGFloat = 42
    var placeholderFill: Color = KioskSurface.placeholder

    var body: some View {
        Group {
            if let url, let resolved = URL(string: url) {
                AsyncImage(url: resolved) { phase in
                    switch phase {
                    case .success(let image):
                        image.resizable().scaledToFill()
                    default:
                        initialsView
                    }
                }
            } else {
                initialsView
            }
        }
        .frame(width: size, height: size)
        .clipShape(Circle())
    }

    private var initialsView: some View {
        Circle()
            .fill(placeholderFill)
            .overlay {
                Text(initials)
                    .font(.system(size: size * 0.4, weight: .bold))
                    .foregroundStyle(KioskText.primary)
            }
    }
}

// MARK: Press style

/// Subtle press-scale + dim for kiosk tap targets (roster tiles, stat tiles,
/// event rows). Gives tactile feedback on the iPad without shifting layout, and
/// reads as "plain" otherwise — a drop-in for `.buttonStyle(.plain)` on the
/// kiosk's large touch surfaces. Honors Reduce Motion.
struct KioskPressStyle: ButtonStyle {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    var scale: CGFloat = 0.97

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed && !reduceMotion ? scale : 1)
            .opacity(configuration.isPressed ? 0.9 : 1)
            .animation(reduceMotion ? nil : .spring(response: 0.25, dampingFraction: 0.7), value: configuration.isPressed)
    }
}

// MARK: Keyboard hint

/// "No keyboard?" helper for UIKit-backed kiosk text fields. When a paired HID
/// scanner is awake, iPadOS treats it as a hardware keyboard and suppresses
/// the software keyboard — the field focuses but nothing comes up, which reads
/// as "typing is broken". While `isFieldFocused` is true this watches keyboard
/// frame notifications; if no real keyboard lands within a short grace it
/// surfaces the scanner double-press trick. It disappears the moment a
/// keyboard shows or focus ends, so scanner-off flows never see it.
struct KioskKeyboardHint: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    let isFieldFocused: Bool

    @State private var keyboardVisible = false
    @State private var showTip = false

    private var waitingForKeyboard: Bool { isFieldFocused && !keyboardVisible }

    var body: some View {
        Group {
            if showTip {
                HStack(spacing: 8) {
                    Image(systemName: "keyboard.badge.ellipsis")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(Color.kioskRed)
                    Text("Keyboard not showing? Double-press the scanner button to bring it up.")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(KioskText.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(KioskSurface.sunken, in: RoundedRectangle(cornerRadius: KioskRadius.sm))
                .overlay(
                    RoundedRectangle(cornerRadius: KioskRadius.sm)
                        .stroke(Color.kioskRed.opacity(0.35), lineWidth: 1)
                )
                .transition(.opacity)
                .accessibilityLabel("Keyboard not showing? Double-press the scanner button to bring it up.")
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardDidShowNotification)) { note in
            keyboardVisible = Self.isRealKeyboard(note)
        }
        .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillHideNotification)) { _ in
            keyboardVisible = false
        }
        .task(id: waitingForKeyboard) {
            if waitingForKeyboard {
                // Grace so a normally-appearing keyboard never flashes the tip.
                try? await Task.sleep(nanoseconds: 750_000_000)
                guard !Task.isCancelled else { return }
                withAnimation(reduceMotion ? nil : .easeInOut(duration: 0.2)) { showTip = true }
                UIAccessibility.post(
                    notification: .announcement,
                    argument: "Keyboard not showing? Double-press the scanner button to bring it up."
                )
            } else if showTip {
                withAnimation(reduceMotion ? nil : .easeInOut(duration: 0.2)) { showTip = false }
            }
        }
    }

    /// The hardware-keyboard assistant strip also posts keyboard notifications
    /// with a short frame — only a real software keyboard should count.
    private static func isRealKeyboard(_ note: Notification) -> Bool {
        guard let frame = note.userInfo?[UIResponder.keyboardFrameEndUserInfoKey] as? CGRect else {
            return false
        }
        return frame.height > 120
    }
}
