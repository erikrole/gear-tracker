import SwiftUI

/// Shared vocabulary for every crew surface, the native sibling of the web's
/// `src/components/shift-detail/crew-row.tsx`.
///
/// A crew row carries one signal. Slot state is a small coloured dot plus a
/// neutral label, crew type is plain secondary text in a fixed-width column,
/// and area headings read as quiet section labels with a filled count.
/// Anything that would add a second filled capsule to a row belongs somewhere
/// else on the surface.

// MARK: - Slot state

enum CrewSlotState {
    case filled
    case open
    case requested

    /// Mirrors web `crewSlotState(hasAssignment, requestCount)`.
    static func resolve(hasAssignment: Bool, requestCount: Int = 0) -> CrewSlotState {
        if hasAssignment { return .filled }
        return requestCount > 0 ? .requested : .open
    }

    var tone: StatusTone {
        switch self {
        case .filled: return .green
        case .open: return .red
        case .requested: return .orange
        }
    }

    func label(requestCount: Int = 0) -> String {
        switch self {
        case .filled: return "Filled"
        case .open: return "Open"
        case .requested: return requestCount == 1 ? "1 requested" : "\(requestCount) requested"
        }
    }
}

/// The state marker itself. Colour carries the state; nothing else needs to.
struct CrewStateDot: View {
    let state: CrewSlotState

    var body: some View {
        Circle()
            .fill(Color.statusText(state.tone))
            .frame(width: 6, height: 6)
            .accessibilityHidden(true)
    }
}

/// Dot plus neutral label — the crew row's only status treatment.
struct CrewSlotStatusLabel: View {
    let state: CrewSlotState
    var requestCount: Int = 0

    var body: some View {
        HStack(spacing: 6) {
            CrewStateDot(state: state)
            Text(state.label(requestCount: requestCount))
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(state.label(requestCount: requestCount))
    }
}

// MARK: - Crew type

/// Staff/Student as plain text, never a capsule. A column of identical filled
/// pills was the loudest thing on a crew row and carried the least meaning.
struct CrewTypeLabel: View {
    let label: String
    /// Set when an assigned person's class differs from the slot they filled.
    var emphasis: Bool = false
    /// Column width at the default text size. Avatars and names start at the
    /// same x on every row; the column grows with Dynamic Type so "Student"
    /// does not truncate to "Stude…" at accessibility sizes.
    var baseWidth: CGFloat? = 62

    @ScaledMetric(relativeTo: .caption) private var typeScale: CGFloat = 1

    var body: some View {
        Text(label)
            .font(.caption)
            .foregroundStyle(emphasis ? .primary : .secondary)
            .lineLimit(1)
            .frame(width: baseWidth.map { $0 * typeScale }, alignment: .leading)
    }
}

/// Server worker-type code to the label every surface speaks.
func crewWorkerTypeLabel(_ workerType: String) -> String {
    switch workerType {
    case "FT", "STAFF": return "Staff"
    case "ST", "STUDENT": return "Student"
    default: return workerType
    }
}

// MARK: - Area heading

/// Group header for an area: icon, name, and how much of it is filled.
struct CrewAreaHeading: View {
    let area: String
    var filled: Int? = nil
    var total: Int? = nil

    var body: some View {
        HStack(spacing: 6) {
            Label(area.shiftAreaLabel, systemImage: Self.icon(for: area))
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.secondary)
            if let filled, let total, total > 0 {
                Text("\(filled)/\(total)")
                    .font(.caption.monospacedDigit())
                    .foregroundStyle(.tertiary)
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(accessibilityLabel)
    }

    private var accessibilityLabel: String {
        guard let filled, let total, total > 0 else { return area.shiftAreaLabel }
        return "\(area.shiftAreaLabel), \(filled) of \(total) filled"
    }

    /// SF Symbol per shift area, matching the area's job.
    static func icon(for area: String) -> String {
        switch area {
        case "VIDEO":    return "video.fill"
        case "PHOTO":    return "camera.fill"
        case "GRAPHICS": return "paintpalette.fill"
        case "COMMS":    return "dot.radiowaves.left.and.right"
        default:         return "person.fill"
        }
    }
}
