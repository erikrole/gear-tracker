@preconcurrency import ActivityKit
import Foundation

@MainActor
final class CheckoutReturnLiveActivityManager {
    static let shared = CheckoutReturnLiveActivityManager()

    private let defaultLeadTime: TimeInterval = 30 * 60
    private let maxNextNeedLeadTime: TimeInterval = 60 * 60
    private var isReconciling = false
    private var isObservingPushToStartTokens = false
    private var isObservingActivityUpdates = false
    /// Token-observation task per activity id, so an ended activity's observer
    /// can be torn down. Previously this was a `Set<String>` that only grew:
    /// every activity left a `for await` task running for the life of the
    /// process, and its id in the set forever.
    private var tokenObservers: [String: Task<Void, Never>] = [:]

    private init() {}

    func prepareRemoteStartRegistration() async {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }
        observeExistingActivities()
        observePushToStartTokens()
        observeActivityUpdates()
    }

    func reconcileCurrentUserCheckouts(requesterId: String?) async {
        guard ActivityAuthorizationInfo().areActivitiesEnabled, !isReconciling else { return }
        guard let requesterId else {
            await endAll()
            return
        }
        isReconciling = true
        defer { isReconciling = false }

        do {
            // `sort: endsAt` so this 5-row window is the soonest due rather than
            // the most recently started — the activity counts down to a return.
            let result = try await APIClient.shared.checkouts(activeOnly: true, requesterId: requesterId, sort: "endsAt", limit: 5, offset: 0)
            let openCheckouts = result.data.filter { $0.kind == .checkout && $0.status == .open }
            guard !openCheckouts.isEmpty else {
                await endAllAsReturned()
                return
            }

            let candidates = await buildCandidates(from: openCheckouts)
            guard let selected = candidates.sorted(by: candidateSort).first else {
                await endAllAsReturned()
                return
            }
            await upsertActivity(for: selected)
        } catch {
            // Live Activities are a secondary surface. Leave any existing
            // activity alone on transient network failures.
        }
    }

    func endAll() async {
        cancelAllObservers()
        for activity in Activity<CheckoutReturnActivityAttributes>.activities {
            await activity.end(nil, dismissalPolicy: .immediate)
        }
    }

    /// Ends any existing activities with a brief green "Returned" confirmation
    /// instead of dismissing immediately, matching the push-driven end path
    /// (`endCheckoutReturnLiveActivityTokens`). Used when the local reconciler
    /// discovers the user's checkout is no longer open (i.e. it was returned
    /// while the app was active), as opposed to logout or stale-activity
    /// housekeeping, which stay `.immediate`.
    private func endAllAsReturned() async {
        let now = Date()
        for activity in Activity<CheckoutReturnActivityAttributes>.activities {
            let returnedState = CheckoutReturnActivityAttributes.ContentState(
                endsAt: activity.content.state.endsAt,
                now: now,
                nextNeedAt: nil,
                allowsExtend: false,
                urgency: .returned
            )
            await activity.end(
                ActivityContent(state: returnedState, staleDate: nil),
                dismissalPolicy: .after(now.addingTimeInterval(120))
            )
        }
    }

    private func buildCandidates(from bookings: [Booking]) async -> [CheckoutReturnCandidate] {
        var output: [CheckoutReturnCandidate] = []
        let now = Date()

        for booking in bookings {
            let insight = await APIClient.shared.checkoutReturnInsight(for: booking)
            let nextNeedAt = insight.nextNeedAt
            let nextNeedGap = nextNeedAt.map { $0.timeIntervalSince(booking.endsAt) }
            let smartLead = nextNeedGap.map { gap in
                gap > 0 ? min(max(gap, defaultLeadTime), maxNextNeedLeadTime) : defaultLeadTime
            } ?? defaultLeadTime
            let startsAt = booking.endsAt.addingTimeInterval(-smartLead)
            guard now >= startsAt || booking.endsAt <= now else { continue }

            output.append(CheckoutReturnCandidate(
                booking: booking,
                nextNeedAt: nextNeedAt,
                allowsExtend: !insight.hasUpcomingNeed,
                leadStartsAt: startsAt
            ))
        }

        return output
    }

    private func candidateSort(lhs: CheckoutReturnCandidate, rhs: CheckoutReturnCandidate) -> Bool {
        let now = Date()
        let lhsOverdue = lhs.booking.endsAt <= now
        let rhsOverdue = rhs.booking.endsAt <= now
        if lhsOverdue != rhsOverdue { return lhsOverdue }
        return lhs.booking.endsAt < rhs.booking.endsAt
    }

    private func upsertActivity(for candidate: CheckoutReturnCandidate) async {
        let attributes = CheckoutReturnActivityAttributes(
            bookingId: candidate.booking.id,
            bookingTitle: candidate.booking.title,
            requesterName: candidate.booking.requester.name,
            requesterInitials: initials(for: candidate.booking.requester.name),
            requesterAvatarUrl: candidate.booking.requester.avatarUrl,
            returnTimeText: "Return \(candidate.booking.endsAt.gearTime)"
        )
        let content = ActivityContent(
            state: contentState(for: candidate),
            staleDate: candidate.booking.endsAt.addingTimeInterval(6 * 60 * 60)
        )

        for activity in Activity<CheckoutReturnActivityAttributes>.activities where activity.attributes.bookingId != candidate.booking.id {
            await activity.end(nil, dismissalPolicy: .immediate)
        }

        if let existing = Activity<CheckoutReturnActivityAttributes>.activities.first(where: { $0.attributes.bookingId == candidate.booking.id }) {
            let existingId = existing.id
            await existing.update(content)
            if let updated = Activity<CheckoutReturnActivityAttributes>.activities.first(where: { $0.id == existingId }) {
                observePushToken(for: updated, bookingId: candidate.booking.id)
            }
            return
        }

        do {
            let activity = try Activity.request(attributes: attributes, content: content, pushType: .token)
            observePushToken(for: activity, bookingId: candidate.booking.id)
        } catch {
            // Best-effort only. The app still has normal due/overdue surfaces.
        }
    }

    private func observeExistingActivities() {
        for activity in Activity<CheckoutReturnActivityAttributes>.activities {
            observePushToken(for: activity, bookingId: activity.attributes.bookingId)
        }
    }

    private func observePushToStartTokens() {
        guard !isObservingPushToStartTokens else { return }
        isObservingPushToStartTokens = true

        Task {
            for await tokenData in Activity<CheckoutReturnActivityAttributes>.pushToStartTokenUpdates {
                let token = hexToken(from: tokenData)
                try? await APIClient.shared.registerCheckoutReturnLiveActivityStartToken(token)
            }
        }
    }

    private func observeActivityUpdates() {
        guard !isObservingActivityUpdates else { return }
        isObservingActivityUpdates = true

        Task {
            for await activity in Activity<CheckoutReturnActivityAttributes>.activityUpdates {
                observePushToken(for: activity, bookingId: activity.attributes.bookingId)
            }
        }
    }

    private func contentState(for candidate: CheckoutReturnCandidate) -> CheckoutReturnActivityAttributes.ContentState {
        let now = Date()
        return CheckoutReturnActivityAttributes.ContentState(
            endsAt: candidate.booking.endsAt,
            now: now,
            nextNeedAt: candidate.nextNeedAt,
            allowsExtend: candidate.allowsExtend,
            urgency: urgency(for: candidate.booking, now: now)
        )
    }

    private func urgency(for booking: Booking, now: Date) -> CheckoutReturnActivityAttributes.ContentState.Urgency {
        if booking.endsAt <= now { return .overdue }
        let remaining = booking.endsAt.timeIntervalSince(now)
        if remaining <= 10 * 60 { return .critical }
        if remaining <= 30 * 60 { return .warning }
        return .normal
    }

    private func initials(for name: String) -> String {
        let parts = name.split(separator: " ")
        let letters = parts.prefix(2).compactMap(\.first)
        return letters.isEmpty ? "?" : String(letters).uppercased()
    }

    private func observePushToken(
        for activity: Activity<CheckoutReturnActivityAttributes>,
        bookingId: String
    ) {
        guard tokenObservers[activity.id] == nil else { return }
        if let tokenData = activity.pushToken {
            Task {
                try? await APIClient.shared.registerCheckoutReturnLiveActivity(
                    bookingId: bookingId,
                    token: hexToken(from: tokenData)
                )
            }
        }
        let activityId = activity.id
        tokenObservers[activityId] = Task { [weak self] in
            for await tokenData in activity.pushTokenUpdates {
                try? await APIClient.shared.registerCheckoutReturnLiveActivity(
                    bookingId: bookingId,
                    token: hexToken(from: tokenData)
                )
            }
            // `pushTokenUpdates` finishes when the activity ends, which is the
            // only reliable signal we get that this observer is done.
            await self?.forgetObserver(activityId)
        }
    }

    private func forgetObserver(_ activityId: String) {
        tokenObservers[activityId] = nil
    }

    /// Cancels every outstanding token observer. Used on sign-out, where the
    /// activities themselves are ended and their tokens revoked server-side.
    private func cancelAllObservers() {
        for task in tokenObservers.values { task.cancel() }
        tokenObservers.removeAll()
    }
}

/// Free function rather than a method so the token-observation tasks can call
/// it without capturing the manager.
private func hexToken(from data: Data) -> String {
    data.map { String(format: "%02x", $0) }.joined()
}

private struct CheckoutReturnCandidate {
    let booking: Booking
    let nextNeedAt: Date?
    let allowsExtend: Bool
    let leadStartsAt: Date
}
