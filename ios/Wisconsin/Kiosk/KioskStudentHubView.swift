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
                Spacer()
                ProgressView().tint(.white)
                Spacer()
            } else if let error, context == nil {
                Spacer()
                errorState(message: error)
                Spacer()
            } else {
                HStack(alignment: .top, spacing: 0) {
                    actionPanel
                        .frame(maxWidth: .infinity)
                        .padding(24)

                    Divider().background(Color.white.opacity(0.1))

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
                store.screen = .idle
            } label: {
                Label("Back", systemImage: "chevron.left")
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(.secondary)
            }
            .accessibilityLabel("Back to roster")

            Spacer()

            HStack(spacing: 12) {
                userAvatar
                VStack(alignment: .leading, spacing: 2) {
                    Text(user.name)
                        .font(.headline)
                        .foregroundStyle(.white)
                    Text(user.role.capitalized)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .accessibilityElement(children: .combine)
            .accessibilityLabel("\(user.name), \(user.role.capitalized)")

            Spacer()
        }
        .padding(.horizontal, 24)
        .padding(.vertical, 16)
        .background(Color.white.opacity(0.04))
    }

    @ViewBuilder
    private var userAvatar: some View {
        let placeholder = Circle()
            .fill(Color.white.opacity(0.12))
            .frame(width: 44, height: 44)
            .overlay {
                Text(user.initials)
                    .font(.headline.bold())
                    .foregroundStyle(.white)
            }

        if let urlString = user.avatarUrl, let url = URL(string: urlString) {
            AsyncImage(url: url) { phase in
                switch phase {
                case .success(let image):
                    image.resizable().scaledToFill()
                default:
                    placeholder
                }
            }
            .frame(width: 44, height: 44)
            .clipShape(Circle())
        } else {
            placeholder
        }
    }

    // MARK: - Action Panel

    private var actionPanel: some View {
        VStack(alignment: .leading, spacing: 20) {
            Text("What do you need?")
                .font(.title3.bold())
                .foregroundStyle(.white)

            ActionButton(
                title: "Checkout Gear",
                subtitle: "Scan items to check out",
                icon: "arrow.up.circle.fill",
                color: Color.kioskRed
            ) {
                store.screen = .checkout(userId: user.id)
            }

            if let pickups = context?.pendingPickups, !pickups.isEmpty {
                ForEach(pickups) { pickup in
                    ActionButton(
                        title: "Pickup: \(pickup.title)",
                        subtitle: pickupSubtitle(pickup),
                        icon: "tray.and.arrow.down.fill",
                        color: Color.statusText(.green)
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
                        color: checkout.isOverdue ? Color.statusText(.orange) : Color.statusText(.blue)
                    ) {
                        store.screen = .return(bookingId: checkout.id, userId: user.id)
                    }
                }
            }

            Spacer()
        }
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
                .foregroundStyle(.secondary)

            if let reservations = context?.reservations, !reservations.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    Label("Upcoming Reservations", systemImage: "calendar")
                        .font(.caption.uppercaseSmallCaps())
                        .foregroundStyle(.secondary)
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
                .foregroundStyle(.secondary)
                .accessibilityHidden(true)
            Text("Nothing reserved this week")
                .font(.subheadline)
                .foregroundStyle(.secondary)
            Text("You're all clear — tap Checkout Gear to grab something.")
                .font(.caption)
                .foregroundStyle(.tertiary)
        }
        .padding(.top, 4)
        .accessibilityElement(children: .combine)
    }

    // MARK: - Error state

    private func errorState(message: String) -> some View {
        VStack(spacing: 14) {
            Image(systemName: "wifi.exclamationmark")
                .font(.system(size: 44))
                .foregroundStyle(.secondary)
                .accessibilityHidden(true)
            Text("Couldn't load your information")
                .font(.headline)
                .foregroundStyle(.white)
            Text(message)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)
            Button {
                Task { await loadContext() }
            } label: {
                Text("Try again")
                    .font(.headline)
                    .foregroundStyle(.white)
                    .padding(.horizontal, 22)
                    .padding(.vertical, 10)
                    .background(Color.kioskRed, in: Capsule())
            }
            .buttonStyle(.plain)
        }
    }

    private func loadContext() async {
        if context == nil { isLoading = true }
        defer { isLoading = false }
        do {
            context = try await KioskAPI.shared.kioskStudentContext(userId: user.id)
            error = nil
        } catch {
            // Keep last-good context; if we never had one, surface the error
            // page. Otherwise the next refresh will retry silently.
            if context == nil {
                self.error = "Check your connection and try again."
            }
        }
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
                        .foregroundStyle(.white)
                    Text(subtitle)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .accessibilityHidden(true)
            }
            .padding(16)
            .background(Color.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 14))
            .overlay(
                RoundedRectangle(cornerRadius: 14)
                    .stroke(color.opacity(0.3), lineWidth: 1)
            )
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
                    .foregroundStyle(.white)
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
        .background(Color.white.opacity(0.04), in: RoundedRectangle(cornerRadius: 10))
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
        return Color.white.opacity(0.6)
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
