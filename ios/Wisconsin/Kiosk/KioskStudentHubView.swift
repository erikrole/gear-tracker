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
            topBar

            if isLoading && context == nil {
                loadingSkeleton
            } else if let error, context == nil {
                Spacer()
                errorState(message: error)
                Spacer()
            } else {
                HStack(alignment: .top, spacing: 0) {
                    actionPanel
                        .frame(maxWidth: .infinity)
                        .padding(24)

                    Divider().background(KioskStroke.divider)

                    statusPanel
                        .frame(maxWidth: .infinity)
                        .padding(24)
                }
            }
        }
        .task { await loadContext() }
        .task(id: "refresh") {
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: UInt64(refreshInterval * 1_000_000_000))
                await loadContext()
            }
        }
    }

    // MARK: - Top bar

    private var topBar: some View {
        HStack {
            Button {
                store.deferSleepMode()
                store.screen = .idle
            } label: {
                Label("Back", systemImage: "chevron.left")
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(KioskText.secondary)
            }
            .accessibilityLabel("Back to roster")

            Spacer()

            HStack(spacing: 12) {
                userAvatar
                VStack(alignment: .leading, spacing: 2) {
                    Text(user.name)
                        .font(.headline)
                        .foregroundStyle(KioskText.primary)
                    Text(user.role.capitalized)
                        .font(.caption)
                        .foregroundStyle(KioskText.secondary)
                }
            }
            .accessibilityElement(children: .combine)
            .accessibilityLabel("\(user.name), \(user.role.capitalized)")

            Spacer()
        }
        .padding(.horizontal, 24)
        .padding(.vertical, 16)
        .background(KioskSurface.low)
    }

    private var userAvatar: some View {
        KioskAvatar(url: user.avatarUrl, initials: user.initials, size: 44)
    }

    // MARK: - Action Panel

    private var actionPanel: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("What do you need?")
                .font(.title3.bold())
                .foregroundStyle(KioskText.primary)

            // A student with several open checkouts/pickups would otherwise push
            // the lower actions off-screen — keep the list scrollable.
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    ActionButton(
                        title: "Checkout Gear",
                        subtitle: "Scan items to check out",
                        icon: "arrow.up.circle.fill",
                        color: Color.kioskRed
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
                                color: checkout.isOverdue ? Color.statusText(.red) : Color.statusText(.blue)
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

    private var loadingSkeleton: some View {
        HStack(alignment: .top, spacing: 0) {
            VStack(alignment: .leading, spacing: 18) {
                KioskSkeletonBox(cornerRadius: 8).frame(width: 200, height: 26)
                ForEach(0..<3, id: \.self) { _ in
                    KioskSkeletonBox(cornerRadius: KioskRadius.lg).frame(height: 76)
                }
                Spacer()
            }
            .frame(maxWidth: .infinity)
            .padding(24)

            Divider().background(KioskStroke.divider)

            VStack(alignment: .leading, spacing: 14) {
                KioskSkeletonBox(cornerRadius: 8).frame(width: 140, height: 22)
                ForEach(0..<2, id: \.self) { _ in
                    KioskSkeletonBox(cornerRadius: KioskRadius.sm).frame(height: 52)
                }
                Spacer()
            }
            .frame(maxWidth: .infinity)
            .padding(24)
        }
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
        let body = head.isEmpty
            ? "\(checkout.items.count) items"
            : (extra > 0 ? "\(head) · +\(extra) more" : head)
        return checkout.isOverdue ? "\(body) · Overdue" : body
    }

    // MARK: - Status Panel — upcoming reservations only (active checkouts and
    // pending pickups already appear as action buttons; no need to repeat).

    private var statusPanel: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Coming Up")
                .font(.headline)
                .foregroundStyle(KioskText.secondary)

            if let reservations = context?.reservations, !reservations.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    Label("Upcoming Reservations", systemImage: "calendar")
                        .font(.caption.uppercaseSmallCaps())
                        .foregroundStyle(KioskText.secondary)
                    ForEach(reservations) { res in
                        StatusCard(
                            title: res.title,
                            detail: res.startsAt.formatted(.dateTime.weekday(.abbreviated).month().day().hour().minute()),
                            tone: .purple
                        )
                    }
                }
            } else {
                emptyStatus
            }

            Spacer()
        }
    }

    private var emptyStatus: some View {
        VStack(alignment: .leading, spacing: 6) {
            Image(systemName: "calendar")
                .font(.title3)
                .foregroundStyle(KioskText.secondary)
                .accessibilityHidden(true)
            Text("Nothing reserved this week")
                .font(.subheadline)
                .foregroundStyle(KioskText.secondary)
            Text("You're all clear — tap Checkout Gear to grab something.")
                .font(.caption)
                .foregroundStyle(KioskText.tertiary)
        }
        .padding(.top, 4)
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
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 16) {
                Image(systemName: icon)
                    .font(.title2)
                    .foregroundStyle(color)
                    .frame(width: 40)
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.headline)
                        .foregroundStyle(KioskText.primary)
                    Text(subtitle)
                        .font(.caption)
                        .foregroundStyle(KioskText.secondary)
                        .lineLimit(1)
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.caption)
                    .foregroundStyle(KioskText.secondary)
                    .accessibilityHidden(true)
            }
            .padding(16)
            .kioskCard(KioskSurface.card, radius: KioskRadius.lg, stroke: color.opacity(0.3))
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(title), \(subtitle)")
    }
}

private struct StatusCard: View {
    let title: String
    let detail: String
    let tone: StatusTone?

    init(title: String, detail: String, tone: StatusTone? = nil) {
        self.title = title
        self.detail = detail
        self.tone = tone
    }

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.subheadline)
                    .foregroundStyle(KioskText.primary)
                    .lineLimit(1)
                Text(detail)
                    .font(.caption)
                    .foregroundStyle(detailColor)
            }
            Spacer()
            if let tone, tone == .orange || tone == .red {
                Image(systemName: "exclamationmark.triangle.fill")
                    .foregroundStyle(Color.statusText(tone))
                    .font(.caption)
                    .accessibilityHidden(true)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(KioskSurface.low, in: RoundedRectangle(cornerRadius: KioskRadius.sm))
        .overlay(alignment: .leading) {
            // Left-edge tone marker — glanceable, doesn't compete with text.
            if let tone {
                RoundedRectangle(cornerRadius: 2)
                    .fill(Color.statusText(tone))
                    .frame(width: 3)
                    .padding(.vertical, 6)
                    .padding(.leading, 0)
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(accessibilityLabel)
    }

    private var detailColor: Color {
        if let tone, tone == .orange || tone == .red {
            return Color.statusText(tone)
        }
        return KioskText.tertiary
    }

    private var accessibilityLabel: String {
        let prefix: String
        switch tone {
        case .orange, .red: prefix = "Overdue: "
        default: prefix = ""
        }
        return "\(prefix)\(title), \(detail)"
    }
}
