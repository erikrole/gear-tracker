import SwiftUI

struct KioskStudentHubView: View {
    @Environment(KioskStore.self) private var store
    let user: KioskUser
    @State private var context: KioskStudentContext?
    @State private var isLoading = true
    @State private var error: String?

    var body: some View {
        VStack(spacing: 0) {
            // Top bar
            HStack {
                Button {
                    store.screen = .idle
                } label: {
                    Label("Back", systemImage: "chevron.left")
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(.secondary)
                }

                Spacer()

                HStack(spacing: 12) {
                    Circle()
                        .fill(Color.white.opacity(0.12))
                        .frame(width: 44, height: 44)
                        .overlay {
                            Text(user.initials)
                                .font(.headline.bold())
                                .foregroundStyle(.white)
                        }
                    VStack(alignment: .leading, spacing: 2) {
                        Text(user.name)
                            .font(.headline)
                            .foregroundStyle(.white)
                        Text(user.role.capitalized)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }

                Spacer()
            }
            .padding(.horizontal, 24)
            .padding(.vertical, 16)
            .background(Color.white.opacity(0.04))

            if isLoading {
                Spacer()
                ProgressView().tint(.white)
                Spacer()
            } else if let error {
                Spacer()
                Text(error).foregroundStyle(.secondary)
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
                        subtitle: "\(pickup.serializedItems.count) items",
                        icon: "tray.and.arrow.down.fill",
                        color: Color(red: 0.2, green: 0.6, blue: 0.3)
                    ) {
                        store.screen = .pickup(bookingId: pickup.id, userId: user.id)
                    }
                }
            }

            if let checkouts = context?.checkouts, !checkouts.isEmpty {
                ForEach(checkouts) { checkout in
                    ActionButton(
                        title: "Return: \(checkout.title)",
                        subtitle: "\(checkout.items.count) items\(checkout.isOverdue ? " · Overdue" : "")",
                        icon: "arrow.down.circle.fill",
                        color: checkout.isOverdue ? .orange : .blue
                    ) {
                        store.screen = .return(bookingId: checkout.id, userId: user.id)
                    }
                }
            }

            Spacer()
        }
    }

    // MARK: - Status Panel

    private var statusPanel: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Your Activity")
                .font(.headline)
                .foregroundStyle(.secondary)

            if let checkouts = context?.checkouts, !checkouts.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    Label("Active Checkouts", systemImage: "arrow.up.circle")
                        .font(.caption.uppercaseSmallCaps())
                        .foregroundStyle(.secondary)
                    ForEach(checkouts) { checkout in
                        StatusCard(
                            title: checkout.title,
                            detail: "Due \(checkout.endsAt.formatted(.relative(presentation: .named)))",
                            isAlert: checkout.isOverdue
                        )
                    }
                }
            }

            if let reservations = context?.reservations, !reservations.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    Label("Upcoming Reservations", systemImage: "calendar")
                        .font(.caption.uppercaseSmallCaps())
                        .foregroundStyle(.secondary)
                    ForEach(reservations) { res in
                        StatusCard(
                            title: res.title,
                            detail: res.startsAt.formatted(.dateTime.weekday(.abbreviated).month().day().hour().minute()),
                            isAlert: false
                        )
                    }
                }
            }

            if context?.checkouts.isEmpty == true && context?.reservations.isEmpty == true {
                Text("No active equipment")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }

            Spacer()
        }
    }

    private func loadContext() async {
        isLoading = true
        error = nil
        do {
            context = try await KioskAPI.shared.kioskStudentContext(userId: user.id)
        } catch {
            self.error = "Could not load your information."
        }
        isLoading = false
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
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.headline)
                        .foregroundStyle(.white)
                    Text(subtitle)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            .padding(16)
            .background(Color.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 14))
            .overlay(
                RoundedRectangle(cornerRadius: 14)
                    .stroke(color.opacity(0.3), lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }
}

private struct StatusCard: View {
    let title: String
    let detail: String
    let isAlert: Bool

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.subheadline)
                    .foregroundStyle(.white)
                    .lineLimit(1)
                Text(detail)
                    .font(.caption)
                    .foregroundStyle(isAlert ? .orange : .secondary)
            }
            Spacer()
            if isAlert {
                Image(systemName: "exclamationmark.triangle.fill")
                    .foregroundStyle(.orange)
                    .font(.caption)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(Color.white.opacity(0.04), in: RoundedRectangle(cornerRadius: 10))
    }
}
