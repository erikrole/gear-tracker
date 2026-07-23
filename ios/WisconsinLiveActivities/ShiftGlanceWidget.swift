import SwiftUI
import UIKit
import WidgetKit

// MARK: - Widget brand kit
//
// The widget extension is its own bundle, so it can't reach the main app's
// `Brand.swift` or its registered fonts. These locals mirror the login splash
// (`BrandSplashScene`) and Gotham typography so the widget reads as the same
// product — the little brother of the web/app login, not a system-grey card.

/// The login splash scene, scaled for a widget tile: a Badger-dark vertical
/// base with a crimson glow off the top-leading edge and an ember glow from the
/// bottom-trailing corner. Same stops as `BrandSplashScene`.
private struct ShiftGlanceScene: View {
    var body: some View {
        GeometryReader { geo in
            ZStack {
                LinearGradient(
                    stops: [
                        .init(color: Color(red: 0.078, green: 0.043, blue: 0.063), location: 0),
                        .init(color: Color(red: 0.133, green: 0.035, blue: 0.051), location: 0.5),
                        .init(color: Color(red: 0.227, green: 0.020, blue: 0.035), location: 1),
                    ],
                    startPoint: .top,
                    endPoint: .bottom
                )
                RadialGradient(
                    colors: [Color(red: 0.769, green: 0.071, blue: 0.188).opacity(0.55), .clear],
                    center: UnitPoint(x: 0.12, y: -0.05),
                    startRadius: 0,
                    endRadius: geo.size.height * 1.15
                )
                RadialGradient(
                    colors: [Color(red: 0.627, green: 0, blue: 0).opacity(0.6), .clear],
                    center: UnitPoint(x: 0.98, y: 1.05),
                    startRadius: 0,
                    endRadius: geo.size.height * 1.0
                )
            }
        }
    }
}

/// White-on-dark text ramp for the crimson scene, plus the two accents the
/// widget needs: a readable crimson for "live" and the gear-ready green.
private enum ShiftGlancePalette {
    static let live = Color(red: 1.0, green: 0.42, blue: 0.42)
    static let ready = Color(red: 0.38, green: 0.86, blue: 0.52)
}

private extension Font {
    /// Gotham Bold, the widget's headline face — mirrors the login wordmark.
    /// Falls back to the system bold weight if the bundled font is missing.
    static func widgetGothamBold(_ size: CGFloat, relativeTo style: Font.TextStyle) -> Font {
        UIFont(name: "Gotham-Bold", size: size) != nil
            ? .custom("Gotham-Bold", size: size, relativeTo: style)
            : .system(style, design: .default).weight(.bold)
    }
}

struct ShiftGlanceEntry: TimelineEntry {
    let date: Date
    let snapshot: ShiftGlanceSnapshot?
}

struct ShiftGlanceProvider: TimelineProvider {
    private let store = ShiftGlanceSnapshotStore()

    func placeholder(in context: Context) -> ShiftGlanceEntry {
        ShiftGlanceEntry(date: .now, snapshot: .preview)
    }

    func getSnapshot(in context: Context, completion: @escaping (ShiftGlanceEntry) -> Void) {
        completion(ShiftGlanceEntry(
            date: .now,
            snapshot: context.isPreview ? .preview : store.load()
        ))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<ShiftGlanceEntry>) -> Void) {
        let now = Date()
        let snapshot = store.load()
        let entry = ShiftGlanceEntry(date: now, snapshot: snapshot)
        let boundary = snapshot?
            .upcoming(at: now)
            .flatMap { [$0.startsAt, $0.endsAt] }
            .filter { $0 > now }
            .min()
        let regularRefresh = now.addingTimeInterval(15 * 60)
        let refreshDate = min(boundary ?? regularRefresh, regularRefresh)
        completion(Timeline(entries: [entry], policy: .after(refreshDate)))
    }
}

struct ShiftGlanceWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(
            kind: ShiftGlanceContract.widgetKind,
            provider: ShiftGlanceProvider()
        ) { entry in
            ShiftGlanceWidgetView(entry: entry)
                .widgetURL(deepLink(for: entry))
        }
        .configurationDisplayName("Shift Glance")
        .description("See your next Wisconsin Creative shift and gear readiness.")
        .supportedFamilies([
            .systemSmall,
            .systemMedium,
            .accessoryInline,
            .accessoryRectangular,
        ])
    }

    private func deepLink(for entry: ShiftGlanceEntry) -> URL? {
        guard let eventId = entry.snapshot?.upcoming(at: entry.date).first?.eventId else {
            return URL(string: "wisconsin://schedule")
        }
        return URL(string: "wisconsin://event/\(eventId)")
    }
}

private struct ShiftGlanceWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: ShiftGlanceEntry

    private var state: ShiftGlanceState {
        guard let snapshot = entry.snapshot else { return .empty }
        guard !snapshot.isStale(at: entry.date) else { return .stale }
        let upcoming = snapshot.upcoming(at: entry.date)
        return upcoming.isEmpty ? .empty : .shifts(upcoming)
    }

    var body: some View {
        content
            .containerBackground(for: .widget) { background }
    }

    @ViewBuilder
    private var content: some View {
        switch family {
        case .systemMedium:
            mediumView
        case .accessoryInline:
            inlineView
        case .accessoryRectangular:
            rectangularView
        default:
            smallView
        }
    }

    // Home-screen families ride the login crimson scene; lock-screen accessory
    // families stay transparent so the system's vibrant tint takes over.
    @ViewBuilder
    private var background: some View {
        switch family {
        case .systemSmall, .systemMedium:
            ShiftGlanceScene()
        default:
            Color.clear
        }
    }

    @ViewBuilder
    private var smallView: some View {
        switch state {
        case .shifts(let shifts):
            let shift = shifts[0]
            VStack(alignment: .leading, spacing: 0) {
                ShiftGlanceEyebrow(shift: shift, date: entry.date)
                Spacer(minLength: 6)
                Text(shift.title)
                    .font(.widgetGothamBold(16, relativeTo: .headline))
                    .foregroundStyle(.white)
                    .lineLimit(2)
                    .minimumScaleFactor(0.75)
                    .layoutPriority(1)
                Spacer(minLength: 6)
                ShiftGlanceTiming(shift: shift, date: entry.date)
                if let gearLabel = shift.gearLabel {
                    ShiftGlanceGearTag(label: gearLabel, status: shift.gearStatus)
                        .padding(.top, 7)
                }
            }
        case .empty:
            ShiftGlanceMessage(
                icon: "calendar.badge.checkmark",
                title: "Schedule clear",
                detail: "No upcoming shifts"
            )
        case .stale:
            ShiftGlanceMessage(
                icon: "arrow.clockwise.circle",
                title: "Update needed",
                detail: "Open Creative to refresh"
            )
        }
    }

    @ViewBuilder
    private var mediumView: some View {
        switch state {
        case .shifts(let shifts):
            VStack(alignment: .leading, spacing: 9) {
                ShiftGlanceHeader()
                ForEach(Array(shifts.prefix(2).enumerated()), id: \.element.id) { index, shift in
                    if index > 0 {
                        Rectangle()
                            .fill(Color.white.opacity(0.14))
                            .frame(height: 1)
                    }
                    ShiftGlanceRow(shift: shift, date: entry.date)
                }
                Spacer(minLength: 0)
            }
        case .empty:
            ShiftGlanceMessage(
                icon: "calendar.badge.checkmark",
                title: "Your schedule is clear",
                detail: "No upcoming shifts"
            )
        case .stale:
            ShiftGlanceMessage(
                icon: "arrow.clockwise.circle",
                title: "Schedule update needed",
                detail: "Open Wisconsin Creative to refresh your shifts"
            )
        }
    }

    @ViewBuilder
    private var inlineView: some View {
        switch state {
        case .shifts(let shifts):
            let shift = shifts[0]
            Label(inlineLabel(for: shift), systemImage: shift.isActive(at: entry.date) ? "record.circle" : "clock")
        case .empty:
            Label("No upcoming shifts", systemImage: "calendar")
        case .stale:
            Label("Open Creative to refresh", systemImage: "arrow.clockwise")
        }
    }

    @ViewBuilder
    private var rectangularView: some View {
        switch state {
        case .shifts(let shifts):
            let shift = shifts[0]
            VStack(alignment: .leading, spacing: 2) {
                Text(shift.isActive(at: entry.date) ? "ON NOW" : "NEXT SHIFT")
                    .font(.caption2.weight(.bold))
                    .tracking(0.6)
                    .foregroundStyle(.secondary)
                Text(shift.title)
                    .font(.widgetGothamBold(16, relativeTo: .headline))
                    .lineLimit(1)
                Text(rectangularDetail(for: shift))
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
        case .empty:
            ShiftGlanceMessage(
                icon: "calendar.badge.checkmark",
                title: "Schedule clear",
                detail: "No upcoming shifts"
            )
        case .stale:
            ShiftGlanceMessage(
                icon: "arrow.clockwise.circle",
                title: "Update needed",
                detail: "Open Creative to refresh"
            )
        }
    }

    private func inlineLabel(for shift: ShiftGlanceItem) -> String {
        if shift.isActive(at: entry.date) {
            return "On now: \(shift.title)"
        }
        return "\(shift.startsAt.formatted(date: .abbreviated, time: .shortened)): \(shift.title)"
    }

    private func rectangularDetail(for shift: ShiftGlanceItem) -> String {
        if shift.isActive(at: entry.date) {
            return "Until \(shift.endsAt.formatted(date: .omitted, time: .shortened)) · \(shift.area)"
        }
        return "\(shift.startsAt.formatted(date: .abbreviated, time: .shortened)) · \(shift.area)"
    }
}

// The medium widget's title row: the W mark cue plus a tracked, small-caps
// wordmark, echoing the login lockup at widget scale.
private struct ShiftGlanceHeader: View {
    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: "calendar")
                .font(.caption2.weight(.bold))
            Text("SHIFT GLANCE")
                .font(.caption2.weight(.bold))
                .tracking(0.8)
        }
        .foregroundStyle(.white.opacity(0.6))
    }
}

private struct ShiftGlanceEyebrow: View {
    let shift: ShiftGlanceItem
    let date: Date

    private var isLive: Bool { shift.isActive(at: date) }

    var body: some View {
        HStack(spacing: 5) {
            if isLive {
                Circle()
                    .fill(ShiftGlancePalette.live)
                    .frame(width: 6, height: 6)
            } else {
                Image(systemName: "calendar")
            }
            Text(isLive ? "ON NOW" : "NEXT SHIFT")
        }
        .font(.caption2.weight(.bold))
        .tracking(0.8)
        .foregroundStyle(isLive ? ShiftGlancePalette.live : Color.white.opacity(0.55))
    }
}

private struct ShiftGlanceTiming: View {
    let shift: ShiftGlanceItem
    let date: Date

    var body: some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(timeLine)
                .font(.footnote.weight(.semibold))
                .foregroundStyle(.white)
                .lineLimit(1)
            Text(shift.area)
                .font(.caption2)
                .foregroundStyle(.white.opacity(0.6))
                .lineLimit(1)
        }
    }

    private var timeLine: String {
        if shift.isActive(at: date) {
            return "Until \(shift.endsAt.formatted(date: .omitted, time: .shortened))"
        }
        return shift.startsAt.formatted(date: .abbreviated, time: .shortened)
    }
}

private struct ShiftGlanceRow: View {
    let shift: ShiftGlanceItem
    let date: Date

    private var isLive: Bool { shift.isActive(at: date) }

    var body: some View {
        HStack(alignment: .center, spacing: 10) {
            VStack(alignment: .leading, spacing: 2) {
                Text(shift.title)
                    .font(.widgetGothamBold(15, relativeTo: .subheadline))
                    .foregroundStyle(.white)
                    .lineLimit(1)
                HStack(spacing: 5) {
                    if isLive {
                        Circle()
                            .fill(ShiftGlancePalette.live)
                            .frame(width: 5, height: 5)
                    }
                    Text(detail)
                        .font(.caption)
                        .foregroundStyle(.white.opacity(0.6))
                        .lineLimit(1)
                }
            }
            Spacer(minLength: 8)
            if let gearLabel = shift.gearLabel {
                ShiftGlanceGearTag(label: gearLabel, status: shift.gearStatus)
            }
        }
    }

    private var detail: String {
        if isLive {
            return "Until \(shift.endsAt.formatted(date: .omitted, time: .shortened)) · \(shift.area)"
        }
        return "\(shift.startsAt.formatted(date: .abbreviated, time: .shortened)) · \(shift.area)"
    }
}

// Small readiness pill. Gear-ready glows green (the one bit of good news worth
// a color); every other custody state stays quiet white so it never competes
// with the shift itself.
private struct ShiftGlanceGearTag: View {
    let label: String
    let status: String

    private var isReady: Bool { status == "pickup_ready" }

    private var icon: String {
        switch status {
        case "pickup_ready": "shippingbox.fill"
        case "checked_out": "backpack.fill"
        case "reserved": "calendar.badge.checkmark"
        default: "backpack"
        }
    }

    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: icon)
                .font(.system(size: 9, weight: .bold))
            Text(label)
                .font(.caption2.weight(.semibold))
                .lineLimit(1)
        }
        .foregroundStyle(isReady ? ShiftGlancePalette.ready : Color.white.opacity(0.85))
        .padding(.horizontal, 7)
        .padding(.vertical, 3)
        .background(
            Capsule().fill(Color.white.opacity(isReady ? 0.14 : 0.1))
        )
    }
}

private struct ShiftGlanceMessage: View {
    let icon: String
    let title: String
    let detail: String

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Image(systemName: icon)
                .font(.title2)
                .foregroundStyle(.white.opacity(0.7))
                .widgetAccentable()
            Spacer(minLength: 0)
            Text(title)
                .font(.widgetGothamBold(15, relativeTo: .headline))
                .foregroundStyle(.white)
            Text(detail)
                .font(.caption)
                .foregroundStyle(.white.opacity(0.6))
                .lineLimit(2)
        }
    }
}

private enum ShiftGlanceState {
    case shifts([ShiftGlanceItem])
    case empty
    case stale
}

private extension ShiftGlanceSnapshot {
    static let preview = ShiftGlanceSnapshot(
        generatedAt: .now,
        shifts: [
            ShiftGlanceItem(
                id: "preview-shift-1",
                eventId: "preview-event-1",
                title: "Football vs Notre Dame",
                area: "Photo",
                startsAt: .now.addingTimeInterval(45 * 60),
                endsAt: .now.addingTimeInterval(4 * 60 * 60),
                eventStartsAt: .now.addingTimeInterval(90 * 60),
                locationName: "Camp Randall Stadium",
                gearStatus: "pickup_ready",
                gearLabel: "Gear ready"
            ),
            ShiftGlanceItem(
                id: "preview-shift-2",
                eventId: "preview-event-2",
                title: "Volleyball vs Minnesota",
                area: "Video",
                startsAt: .now.addingTimeInterval(26 * 60 * 60),
                endsAt: .now.addingTimeInterval(30 * 60 * 60),
                eventStartsAt: .now.addingTimeInterval(27 * 60 * 60),
                locationName: "Field House",
                gearStatus: "none",
                gearLabel: nil
            ),
        ]
    )
}
