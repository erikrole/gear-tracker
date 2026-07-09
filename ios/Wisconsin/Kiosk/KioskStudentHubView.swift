import SwiftUI

struct KioskStudentHubView: View {
    @Environment(KioskStore.self) private var store
    let user: KioskUser
    @State private var context: KioskStudentContext?
    @State private var isLoading = true
    @State private var error: String?

    private let refreshInterval: TimeInterval = 30

    var body: some View {
        VStack(spacing: 0) {
            KioskFlowHeader(
                title: store.info?.locationName ?? "Gear Room",
                subtitle: store.info?.name,
                backAccessibilityLabel: "Back to roster",
                onBack: {
                    store.deferSleepMode()
                    store.screen = .idle
                }
            )

            if isLoading && context == nil {
                loadingSkeleton
            } else if let error, context == nil {
                Spacer()
                errorState(message: error)
                Spacer()
            } else {
                KioskAdaptiveSplit(compactSecondaryFraction: 0.40) { _ in
                    actionPanel
                } secondary: { _ in
                    statusPanel
                }
                .padding(.top, KioskSpacing.lg)
            }
        }
        .kioskScreenPadding()
        .task { await loadContext() }
        .task(id: "refresh") {
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: UInt64(refreshInterval * 1_000_000_000))
                await loadContext()
            }
        }
    }

    // MARK: - Action Panel

    private var actionPanel: some View {
        VStack(alignment: .leading, spacing: KioskSpacing.lg) {
            identityHero

            VStack(alignment: .leading, spacing: KioskSpacing.md) {
                Text("What do you need?")
                    .font(.title3.bold())
                    .foregroundStyle(KioskText.primary)

                // A student with several open checkouts/pickups would otherwise push
                // the lower actions off-screen — keep the list scrollable.
                ScrollView {
                    VStack(alignment: .leading, spacing: KioskSpacing.md) {
                        ActionButton(
                            title: "Checkout Gear",
                            subtitle: "Scan items to check out",
                            icon: "arrow.up.circle.fill",
                            color: Color.kioskRed,
                            isHero: true
                        ) {
                            store.screen = .checkout(user: user)
                        }

                        if let pickups = context?.pendingPickups, !pickups.isEmpty {
                            ForEach(pickups) { pickup in
                                ActionButton(
                                    title: "Pickup: \(pickup.title)",
                                    subtitle: pickupSubtitle(pickup),
                                    icon: "tray.and.arrow.down.fill",
                                    color: Color.statusText(.orange)
                                ) {
                                    store.screen = .pickup(bookingId: pickup.id, userId: user.id)
                                }
                            }
                        }

                        if let checkouts = context?.checkouts, !checkouts.isEmpty {
                            ForEach(checkouts) { checkout in
                                ActionButton(
                                    title: "Return: \(checkout.title)",
                                    subtitle: checkoutSubtitle(checkout),
                                    icon: "arrow.down.circle.fill",
                                    color: checkout.isOverdue ? Color.statusText(.red) : Color.statusText(.blue),
                                    dueText: dueChipText(checkout),
                                    dueIsOverdue: checkout.isOverdue
                                ) {
                                    store.screen = .return(bookingId: checkout.id, userId: user.id)
                                }
                            }
                        }
                    }
                    .padding(.bottom, 8)
                }
                .scrollIndicators(.visible)
            }
        }
    }

    /// The identity moment: big avatar, time-aware greeting, Gotham name.
    /// The hub previously showed identity only in a small top-bar cluster,
    /// leaving the 13" canvas anonymous and barren.
    private var identityHero: some View {
        HStack(spacing: 16) {
            KioskAvatar(url: user.avatarUrl, initials: user.initials, size: 72)
            VStack(alignment: .leading, spacing: 3) {
                Text(greetingOverline)
                    .font(.caption.weight(.bold))
                    .tracking(1.2)
                    .foregroundStyle(KioskText.muted)
                Text(user.name)
                    .font(.gothamBold(size: 34))
                    .foregroundStyle(KioskText.primary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                Text(user.role.capitalized)
                    .font(.subheadline)
                    .foregroundStyle(KioskText.tertiary)
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(user.name), \(user.role.capitalized)")
    }

    private var greetingOverline: String {
        let hour = Calendar.current.component(.hour, from: Date())
        switch hour {
        case 5..<12: return "GOOD MORNING"
        case 12..<17: return "GOOD AFTERNOON"
        default: return "GOOD EVENING"
        }
    }

    private var loadingSkeleton: some View {
        KioskAdaptiveSplit(compactSecondaryFraction: 0.34) { _ in
            VStack(alignment: .leading, spacing: 18) {
                HStack(spacing: 16) {
                    KioskSkeletonBox(cornerRadius: 36).frame(width: 72, height: 72)
                    KioskSkeletonBox(cornerRadius: 8).frame(width: 220, height: 34)
                }
                ForEach(0..<3, id: \.self) { _ in
                    KioskSkeletonBox(cornerRadius: KioskRadius.lg).frame(height: 88)
                }
                Spacer()
            }
            .frame(maxWidth: .infinity)
        } secondary: { _ in
            VStack(alignment: .leading, spacing: 14) {
                KioskSkeletonBox(cornerRadius: 8).frame(width: 140, height: 22)
                ForEach(0..<2, id: \.self) { _ in
                    KioskSkeletonBox(cornerRadius: KioskRadius.sm).frame(height: 72)
                }
                Spacer()
            }
            .frame(maxWidth: .infinity)
        }
        .padding(.top, KioskSpacing.lg)
        .accessibilityLabel("Loading your gear")
    }

    private func pickupSubtitle(_ pickup: KioskPendingPickup) -> String {
        let names = pickup.serializedItems.prefix(2).map(\.name)
        let head = names.joined(separator: ", ")
        let extra = pickup.itemCount - names.count
        if head.isEmpty {
            return "\(pickup.itemCount) items"
        }
        return extra > 0 ? "\(head) · +\(extra) more" : head
    }

    private func checkoutSubtitle(_ checkout: KioskStudentCheckout) -> String {
        let names = checkout.items.prefix(2).map(\.name)
        let head = names.joined(separator: ", ")
        let extra = checkout.items.count - names.count
        if head.isEmpty {
            return "\(checkout.items.count) items"
        }
        return extra > 0 ? "\(head) · +\(extra) more" : head
    }

    private func dueChipText(_ checkout: KioskStudentCheckout) -> String {
        let stamp = checkout.endsAt.formatted(.dateTime.weekday(.abbreviated).hour().minute())
        return checkout.isOverdue ? "Overdue · was due \(stamp)" : "Due \(stamp)"
    }

    // MARK: - Status Panel — upcoming reservations only (active checkouts and
    // pending pickups already appear as action buttons; no need to repeat).

    private var statusPanel: some View {
        VStack(alignment: .leading, spacing: KioskSpacing.md) {
            Text("Coming Up")
                .font(.headline)
                .foregroundStyle(KioskText.secondary)

            if let reservations = context?.reservations, !reservations.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    ForEach(reservations) { res in
                        ReservationCard(title: res.title, startsAt: res.startsAt)
                    }
                }
            } else {
                emptyStatus
            }

            sessionSummary

            Spacer()
        }
    }

    /// Client-side rollup of what this student currently has out, so the
    /// right panel earns its half of the screen even without reservations.
    @ViewBuilder
    private var sessionSummary: some View {
        if let checkouts = context?.checkouts, !checkouts.isEmpty {
            let itemsOut = checkouts.reduce(0) { $0 + $1.items.count }
            let soonest = checkouts.map(\.endsAt).min()
            let hasOverdue = checkouts.contains(where: \.isOverdue)
            VStack(alignment: .leading, spacing: 8) {
                Text("YOUR SESSION")
                    .font(.caption.weight(.bold))
                    .tracking(1.2)
                    .foregroundStyle(KioskText.muted)
                HStack(spacing: 12) {
                    KioskSectionIcon(
                        systemImage: "backpack.fill",
                        tint: hasOverdue ? Color.statusText(.red) : Color.statusText(.blue),
                        size: 44
                    )
                    VStack(alignment: .leading, spacing: 2) {
                        Text("\(itemsOut) item\(itemsOut == 1 ? "" : "s") out with you")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(KioskText.primary)
                        if hasOverdue {
                            Text("Something is overdue — return it below")
                                .font(.caption)
                                .foregroundStyle(Color.statusText(.red))
                        } else if let soonest {
                            Text("Next due \(soonest.formatted(.dateTime.weekday(.abbreviated).hour().minute()))")
                                .font(.caption)
                                .foregroundStyle(KioskText.tertiary)
                        }
                    }
                    Spacer()
                }
            }
            .padding(14)
            .kioskCard(KioskSurface.card, radius: KioskRadius.lg, stroke: KioskStroke.hairline)
            .accessibilityElement(children: .combine)
        }
    }

    private var emptyStatus: some View {
        VStack(spacing: 12) {
            ZStack {
                Circle()
                    .fill(KioskSurface.cardRaised)
                    .frame(width: 64, height: 64)
                Image(systemName: "calendar")
                    .font(.title2)
                    .foregroundStyle(KioskText.secondary)
            }
            .accessibilityHidden(true)
            Text("Nothing reserved this week")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(KioskText.primary)
            Text("You're all clear — tap Checkout Gear to grab something.")
                .font(.caption)
                .foregroundStyle(KioskText.tertiary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 28)
        .padding(.horizontal, 16)
        .kioskCard(KioskSurface.low, radius: KioskRadius.lg, stroke: KioskStroke.hairline)
        .accessibilityElement(children: .combine)
    }

    // MARK: - Error state

    private func errorState(message: String) -> some View {
        KioskErrorState(
            title: "Couldn't load your information",
            message: message
        ) {
            Task { await loadContext() }
        }
    }

    private func loadContext() async {
        if context == nil { isLoading = true }
        defer { isLoading = false }
        do {
            context = try await KioskAPI.shared.kioskStudentContext(userId: user.id)
            error = nil
        } catch APIError.unauthorized {
            store.deactivate()
        } catch where isCancellation(error) {
            // View transitions can cancel the first load; don't turn that into
            // a visible network failure.
        } catch {
            // Keep last-good context; if we never had one, surface the error
            // page. Otherwise the next refresh will retry silently.
            if context == nil {
                self.error = studentContextErrorMessage(for: error)
            }
        }
    }

    private func studentContextErrorMessage(for error: Error) -> String {
        if let apiError = error as? APIError {
            switch apiError {
            case .networkError:
                return apiError.errorDescription ?? "Check the kiosk network and try again."
            case .decodingError:
                return "The server response changed. Try again after the kiosk refreshes."
            case .serverError(let message):
                return message
            case .notFound:
                return "This profile is no longer available at this kiosk."
            case .unauthorized:
                return apiError.errorDescription ?? "This kiosk session expired."
            }
        }
        return "Try again in a moment."
    }

    private func isCancellation(_ error: Error) -> Bool {
        if error is CancellationError {
            return true
        }
        if let apiError = error as? APIError,
           case .networkError(let underlying) = apiError {
            return isCancellation(underlying)
        }
        if let urlError = error as? URLError {
            return urlError.code == .cancelled
        }
        let nsError = error as NSError
        return nsError.domain == NSURLErrorDomain && nsError.code == NSURLErrorCancelled
    }
}

// MARK: - Sub-views

private struct ActionButton: View {
    let title: String
    let subtitle: String
    let icon: String
    let color: Color
    var isHero: Bool = false
    var dueText: String?
    var dueIsOverdue: Bool = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 16) {
                KioskSectionIcon(systemImage: icon, tint: color, size: isHero ? 56 : 44)
                VStack(alignment: .leading, spacing: 3) {
                    Text(title)
                        .font(isHero ? .title3.bold() : .headline)
                        .foregroundStyle(KioskText.primary)
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)
                    Text(subtitle)
                        .font(isHero ? .subheadline : .caption)
                        .foregroundStyle(KioskText.secondary)
                        .lineLimit(1)
                    if let dueText {
                        Text(dueText)
                            .font(.caption2.weight(.bold))
                            .foregroundStyle(dueIsOverdue ? Color.statusText(.red) : KioskText.tertiary)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 3)
                            .background(
                                (dueIsOverdue ? Color.statusText(.red) : KioskText.tertiary).opacity(0.14),
                                in: Capsule()
                            )
                            .padding(.top, 2)
                    }
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.caption)
                    .foregroundStyle(KioskText.secondary)
                    .accessibilityHidden(true)
            }
            .padding(isHero ? 20 : 16)
            .kioskCard(KioskSurface.card, radius: KioskRadius.lg, stroke: color.opacity(0.3))
            .overlay(alignment: .leading) {
                // Glanceable action-color marker on the leading edge.
                RoundedRectangle(cornerRadius: 2)
                    .fill(color)
                    .frame(width: 3)
                    .padding(.vertical, 12)
            }
        }
        .buttonStyle(KioskPressStyle())
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(title), \(subtitle)\(dueText.map { ", \($0)" } ?? "")")
    }
}

/// Calendar-block reservation row: big day-of-month over the weekday in the
/// reservation purple, so upcoming holds read at a glance.
private struct ReservationCard: View {
    let title: String
    let startsAt: Date

    var body: some View {
        HStack(spacing: 14) {
            VStack(spacing: 1) {
                Text(startsAt.formatted(.dateTime.day()))
                    .font(.title2.weight(.heavy).monospacedDigit())
                    .foregroundStyle(KioskText.primary)
                Text(startsAt.formatted(.dateTime.weekday(.abbreviated)).uppercased())
                    .font(.caption2.weight(.bold))
                    .tracking(0.8)
                    .foregroundStyle(Color.statusText(.purple))
            }
            .frame(width: 50, height: 54)
            .background(Color.statusText(.purple).opacity(0.12), in: RoundedRectangle(cornerRadius: KioskRadius.sm))

            VStack(alignment: .leading, spacing: 3) {
                Text(title)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(KioskText.primary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.85)
                Text(startsAt.formatted(date: .omitted, time: .shortened))
                    .font(.caption)
                    .foregroundStyle(KioskText.tertiary)
            }
            Spacer()
        }
        .padding(12)
        .kioskCard(KioskSurface.card, radius: KioskRadius.md, stroke: KioskStroke.hairline)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(title), \(startsAt.formatted(date: .abbreviated, time: .shortened))")
    }
}
