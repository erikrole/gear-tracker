import ActivityKit
import SwiftUI
import WidgetKit

extension Color {
    /// Brand green status tone (dark-mode value from `Brand.swift`'s
    /// `StatusTone.green`), duplicated here since the widget extension
    /// target doesn't compile that app-only file. The Live Activity card
    /// always renders as a dark surface regardless of system appearance, so
    /// the dark-mode value is the correct one to match here.
    static let brandStatusGreen = Color(red: 0.32, green: 0.85, blue: 0.45)
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
                CheckoutReturnCard(context: context, showsSeconds: false, now: timeline.date)
                    .activityBackgroundTint(.clear)
                    .activitySystemActionForegroundColor(.white)
                    .widgetURL(deepLink(for: context))
            }
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    requester(context)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    returnTime(context)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    TimelineView(.periodic(from: .now, by: 1)) { timeline in
                        CheckoutReturnCard(context: context, showsSeconds: true, now: timeline.date)
                            .widgetURL(deepLink(for: context))
                    }
                }
            } compactLeading: {
                TimelineView(.periodic(from: .now, by: 60)) { timeline in
                    if context.state.urgency(at: timeline.date) == .returned {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.caption2.weight(.bold))
                            .foregroundStyle(.white)
                    } else {
                        Text(context.state.minuteLabel(at: timeline.date))
                            .font(.caption2.weight(.bold))
                            .foregroundStyle(.white)
                    }
                }
            } compactTrailing: {
                Text(context.attributes.requesterInitials)
                    .font(.caption2.weight(.bold))
                    .foregroundStyle(.white)
            } minimal: {
                TimelineView(.periodic(from: .now, by: 60)) { timeline in
                    Image(systemName: minimalIconName(context: context, at: timeline.date))
                        .foregroundStyle(.white)
                }
            }
            .widgetURL(deepLink(for: context))
        }
    }

    private func minimalIconName(
        context: ActivityViewContext<CheckoutReturnActivityAttributes>,
        at date: Date
    ) -> String {
        if context.state.urgency(at: date) == .returned { return "checkmark.circle.fill" }
        return context.state.isOverdue(at: date) ? "exclamationmark.circle.fill" : "clock.fill"
    }

    private func deepLink(for context: ActivityViewContext<CheckoutReturnActivityAttributes>) -> URL? {
        var components = URLComponents()
        components.scheme = "wisconsin"
        components.host = "booking"
        components.path = "/\(context.attributes.bookingId)"
        if context.state.allowsExtend {
            components.queryItems = [URLQueryItem(name: "action", value: "extend")]
        }
        return components.url
    }

    private func requester(_ context: ActivityViewContext<CheckoutReturnActivityAttributes>) -> some View {
        HStack(spacing: 6) {
            LiveActivityAvatar(
                initials: context.attributes.requesterInitials,
                avatarUrl: context.attributes.requesterAvatarUrl,
                size: 24
            )
            Text(context.attributes.requesterName)
                .font(.caption.weight(.semibold))
                .lineLimit(1)
        }
    }

    private func returnTime(_ context: ActivityViewContext<CheckoutReturnActivityAttributes>) -> some View {
        Text(context.attributes.returnTimeText)
            .font(.caption.monospacedDigit())
            .foregroundStyle(.white.opacity(0.82))
    }
}

private struct CheckoutReturnCard: View {
    let context: ActivityViewContext<CheckoutReturnActivityAttributes>
    let showsSeconds: Bool
    let now: Date

    var body: some View {
        Group {
            if context.state.urgency(at: now) == .returned {
                returnedContent
            } else {
                activeContent
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .foregroundStyle(.white)
        .background(background)
        .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
    }

    private var activeContent: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top, spacing: 10) {
                LiveActivityAvatar(
                    initials: context.attributes.requesterInitials,
                    avatarUrl: context.attributes.requesterAvatarUrl,
                    size: 34
                )
                VStack(alignment: .leading, spacing: 2) {
                    Text(context.attributes.bookingTitle)
                        .font(.headline.weight(.semibold))
                        .lineLimit(1)
                    Text(context.attributes.requesterName)
                        .font(.caption)
                        .foregroundStyle(.white.opacity(0.72))
                        .lineLimit(1)
                }
                Spacer(minLength: 6)
                Text(context.attributes.returnTimeText)
                    .font(.caption.monospacedDigit())
                    .foregroundStyle(.white.opacity(0.78))
            }

            HStack(alignment: .lastTextBaseline) {
                countdown
                    .lineLimit(1)
                    .minimumScaleFactor(0.72)
                Spacer(minLength: 8)
                if let nextNeedAt = context.state.nextNeedAt {
                    Text("Needed next \(nextNeedAt, style: .time)")
                        .font(.caption2.weight(.medium))
                        .foregroundStyle(.white.opacity(0.76))
                        .lineLimit(1)
                }
            }
        }
    }

    private var returnedContent: some View {
        HStack(alignment: .center, spacing: 12) {
            LiveActivityAvatar(
                initials: context.attributes.requesterInitials,
                avatarUrl: context.attributes.requesterAvatarUrl,
                size: 34
            )
            VStack(alignment: .leading, spacing: 2) {
                Text(context.attributes.bookingTitle)
                    .font(.headline.weight(.semibold))
                    .lineLimit(1)
                Text(context.attributes.requesterName)
                    .font(.caption)
                    .foregroundStyle(.white.opacity(0.72))
                    .lineLimit(1)
            }
            Spacer(minLength: 8)
            HStack(spacing: 6) {
                Image(systemName: "checkmark.circle.fill")
                    .font(.title3.weight(.semibold))
                Text("Returned")
                    .font(.headline.weight(.semibold))
            }
            .foregroundStyle(Color.brandStatusGreen)
        }
    }

    @ViewBuilder
    private var countdown: some View {
        if showsSeconds {
            Text(
                timerInterval: timerRange,
                countsDown: !context.state.isOverdue(at: now),
                showsHours: false
            )
                 .font(.system(size: 40, weight: .bold, design: .rounded).monospacedDigit())
        } else {
            minuteOnlyCountdown
                .font(.system(size: 36, weight: .bold, design: .rounded).monospacedDigit())
        }
    }

    private var minuteOnlyCountdown: Text {
        Text(context.state.minuteLabel(at: now))
    }

    private var timerRange: ClosedRange<Date> {
        context.state.isOverdue(at: now)
            ? context.state.endsAt...now
            : now...context.state.endsAt
    }

    /// Continuous piecewise-linear red ramp, anchored to preserve the previous
    /// 4-step look at each boundary: >=60min -> 0.30, 30min -> 0.54,
    /// 10min -> 0.76, 0min -> 0.92, capped at 0.92 while overdue. Card
    /// re-renders every 60s (lock screen) / 1s (Dynamic Island expanded) via
    /// `TimelineView`, so the ramp advances smoothly with no extra pushes.
    private static func redOpacity(remainingMinutes: Double) -> Double {
        let anchors: [(minutes: Double, opacity: Double)] = [
            (0, 0.92),
            (10, 0.76),
            (30, 0.54),
            (60, 0.30),
        ]

        if remainingMinutes <= anchors[0].minutes { return anchors[0].opacity }
        if remainingMinutes >= anchors.last!.minutes { return anchors.last!.opacity }

        for (lower, upper) in zip(anchors, anchors.dropFirst()) {
            guard remainingMinutes >= lower.minutes, remainingMinutes <= upper.minutes else { continue }
            let span = upper.minutes - lower.minutes
            let progress = (remainingMinutes - lower.minutes) / span
            return lower.opacity + (upper.opacity - lower.opacity) * progress
        }

        return anchors[0].opacity
    }

    private var background: some View {
        let urgency = context.state.urgency(at: now)

        if urgency == .returned {
            return AnyView(ZStack {
                LinearGradient(
                    colors: [Color.black, Color.brandStatusGreen.opacity(0.42)],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
                RoundedRectangle(cornerRadius: 22, style: .continuous)
                    .stroke(Color.white.opacity(0.10), lineWidth: 1)
            })
        }

        let remainingMinutes = context.state.endsAt.timeIntervalSince(now) / 60
        let redOpacity = Self.redOpacity(remainingMinutes: remainingMinutes)

        return AnyView(ZStack {
            LinearGradient(
                colors: [
                    Color.black,
                    Color(red: 0.18, green: 0.0, blue: 0.02).opacity(redOpacity),
                    Color(red: 0.48, green: 0.0, blue: 0.04).opacity(redOpacity),
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            RoundedRectangle(cornerRadius: 22, style: .continuous)
                .stroke(Color.white.opacity(0.10), lineWidth: 1)
        })
    }
}

private struct LiveActivityAvatar: View {
    let initials: String
    let avatarUrl: String?
    let size: CGFloat

    var body: some View {
        if let avatarUrl, let url = URL(string: avatarUrl) {
            AsyncImage(url: url) { phase in
                switch phase {
                case .success(let image):
                    image
                        .resizable()
                        .scaledToFill()
                        .frame(width: size, height: size)
                        .clipShape(Circle())
                        .overlay(Circle().stroke(Color.white.opacity(0.18), lineWidth: 1))
                default:
                    fallback
                }
            }
            .frame(width: size, height: size)
        } else {
            fallback
        }
    }

    private var fallback: some View {
        Text(initials)
            .font(.system(size: size * 0.34, weight: .bold, design: .rounded))
            .foregroundStyle(.white)
            .frame(width: size, height: size)
            .background(
                Circle()
                    .fill(Color.white.opacity(0.16))
                    .overlay(Circle().stroke(Color.white.opacity(0.18), lineWidth: 1))
            )
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
    endsAtOffset: TimeInterval
) -> CheckoutReturnActivityAttributes.ContentState {
    CheckoutReturnActivityAttributes.ContentState(
        endsAt: Date().addingTimeInterval(endsAtOffset),
        now: Date(),
        nextNeedAt: nil,
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
    previewState(urgency: .warning, endsAtOffset: 20 * 60)
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
