import ActivityKit
import SwiftUI
import WidgetKit

@main
struct WisconsinLiveActivitiesBundle: WidgetBundle {
    var body: some Widget {
        CheckoutReturnLiveActivityWidget()
    }
}

struct CheckoutReturnLiveActivityWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: CheckoutReturnActivityAttributes.self) { context in
            CheckoutReturnCard(context: context, showsSeconds: false)
                .activityBackgroundTint(.black)
                .activitySystemActionForegroundColor(.white)
                .widgetURL(deepLink(for: context))
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    requester(context)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    returnTime(context)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    CheckoutReturnCard(context: context, showsSeconds: true)
                        .widgetURL(deepLink(for: context))
                }
            } compactLeading: {
                Text(context.state.endsAt, style: .relative)
                    .font(.caption2.weight(.bold))
                    .foregroundStyle(.white)
            } compactTrailing: {
                Text(context.attributes.requesterInitials)
                    .font(.caption2.weight(.bold))
                    .foregroundStyle(.white)
            } minimal: {
                Image(systemName: context.state.isOverdue ? "exclamationmark.circle.fill" : "clock.fill")
                    .foregroundStyle(.white)
            }
            .widgetURL(deepLink(for: context))
        }
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
            AvatarDisc(initials: context.attributes.requesterInitials, size: 24)
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

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top, spacing: 10) {
                AvatarDisc(initials: context.attributes.requesterInitials, size: 34)
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
                Spacer(minLength: 8)
                if let nextNeedAt = context.state.nextNeedAt {
                    Text("Needed next \(nextNeedAt, style: .time)")
                        .font(.caption2.weight(.medium))
                        .foregroundStyle(.white.opacity(0.76))
                        .lineLimit(1)
                }
            }
        }
        .padding(16)
        .foregroundStyle(.white)
        .background(background)
    }

    @ViewBuilder
    private var countdown: some View {
        if showsSeconds {
            Text(
                timerInterval: timerRange,
                countsDown: !context.state.isOverdue,
                showsHours: false
            )
                 .font(.system(size: 40, weight: .bold, design: .rounded).monospacedDigit())
        } else {
            minuteOnlyCountdown
                .font(.system(size: 36, weight: .bold, design: .rounded).monospacedDigit())
        }
    }

    private var minuteOnlyCountdown: Text {
        if context.state.isOverdue {
            Text("Overdue ") + Text(context.state.endsAt, style: .relative)
        } else {
            Text(context.state.endsAt, style: .relative)
        }
    }

    private var timerRange: ClosedRange<Date> {
        context.state.isOverdue
            ? context.state.endsAt...context.state.now
            : context.state.now...context.state.endsAt
    }

    private var background: some View {
        let redOpacity: Double = switch context.state.urgency {
        case .normal: 0.30
        case .warning: 0.54
        case .critical: 0.76
        case .overdue: 0.92
        }
        return RoundedRectangle(cornerRadius: 22, style: .continuous)
            .fill(
                LinearGradient(
                    colors: [
                        Color.black,
                        Color(red: 0.18, green: 0.0, blue: 0.02).opacity(redOpacity),
                        Color(red: 0.48, green: 0.0, blue: 0.04).opacity(redOpacity),
                    ],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            )
            .overlay(
                RoundedRectangle(cornerRadius: 22, style: .continuous)
                    .stroke(Color.white.opacity(0.10), lineWidth: 1)
            )
    }
}

private struct AvatarDisc: View {
    let initials: String
    let size: CGFloat

    var body: some View {
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
