import SwiftUI

struct KioskIdleView: View {
    @Environment(KioskStore.self) private var store
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var dashboard: KioskDashboard?
    @State private var users: [KioskUser] = []
    @State private var isLoading = false
    @State private var lastLoadedAt: Date?
    @State private var loadFailedAt: Date?
    @State private var showDeactivateConfirm = false

    private let refreshInterval: TimeInterval = 30

    var body: some View {
        TimelineView(.periodic(from: .now, by: 30)) { _ in
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
        }
        .task { await loadAll() }
        .task(id: "refresh") {
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: UInt64(refreshInterval * 1_000_000_000))
                await loadAll()
            }
        }
        .confirmationDialog(
            "Deactivate this kiosk?",
            isPresented: $showDeactivateConfirm,
            titleVisibility: .visible
        ) {
            Button("Deactivate", role: .destructive) { store.deactivate() }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Staff will need a fresh activation code to bring this iPad back online.")
        }
    }

    // MARK: - Left Panel

    private var leftPanel: some View {
        VStack(alignment: .leading, spacing: 24) {
            // Device overline — small and quiet; the clock owns the screen.
            HStack(alignment: .top) {
                Text((store.info?.name ?? "Gear Room").uppercased())
                    .font(.caption.weight(.semibold))
                    .tracking(1.5)
                    .foregroundStyle(Color.white.opacity(0.45))
                Spacer()
                Button("Deactivate") { showDeactivateConfirm = true }
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            // Standby clock — the iPad lives plugged in on a counter, so the
            // idle screen doubles as a wall clock: live seconds, big date.
            TimelineView(.periodic(from: .now, by: 1)) { context in
                VStack(alignment: .leading, spacing: 6) {
                    Text(context.date, format: .dateTime.hour().minute().second())
                        .font(.system(size: 92, weight: .heavy, design: .rounded))
                        .monospacedDigit()
                        .foregroundStyle(.white)
                        .lineLimit(1)
                        .minimumScaleFactor(0.6)
                    Text(context.date, format: .dateTime.weekday(.wide).month(.wide).day())
                        .font(.gothamBold(size: 26))
                        .foregroundStyle(Color.brandPrimary)
                    locationAndFreshness
                }
                .accessibilityElement(children: .combine)
            }

            // Stats row
            if let stats = dashboard?.stats {
                HStack(spacing: 16) {
                    StatTile(value: stats.itemsOut, label: "Items Out", accent: .white, reduceMotion: reduceMotion)
                    StatTile(value: stats.checkouts, label: "Checkouts", accent: .white, reduceMotion: reduceMotion)
                    StatTile(value: stats.overdue, label: "Overdue", accent: stats.overdue > 0 ? Color.kioskRed : .white, reduceMotion: reduceMotion)
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
                VStack(alignment: .leading, spacing: 10) {
                    Text("TODAY")
                        .font(.caption.weight(.semibold))
                        .tracking(1.5)
                        .foregroundStyle(Color.white.opacity(0.45))
                    ForEach(events) { event in
                        KioskEventRow(event: event)
                    }
                }
            }

            // Active checkouts
            if let checkouts = dashboard?.checkouts, !checkouts.isEmpty {
                VStack(alignment: .leading, spacing: 10) {
                    Text("ACTIVE CHECKOUTS")
                        .font(.caption.weight(.semibold))
                        .tracking(1.5)
                        .foregroundStyle(Color.white.opacity(0.45))
                    ForEach(checkouts.prefix(6)) { checkout in
                        CheckoutRow(checkout: checkout)
                    }
                }
            }

            // Quiet-day state — without it the left panel is a black void
            // below the stat tiles whenever nothing is out and no events run.
            if let dashboard, dashboard.checkouts.isEmpty, dashboard.events.isEmpty {
                Spacer()
                VStack(spacing: 10) {
                    Image(systemName: "checkmark.seal.fill")
                        .font(.system(size: 44))
                        .foregroundStyle(Color.statusText(.green))
                        .accessibilityHidden(true)
                    Text("All gear is home")
                        .font(.title3.bold())
                        .foregroundStyle(.white)
                    Text("No active checkouts or events today. Tap your name to get started.")
                        .font(.subheadline)
                        .foregroundStyle(Color.white.opacity(0.55))
                        .multilineTextAlignment(.center)
                }
                .frame(maxWidth: .infinity)
                .accessibilityElement(children: .combine)
            }

            Spacer()
        }
    }

    /// Location subtitle + a discreet "Updated Xm ago" stamp. Switches to
    /// orange when the last successful load is >5 min old so staff has a
    /// visual signal that the dashboard might be lying.
    @ViewBuilder
    private var locationAndFreshness: some View {
        HStack(spacing: 6) {
            if let location = store.info?.locationName {
                Text(location)
                    .font(.subheadline)
                    .foregroundStyle(Color.white.opacity(0.55))
            }
            if let last = lastLoadedAt {
                Text("·")
                    .font(.caption)
                    .foregroundStyle(.tertiary)
                Text("Updated \(last.kioskFreshnessLabel(now: Date()))")
                    .font(.caption)
                    .foregroundStyle(isStale ? Color.statusText(.orange) : Color.white.opacity(0.4))
                    .monospacedDigit()
            }
        }
    }

    private var isStale: Bool {
        guard let last = lastLoadedAt else { return false }
        return Date().timeIntervalSince(last) > 300
    }

    // MARK: - Roster Panel

    private var rosterPanel: some View {
        VStack(alignment: .leading, spacing: 16) {
            VStack(alignment: .leading, spacing: 4) {
                Text("Select your name")
                    .font(.title3.bold())
                    .foregroundStyle(.white)
                Text("Tap your name to check gear out or back in.")
                    .font(.subheadline)
                    .foregroundStyle(Color.white.opacity(0.55))
            }

            if users.isEmpty && isLoading {
                ProgressView().tint(.white).frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                let labels = disambiguatedLabels(for: users)
                ScrollView {
                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                        ForEach(users) { user in
                            UserTile(user: user, displayName: labels[user.id] ?? user.name) {
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
        do {
            dashboard = try await dashboardResult
            users = try await usersResult
            lastLoadedAt = Date()
            loadFailedAt = nil
        } catch APIError.unauthorized {
            // Cookie expired or device deactivated remotely — drop back to
            // activation rather than sit forever on a stale idle screen.
            store.deactivate()
        } catch {
            // Transient network — keep last good values; staff will see the
            // "Updated Xm ago" stamp shift to orange after the 5-min mark.
            loadFailedAt = Date()
        }
        isLoading = false
    }
}

// MARK: - Sub-views

private struct StatTile: View {
    let value: Int
    let label: String
    let accent: Color
    let reduceMotion: Bool

    var body: some View {
        VStack(spacing: 6) {
            Text("\(value)")
                .font(.system(size: 44, weight: .bold, design: .rounded))
                .foregroundStyle(accent)
                .contentTransition(.numericText())
                .animation(reduceMotion ? nil : .easeInOut(duration: 0.4), value: value)
                .monospacedDigit()
            Text(label.uppercased())
                .font(.caption.weight(.semibold))
                .tracking(0.8)
                .foregroundStyle(Color.white.opacity(0.55))
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 20)
        .background(Color.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 16))
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(Color.white.opacity(0.08), lineWidth: 1)
        )
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(value) \(label.lowercased())")
    }
}

private struct KioskEventRow: View {
    let event: KioskEvent

    var body: some View {
        HStack(spacing: 12) {
            Text(event.startsAt, format: .dateTime.hour().minute())
                .font(.subheadline.weight(.semibold).monospacedDigit())
                .foregroundStyle(Color.brandPrimary)
                .frame(minWidth: 70, alignment: .leading)
                .fixedSize()
            Text(event.title)
                .font(.body.weight(.medium))
                .foregroundStyle(.white)
                .lineLimit(1)
            Spacer()
            if event.shiftCount > 0 {
                Text("\(event.shiftCount) shifts")
                    .font(.caption)
                    .foregroundStyle(Color.white.opacity(0.5))
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .background(Color.white.opacity(0.05), in: RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color.white.opacity(0.07), lineWidth: 1)
        )
        .accessibilityElement(children: .combine)
    }
}

private struct CheckoutRow: View {
    let checkout: KioskActiveCheckout

    var body: some View {
        HStack {
            // Real avatar when available; falls back to the existing initials
            // disc on missing/failed loads. Overdue ring stays as the visual
            // signal regardless of which path renders.
            ZStack {
                Circle()
                    .fill(checkout.isOverdue ? Color.kioskRed.opacity(0.3) : Color.white.opacity(0.1))
                    .frame(width: 36, height: 36)
                avatarInitialsLayer
            }

            VStack(alignment: .leading, spacing: 2) {
                Text(checkout.requesterName)
                    .font(.subheadline)
                    .foregroundStyle(.white)
                Text(itemSummary)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            Spacer()
            if checkout.isOverdue {
                Image(systemName: "exclamationmark.triangle.fill")
                    .foregroundStyle(Color.statusText(.red))
                    .font(.caption)
                    .accessibilityLabel("Overdue")
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(Color.white.opacity(0.04), in: RoundedRectangle(cornerRadius: 8))
        .accessibilityElement(children: .combine)
        .accessibilityLabel(accessibilitySummary)
    }

    @ViewBuilder
    private var avatarInitialsLayer: some View {
        if let urlString = checkout.requesterAvatarUrl, let url = URL(string: urlString) {
            AsyncImage(url: url) { phase in
                switch phase {
                case .success(let image):
                    image.resizable().scaledToFill()
                default:
                    initialsBubble
                }
            }
            .frame(width: 36, height: 36)
            .clipShape(Circle())
        } else {
            initialsBubble
        }
    }

    private var initialsBubble: some View {
        Text(checkout.requesterInitials)
            .font(.caption.bold())
            .foregroundStyle(.white)
    }

    private var itemSummary: String {
        let names = checkout.items.prefix(2).map(\.name)
        let head = names.joined(separator: ", ")
        let extra = checkout.itemCount - names.count
        if extra > 0, !head.isEmpty {
            return "\(head) · +\(extra) more"
        }
        return head
    }

    private var accessibilitySummary: String {
        let prefix = checkout.isOverdue ? "Overdue: " : ""
        return "\(prefix)\(checkout.requesterName), \(itemSummary)"
    }
}

/// First name when unique in the visible roster, "First L." when another
/// user shares the same first name. Prevents misclick attribution.
private func disambiguatedLabels(for users: [KioskUser]) -> [String: String] {
    var firstNameCounts: [String: Int] = [:]
    for user in users {
        let first = user.name.components(separatedBy: " ").first ?? user.name
        firstNameCounts[first.lowercased(), default: 0] += 1
    }
    var result: [String: String] = [:]
    for user in users {
        let parts = user.name.components(separatedBy: " ").filter { !$0.isEmpty }
        let first = parts.first ?? user.name
        if firstNameCounts[first.lowercased(), default: 0] > 1, let last = parts.dropFirst().last,
           let lastInitial = last.first {
            result[user.id] = "\(first) \(lastInitial)."
        } else {
            result[user.id] = first
        }
    }
    return result
}

private struct UserTile: View {
    let user: KioskUser
    let displayName: String
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            VStack(spacing: 10) {
                avatar
                Text(displayName)
                    .font(.headline)
                    .foregroundStyle(.white)
                    .lineLimit(1)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 20)
            .background(Color.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 16))
            .overlay(
                RoundedRectangle(cornerRadius: 16)
                    .stroke(Color.white.opacity(0.1), lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(user.name)
        .accessibilityHint("Tap to start checkout for \(user.name)")
    }

    @ViewBuilder
    private var avatar: some View {
        if let urlString = user.avatarUrl, let url = URL(string: urlString) {
            AsyncImage(url: url) { phase in
                switch phase {
                case .success(let image):
                    image.resizable().scaledToFill()
                default:
                    initialsCircle
                }
            }
            .frame(width: 64, height: 64)
            .clipShape(Circle())
        } else {
            initialsCircle
        }
    }

    private var initialsCircle: some View {
        Circle()
            .fill(Color.white.opacity(0.12))
            .frame(width: 64, height: 64)
            .overlay {
                Text(user.initials)
                    .font(.title3.bold())
                    .foregroundStyle(.white)
            }
    }
}

// MARK: - Freshness label

private extension Date {
    /// Compact "Just now / Xs ago / Xm ago" string for the kiosk header
    /// freshness stamp. iOS's `RelativeDateTimeFormatter` is overkill for
    /// the sub-minute range; this matches the rest of the app's gear-shift
    /// vocabulary at small sizes.
    func kioskFreshnessLabel(now: Date) -> String {
        let seconds = max(0, now.timeIntervalSince(self))
        if seconds < 5 { return "just now" }
        if seconds < 60 { return "\(Int(seconds))s ago" }
        let minutes = Int(seconds / 60)
        if minutes < 60 { return "\(minutes)m ago" }
        let hours = minutes / 60
        return "\(hours)h ago"
    }
}
