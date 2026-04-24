import SwiftUI

private let kioskRed = Color(red: 197/255, green: 5/255, blue: 12/255)

struct KioskIdleView: View {
    @Environment(KioskStore.self) private var store
    @State private var dashboard: KioskDashboard?
    @State private var users: [KioskUser] = []
    @State private var isLoading = false

    private let refreshInterval: TimeInterval = 30

    var body: some View {
        HStack(spacing: 0) {
            // Left panel — stats + events + active checkouts
            leftPanel
                .frame(maxWidth: .infinity)
                .padding(24)

            Divider()
                .background(Color.white.opacity(0.1))

            // Right panel — user roster grid
            rosterPanel
                .frame(width: 420)
                .padding(24)
        }
        .task { await loadAll() }
        .task(id: "refresh") {
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: UInt64(refreshInterval * 1_000_000_000))
                await loadAll()
            }
        }
    }

    // MARK: - Left Panel

    private var leftPanel: some View {
        VStack(alignment: .leading, spacing: 24) {
            // Header
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(store.info?.name ?? "Gear Room")
                        .font(.title2.bold())
                        .foregroundStyle(.white)
                    Text(Date(), format: .dateTime.weekday(.wide).month().day())
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Button("Deactivate") { store.deactivate() }
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            // Stats row
            if let stats = dashboard?.stats {
                HStack(spacing: 16) {
                    StatTile(value: stats.itemsOut, label: "Items Out", accent: .white)
                    StatTile(value: stats.checkouts, label: "Checkouts", accent: .white)
                    StatTile(value: stats.overdue, label: "Overdue", accent: stats.overdue > 0 ? kioskRed : .white)
                }
            } else {
                HStack(spacing: 16) {
                    ForEach(0..<3, id: \.self) { _ in
                        RoundedRectangle(cornerRadius: 12)
                            .fill(Color.white.opacity(0.05))
                            .frame(maxWidth: .infinity)
                            .frame(height: 80)
                    }
                }
            }

            // Today's events
            if let events = dashboard?.events, !events.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Today")
                        .font(.caption.uppercaseSmallCaps())
                        .foregroundStyle(.secondary)
                    ForEach(events) { event in
                        KioskEventRow(event: event)
                    }
                }
            }

            // Active checkouts
            if let checkouts = dashboard?.checkouts, !checkouts.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Active Checkouts")
                        .font(.caption.uppercaseSmallCaps())
                        .foregroundStyle(.secondary)
                    ForEach(checkouts.prefix(6)) { checkout in
                        CheckoutRow(checkout: checkout)
                    }
                }
            }

            Spacer()
        }
    }

    // MARK: - Roster Panel

    private var rosterPanel: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Select your name")
                .font(.headline)
                .foregroundStyle(.secondary)

            if users.isEmpty && isLoading {
                ProgressView().tint(.white).frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                ScrollView {
                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                        ForEach(users) { user in
                            UserTile(user: user) {
                                store.screen = .studentHub(user)
                            }
                        }
                    }
                }
            }
        }
    }

    private func loadAll() async {
        isLoading = true
        async let dashboardResult = KioskAPI.shared.kioskDashboard()
        async let usersResult = KioskAPI.shared.kioskUsers()
        dashboard = try? await dashboardResult
        users = (try? await usersResult) ?? users
        isLoading = false
    }
}

// MARK: - Sub-views

private struct StatTile: View {
    let value: Int
    let label: String
    let accent: Color

    var body: some View {
        VStack(spacing: 4) {
            Text("\(value)")
                .font(.system(size: 36, weight: .bold, design: .rounded))
                .foregroundStyle(accent)
            Text(label)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 16)
        .background(Color.white.opacity(0.05), in: RoundedRectangle(cornerRadius: 12))
    }
}

private struct KioskEventRow: View {
    let event: KioskEvent

    var body: some View {
        HStack {
            Text(event.startsAt, format: .dateTime.hour().minute())
                .font(.caption.monospaced())
                .foregroundStyle(.secondary)
                .frame(width: 50, alignment: .leading)
            Text(event.title)
                .font(.subheadline)
                .foregroundStyle(.white)
                .lineLimit(1)
            Spacer()
            if event.shiftCount > 0 {
                Text("\(event.shiftCount) shifts")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(Color.white.opacity(0.04), in: RoundedRectangle(cornerRadius: 8))
    }
}

private struct CheckoutRow: View {
    let checkout: KioskActiveCheckout

    var body: some View {
        HStack {
            Circle()
                .fill(checkout.isOverdue ? Color(red: 197/255, green: 5/255, blue: 12/255).opacity(0.3) : Color.white.opacity(0.1))
                .frame(width: 36, height: 36)
                .overlay {
                    Text(checkout.requesterInitials)
                        .font(.caption.bold())
                        .foregroundStyle(.white)
                }
            VStack(alignment: .leading, spacing: 2) {
                Text(checkout.requesterName)
                    .font(.subheadline)
                    .foregroundStyle(.white)
                Text(checkout.items.prefix(2).map(\.name).joined(separator: ", "))
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            Spacer()
            if checkout.isOverdue {
                Image(systemName: "exclamationmark.triangle.fill")
                    .foregroundStyle(.red)
                    .font(.caption)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(Color.white.opacity(0.04), in: RoundedRectangle(cornerRadius: 8))
    }
}

private struct UserTile: View {
    let user: KioskUser
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            VStack(spacing: 8) {
                Circle()
                    .fill(Color.white.opacity(0.12))
                    .frame(width: 52, height: 52)
                    .overlay {
                        Text(user.initials)
                            .font(.headline.bold())
                            .foregroundStyle(.white)
                    }
                Text(user.name.components(separatedBy: " ").first ?? user.name)
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(.white)
                    .lineLimit(1)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 16)
            .background(Color.white.opacity(0.05), in: RoundedRectangle(cornerRadius: 12))
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(Color.white.opacity(0.08), lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }
}
