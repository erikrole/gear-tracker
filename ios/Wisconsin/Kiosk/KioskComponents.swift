import SwiftUI

// MARK: - Shared kiosk components
//
// One implementation each for UI that was previously copied across the kiosk
// flows: the feedback banner existed in four places, the scan-zone header /
// progress ring / battery status / unit chips / error state / completion CTA
// in two or three each. Centralizing them kills the drift (so a polish change
// lands everywhere at once) and lets every flow share the same hit targets,
// motion, and color rules. Pure presentation -- no business logic.

// MARK: Flow header

/// Back · centered title · optional camera. The title is optically centered via
/// an overlay so unequal button widths don't shift it. Buttons keep a 44pt
/// touch target per `docs/DESIGN_LANGUAGE.md`.
struct KioskFlowHeader: View {
    let title: String
    var backAccessibilityLabel: String = "Back to roster"
    let onBack: () -> Void
    var onCamera: (() -> Void)?

    var body: some View {
        HStack(spacing: 0) {
            KioskHeaderButton(
                systemImage: "chevron.left",
                label: "Back",
                accessibilityLabel: backAccessibilityLabel,
                action: onBack
            )
            Spacer(minLength: 0)
            if let onCamera {
                KioskHeaderButton(
                    systemImage: "camera.fill",
                    label: "Camera",
                    accessibilityLabel: "Use camera to scan instead",
                    action: onCamera
                )
            } else {
                Color.clear.frame(width: 44, height: 44)
            }
        }
        .overlay {
            Text(title)
                .font(.kioskScreenTitle())
                .foregroundStyle(KioskText.primary)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
                .accessibilityAddTraits(.isHeader)
                .allowsHitTesting(false)
        }
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
                .foregroundStyle(KioskText.secondary)
                .padding(.horizontal, 6)
                .frame(minHeight: 44)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(accessibilityLabel)
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
/// Pickup / Complete Return). Brand red when ready, muted when disabled or
/// busy -- one CTA treatment for all three flows.
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
            .foregroundStyle(isActive ? KioskText.primary : KioskText.tertiary)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 16)
            .background(
                isActive ? Color.kioskRed : KioskSurface.cardRaised,
                in: RoundedRectangle(cornerRadius: KioskRadius.lg)
            )
            .overlay(
                RoundedRectangle(cornerRadius: KioskRadius.lg)
                    .stroke(isActive ? Color.clear : KioskStroke.divider, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .disabled(!isActive)
        .accessibilityLabel(accessibilityLabel)
    }
}

// MARK: Checklist row

/// A single scannable line in the pickup/return checklist. `strikethroughWhenDone`
/// is true for returns (the item is leaving) and false for pickups (the item is
/// being confirmed into the student's hands).
struct KioskChecklistRow: View {
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
                    Text(name)
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(isDone ? KioskText.tertiary : KioskText.primary)
                        .strikethrough(isDone && strikethroughWhenDone, color: KioskText.muted)
                    if isBattery {
                        Image(systemName: "battery.100percent")
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(Color.statusText(.orange))
                            .accessibilityLabel("Battery unit")
                    }
                }
                // Hide the tag line when it just repeats the display name so
                // rows stay scannable.
                if tag.caseInsensitiveCompare(name) != .orderedSame {
                    Text(tag)
                        .font(.caption.monospaced())
                        .foregroundStyle(KioskText.tertiary)
                }
            }
            Spacer()
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 16)
        .animation(.spring(response: 0.25), value: isDone)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(name), tag \(tag), \(isDone ? "done" : "pending")")
    }
}

// MARK: Checklist progress summary

/// "n of m <verb>" line + thin progress bar for the pickup/return checklist
/// header. In-progress fill is blue (matching `KioskProgressRing`), green when
/// complete. Shared by pickup ("confirmed") and return ("returned").
struct ChecklistProgressSummary: View {
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
                        .animation(.spring(response: 0.4), value: done)
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
        .accessibilityElement(children: .combine)
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
