import ActivityKit
import SwiftUI
import WidgetKit

private extension Color {
    static let liveActivityGreen = Color(red: 0.32, green: 0.85, blue: 0.45)
    static let liveActivityAmber = Color(red: 1.0, green: 0.66, blue: 0.18)
    static let liveActivityRed = Color(red: 1.0, green: 0.27, blue: 0.23)
    static let liveActivitySurface = Color(red: 0.055, green: 0.055, blue: 0.065)
}

@main
struct WisconsinLiveActivitiesBundle: WidgetBundle {
    var body: some Widget {
        CheckoutReturnLiveActivityWidget()
    }
}

struct CheckoutReturnLiveActivityWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: CheckoutReturnActivityAttributes.self) { context in
            TimelineView(.periodic(from: .now, by: 60)) { timeline in
                CheckoutReturnLockScreen(context: context, now: timeline.date)
                    .activityBackgroundTint(.liveActivitySurface)
                    .activitySystemActionForegroundColor(.white)
                    .widgetURL(bookingDeepLink(for: context))
            }
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Label {
                        Text(context.attributes.bookingTitle)
                            .font(.caption.weight(.semibold))
                            .lineLimit(1)
                    } icon: {
                        Image(systemName: "shippingbox.fill")
                            .foregroundStyle(accentColor(for: context.state.urgency(at: .now)))
                    }
                }

                DynamicIslandExpandedRegion(.trailing) {
                    Text(context.state.endsAt, style: .time)
                        .font(.caption.monospacedDigit())
                        .foregroundStyle(.secondary)
                }

                DynamicIslandExpandedRegion(.bottom) {
                    TimelineView(.periodic(from: .now, by: 60)) { timeline in
                        ExpandedReturnStatus(context: context, now: timeline.date)
                    }
                }
            } compactLeading: {
                TimelineView(.periodic(from: .now, by: 60)) { timeline in
                    Image(systemName: statusIcon(for: context.state.urgency(at: timeline.date)))
                        .foregroundStyle(accentColor(for: context.state.urgency(at: timeline.date)))
                }
            } compactTrailing: {
                TimelineView(.periodic(from: .now, by: 60)) { timeline in
                    Text(compactLabel(for: context.state, at: timeline.date))
                        .font(.caption2.weight(.bold).monospacedDigit())
                        .foregroundStyle(accentColor(for: context.state.urgency(at: timeline.date)))
                }
            } minimal: {
                TimelineView(.periodic(from: .now, by: 60)) { timeline in
                    Image(systemName: statusIcon(for: context.state.urgency(at: timeline.date)))
                        .foregroundStyle(accentColor(for: context.state.urgency(at: timeline.date)))
                }
            }
            .widgetURL(bookingDeepLink(for: context))
        }
    }

    private func bookingDeepLink(for context: ActivityViewContext<CheckoutReturnActivityAttributes>) -> URL? {
        var components = URLComponents()
        components.scheme = "wisconsin"
        components.host = "booking"
        components.path = "/\(context.attributes.bookingId)"
        return components.url
    }

    private func statusIcon(
        for urgency: CheckoutReturnActivityAttributes.ContentState.Urgency
    ) -> String {
        switch urgency {
        case .returned: "checkmark.circle.fill"
        case .overdue: "exclamationmark.circle.fill"
        case .critical: "clock.badge.exclamationmark.fill"
        case .warning, .normal: "clock.fill"
        }
    }

    private func compactLabel(
        for state: CheckoutReturnActivityAttributes.ContentState,
        at date: Date
    ) -> String {
        state.urgency(at: date) == .returned ? "Done" : state.minuteLabel(at: date)
    }

    private func accentColor(
        for urgency: CheckoutReturnActivityAttributes.ContentState.Urgency
    ) -> Color {
        switch urgency {
        case .normal: .white
        case .warning: .liveActivityAmber
        case .critical, .overdue: .liveActivityRed
        case .returned: .liveActivityGreen
        }
    }
}

private struct CheckoutReturnLockScreen: View {
    let context: ActivityViewContext<CheckoutReturnActivityAttributes>
    let now: Date

    private var urgency: CheckoutReturnActivityAttributes.ContentState.Urgency {
        context.state.urgency(at: now)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Label {
                    Text(urgency == .returned ? "Returned" : "Gear return")
                        .font(.caption.weight(.semibold))
                } icon: {
                    Image(systemName: urgency == .returned ? "checkmark.circle.fill" : "shippingbox.fill")
                }
                .foregroundStyle(accentColor)

                Spacer(minLength: 8)

                if urgency != .returned {
                    Text("Due \(context.state.endsAt, style: .time)")
                        .font(.caption.monospacedDigit())
                        .foregroundStyle(.secondary)
                }
            }

            Text(context.attributes.bookingTitle)
                .font(.headline.weight(.semibold))
                .lineLimit(2)

            if urgency == .returned {
                Text("Everything is checked in.")
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(Color.liveActivityGreen)
            } else {
                HStack(alignment: .lastTextBaseline, spacing: 10) {
                    Text(context.state.minuteLabel(at: now))
                        .font(.system(.title, design: .rounded, weight: .bold).monospacedDigit())
                        .foregroundStyle(accentColor)
                        .contentTransition(.numericText())

                    Spacer(minLength: 8)

                    if let nextNeedAt = context.state.nextNeedAt {
                        Label {
                            Text("Needed again \(nextNeedAt, style: .time)")
                        } icon: {
                            Image(systemName: "arrow.forward.circle.fill")
                        }
                        .font(.caption2.weight(.medium))
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                    }
                }
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .foregroundStyle(.white)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(accessibilityLabel)
    }

    private var accentColor: Color {
        switch urgency {
        case .normal: .white
        case .warning: .liveActivityAmber
        case .critical, .overdue: .liveActivityRed
        case .returned: .liveActivityGreen
        }
    }

    private var accessibilityLabel: String {
        if urgency == .returned {
            return "\(context.attributes.bookingTitle), returned. Everything is checked in."
        }
        var parts = [
            context.attributes.bookingTitle,
            context.state.minuteLabel(at: now),
            "due at \(context.state.endsAt.formatted(date: .omitted, time: .shortened))",
        ]
        if let nextNeedAt = context.state.nextNeedAt {
            parts.append("needed again at \(nextNeedAt.formatted(date: .omitted, time: .shortened))")
        }
        return parts.joined(separator: ", ")
    }
}

private struct ExpandedReturnStatus: View {
    let context: ActivityViewContext<CheckoutReturnActivityAttributes>
    let now: Date

    private var urgency: CheckoutReturnActivityAttributes.ContentState.Urgency {
        context.state.urgency(at: now)
    }

    var body: some View {
        HStack(alignment: .center, spacing: 10) {
            if urgency == .returned {
                Label("Everything checked in", systemImage: "checkmark.circle.fill")
                    .font(.headline.weight(.semibold))
                    .foregroundStyle(Color.liveActivityGreen)
            } else {
                Text(context.state.minuteLabel(at: now))
                    .font(.title2.bold().monospacedDigit())
                    .foregroundStyle(accentColor)
                    .contentTransition(.numericText())

                Spacer(minLength: 8)

                if let nextNeedAt = context.state.nextNeedAt {
                    Text("Needed again \(nextNeedAt, style: .time)")
                        .font(.caption.weight(.medium))
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                } else {
                    Text("Return by \(context.state.endsAt, style: .time)")
                        .font(.caption.weight(.medium).monospacedDigit())
                        .foregroundStyle(.secondary)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
    }

    private var accentColor: Color {
        switch urgency {
        case .normal: .primary
        case .warning: .liveActivityAmber
        case .critical, .overdue: .liveActivityRed
        case .returned: .liveActivityGreen
        }
    }
}

// MARK: - Previews

private func previewAttributes() -> CheckoutReturnActivityAttributes {
    CheckoutReturnActivityAttributes(
        bookingId: "preview-booking",
        bookingTitle: "Sony FX6 Kit",
        requesterName: "Jordan Diaz",
        requesterInitials: "JD",
        requesterAvatarUrl: nil,
        returnTimeText: "Return 4:30 PM"
    )
}

private func previewState(
    urgency: CheckoutReturnActivityAttributes.ContentState.Urgency,
    endsAtOffset: TimeInterval,
    nextNeedAtOffset: TimeInterval? = nil
) -> CheckoutReturnActivityAttributes.ContentState {
    CheckoutReturnActivityAttributes.ContentState(
        endsAt: Date().addingTimeInterval(endsAtOffset),
        now: Date(),
        nextNeedAt: nextNeedAtOffset.map { Date().addingTimeInterval($0) },
        allowsExtend: urgency != .overdue && urgency != .returned,
        urgency: urgency
    )
}

#Preview("Normal", as: .content, using: CheckoutReturnActivityAttributes.preview) {
    CheckoutReturnLiveActivityWidget()
} contentStates: {
    previewState(urgency: .normal, endsAtOffset: 90 * 60)
}

#Preview("Warning", as: .content, using: CheckoutReturnActivityAttributes.preview) {
    CheckoutReturnLiveActivityWidget()
} contentStates: {
    previewState(urgency: .warning, endsAtOffset: 20 * 60, nextNeedAtOffset: 45 * 60)
}

#Preview("Critical", as: .content, using: CheckoutReturnActivityAttributes.preview) {
    CheckoutReturnLiveActivityWidget()
} contentStates: {
    previewState(urgency: .critical, endsAtOffset: 5 * 60)
}

#Preview("Overdue", as: .content, using: CheckoutReturnActivityAttributes.preview) {
    CheckoutReturnLiveActivityWidget()
} contentStates: {
    previewState(urgency: .overdue, endsAtOffset: -8 * 60)
}

#Preview("Returned", as: .content, using: CheckoutReturnActivityAttributes.preview) {
    CheckoutReturnLiveActivityWidget()
} contentStates: {
    previewState(urgency: .returned, endsAtOffset: -2 * 60)
}

extension CheckoutReturnActivityAttributes {
    fileprivate static var preview: CheckoutReturnActivityAttributes {
        previewAttributes()
    }
}
