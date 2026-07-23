import SwiftUI
import WidgetKit

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
                .containerBackground(.fill.tertiary, for: .widget)
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

    @ViewBuilder
    private var smallView: some View {
        switch state {
        case .shifts(let shifts):
            let shift = shifts[0]
            VStack(alignment: .leading, spacing: 8) {
                ShiftGlanceEyebrow(shift: shift, date: entry.date)
                Text(shift.title)
                    .font(.subheadline.weight(.semibold))
                    .lineLimit(2)
                    .minimumScaleFactor(0.85)
                    .layoutPriority(1)
                Spacer(minLength: 0)
                ShiftGlanceTiming(shift: shift, date: entry.date)
                if let gearLabel = shift.gearLabel {
                    Label(gearLabel, systemImage: gearIcon(for: shift.gearStatus))
                        .font(.caption2.weight(.medium))
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
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
            VStack(alignment: .leading, spacing: 10) {
                Label("Shift Glance", systemImage: "calendar")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                ForEach(Array(shifts.prefix(2).enumerated()), id: \.element.id) { index, shift in
                    if index > 0 { Divider() }
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
                    .foregroundStyle(.secondary)
                Text(shift.title)
                    .font(.headline)
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

    private func gearIcon(for status: String) -> String {
        switch status {
        case "pickup_ready": "shippingbox.fill"
        case "checked_out": "backpack.fill"
        case "reserved": "calendar.badge.checkmark"
        default: "backpack"
        }
    }
}

private struct ShiftGlanceEyebrow: View {
    let shift: ShiftGlanceItem
    let date: Date

    var body: some View {
        Label(
            shift.isActive(at: date) ? "ON NOW" : "NEXT SHIFT",
            systemImage: shift.isActive(at: date) ? "record.circle" : "calendar"
        )
        .font(.caption2.weight(.bold))
        .foregroundStyle(.secondary)
    }
}

private struct ShiftGlanceTiming: View {
    let shift: ShiftGlanceItem
    let date: Date

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(timeLine)
                .font(.caption.weight(.semibold))
                .lineLimit(1)
            Text(shift.area)
                .font(.caption2)
                .foregroundStyle(.secondary)
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

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 10) {
            VStack(alignment: .leading, spacing: 2) {
                Text(shift.title)
                    .font(.subheadline.weight(.semibold))
                    .lineLimit(1)
                Text(detail)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            Spacer(minLength: 8)
            if let gearLabel = shift.gearLabel {
                Text(gearLabel)
                    .font(.caption2.weight(.medium))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
        }
    }

    private var detail: String {
        if shift.isActive(at: date) {
            return "On now until \(shift.endsAt.formatted(date: .omitted, time: .shortened)) · \(shift.area)"
        }
        return "\(shift.startsAt.formatted(date: .abbreviated, time: .shortened)) · \(shift.area)"
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
                .foregroundStyle(.secondary)
                .widgetAccentable()
            Spacer(minLength: 0)
            Text(title)
                .font(.headline)
            Text(detail)
                .font(.caption)
                .foregroundStyle(.secondary)
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
