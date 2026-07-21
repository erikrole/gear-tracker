import SwiftUI

struct KioskStudentHubView: View {
    @Environment(KioskStore.self) private var store
    let user: KioskUser
    @State private var context: KioskStudentContext?
    @State private var isLoading = true
    @State private var error: String?
    @State private var selectedCheckout: KioskCheckoutDrawerContext?
    @State private var scanFeedback: ScanRouteFeedback?
    @State private var scanFeedbackDismissTask: Task<Void, Never>?

    private enum ScanRouteFeedback: Equatable {
        case warning(String)
        case error(String)

        var message: String {
            switch self {
            case .warning(let s), .error(let s): return s
            }
        }

        var tone: KioskBannerTone {
            switch self {
            case .warning: .warning
            case .error: .error
            }
        }
    }

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

            if let scanFeedback {
                KioskFeedbackBanner(tone: scanFeedback.tone, message: scanFeedback.message)
                    .padding(.horizontal, KioskSpacing.lg)
                    .padding(.top, KioskSpacing.sm)
                    .transition(.move(edge: .top).combined(with: .opacity))
            }

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
        .overlay(alignment: .bottom) {
            if selectedCheckout == nil {
                HIDScannerField(onScan: { store.scanner.receive($0) }).frame(width: 1, height: 1).opacity(0)
            }
        }
        .task {
            store.scanner.claim(.studentHub) { routeScan($0) }
            await loadContext()
        }
        .onDisappear { store.scanner.release(.studentHub) }
        .task(id: "refresh") {
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: UInt64(refreshInterval * 1_000_000_000))
                await loadContext()
            }
        }
        .sheet(item: $selectedCheckout) { checkout in
            KioskCheckoutDetailSheet(
                context: checkout,
                allowsEditing: true,
                onReturn: {
                    startReturn(checkout)
                }
            ) {
                Task { await loadContext() }
            }
            .presentationDetents([.height(620), .large])
            .presentationDragIndicator(.visible)
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
                            subtitle: checkoutActionSubtitle,
                            icon: "arrow.up.circle.fill",
                            color: Color.kioskRed,
                            isHero: true
                        ) {
                            store.setIntent(KioskFlowIntent(action: .checkout, source: .person, identifiedUser: user, expectedRequester: nil, selectedEvent: nil, targetBooking: nil, pendingScanValues: [], createdAt: Date(), ambiguity: .none))
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
                                    startPickup(id: pickup.id, title: pickup.title, startsAt: pickup.startsAt)
                                }
                            }
                        }

                        if let checkouts = context?.checkouts, !checkouts.isEmpty {
                            ForEach(checkouts) { checkout in
                                ActionButton(
                                    title: "Manage: \(checkout.title)",
                                    subtitle: checkoutSubtitle(checkout),
                                    icon: "arrow.down.circle.fill",
                                    color: checkout.isOverdue ? Color.statusText(.red) : Color.statusText(.blue),
                                    dueText: dueChipText(checkout),
                                    dueIsOverdue: checkout.isOverdue
                                ) {
                                    selectedCheckout = KioskCheckoutDrawerContext(
                                        checkoutId: checkout.id,
                                        title: checkout.title,
                                        requesterId: user.id,
                                        requesterName: user.name,
                                        requesterAvatarUrl: user.avatarUrl,
                                        endsAt: checkout.endsAt,
                                        isOverdue: checkout.isOverdue
                                    )
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

    private var checkoutActionSubtitle: String {
        let count = store.cart(for: user.id).count
        return count > 0
            ? "Resume checkout · \(count) scanned item\(count == 1 ? "" : "s")"
            : "Scan items to check out"
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
                        ReservationCard(title: res.title, startsAt: res.startsAt) {
                            startPickup(id: res.id, title: res.title, startsAt: res.startsAt)
                        }
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

    private func routeScan(_ scan: String) {
        Task {
            do {
                let result = try await KioskAPI.shared.kioskResolveScan(scanValue: scan, userId: user.id)
                guard result.kind == "action", let action = result.action else {
                    showScanFeedback(.warning(result.message ?? "That item cannot start a flow for \(user.name)."))
                    return
                }
                let intent = KioskFlowIntent(
                    action: action,
                    source: .scan,
                    identifiedUser: user,
                    expectedRequester: result.expectedRequester,
                    selectedEvent: nil,
                    targetBooking: result.booking.map { KioskIntentBooking(id: $0.id, title: $0.title, startsAt: $0.startsAt, endsAt: $0.endsAt) },
                    pendingScanValues: [scan],
                    createdAt: Date(),
                    ambiguity: .none
                )
                store.setIntent(intent)
                switch action {
                case .checkout: store.screen = .checkout(user: user)
                case .pickup:
                    if let id = result.booking?.id { store.screen = .pickup(bookingId: id, userId: user.id) }
                case .return:
                    if let id = result.booking?.id { store.screen = .return(bookingId: id, userId: user.id) }
                case .manage: break
                }
            } catch {
                showScanFeedback(.error((error as? APIError)?.errorDescription ?? "Could not route that scan."))
            }
        }
    }

    /// Cancels any prior dismiss timer before starting a new one — without
    /// this, two scans within 3 seconds race: the first scan's timer fires
    /// after the second message is already showing and wipes it early.
    private func showScanFeedback(_ feedback: ScanRouteFeedback) {
        switch feedback {
        case .warning: Haptics.warning()
        case .error: Haptics.error()
        }
        scanFeedbackDismissTask?.cancel()
        withAnimation { scanFeedback = feedback }
        scanFeedbackDismissTask = Task {
            try? await Task.sleep(nanoseconds: 3_000_000_000)
            guard !Task.isCancelled else { return }
            withAnimation { scanFeedback = nil }
        }
    }

    private func startPickup(id: String, title: String, startsAt: Date?) {
        store.setIntent(KioskFlowIntent(
            action: .pickup, source: .reservation, identifiedUser: user, expectedRequester: user,
            selectedEvent: nil, targetBooking: KioskIntentBooking(id: id, title: title, startsAt: startsAt, endsAt: nil),
            pendingScanValues: [], createdAt: Date(), ambiguity: .none
        ))
        store.screen = .pickup(bookingId: id, userId: user.id)
    }

    private func startReturn(_ checkout: KioskCheckoutDrawerContext) {
        store.setIntent(KioskFlowIntent(
            action: .return, source: .activeCheckout, identifiedUser: user, expectedRequester: user,
            selectedEvent: nil,
            targetBooking: KioskIntentBooking(id: checkout.checkoutId, title: checkout.title, startsAt: nil, endsAt: checkout.endsAt),
            pendingScanValues: [], createdAt: Date(), ambiguity: .none
        ))
        store.screen = .return(bookingId: checkout.checkoutId, userId: user.id)
    }

    private func studentContextErrorMessage(for error: Error) -> String {
        if let apiError = error as? APIError {
            switch apiError {
            case .networkError:
                return apiError.errorDescription ?? "Check the kiosk network and try again."
            case .decodingError:
                return "The server response changed. Try again after the kiosk refreshes."
            case .conflict(let message):
                return message
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
    let action: () -> Void

    var body: some View {
        Button(action: action) {
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
                Image(systemName: "chevron.right")
                    .font(.caption)
                    .foregroundStyle(KioskText.secondary)
                    .accessibilityHidden(true)
            }
            .padding(12)
            .kioskCard(KioskSurface.card, radius: KioskRadius.md, stroke: Color.statusText(.purple).opacity(0.3))
        }
        .buttonStyle(KioskPressStyle())
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(title), \(startsAt.formatted(date: .abbreviated, time: .shortened))")
        .accessibilityHint("Start pickup now")
    }
}
