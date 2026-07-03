import SwiftUI

struct UserDetailView: View {
    let userId: String

    @State private var detail: AppUserDetail?
    @State private var badgeProfile: BadgeProfile?
    @State private var reservations: [Booking] = []
    @State private var checkouts: [Booking] = []
    @State private var isLoading = true
    @State private var error: String?
    @State private var showBadgeGallery = false
    @State private var selectedBadge: UserBadge?
    @State private var badgeTapFeedback = false

    var body: some View {
        Group {
            if isLoading && detail == nil {
                UserDetailSkeleton()
            } else if let error, detail == nil {
                ContentUnavailableView {
                    Label("Couldn't load profile", systemImage: "exclamationmark.triangle")
                } description: {
                    Text(error)
                } actions: {
                    Button("Retry") { Task { await load() } }
                        .buttonStyle(.borderedProminent)
                }
            } else if let detail {
                ScrollView {
                    VStack(spacing: Brand.Space.sm) {
                        profileHeader(detail)
                        badgesSection

                        if !checkouts.isEmpty {
                            UserBookingsCard(
                                title: "Active Checkouts",
                                systemImage: "arrow.up.circle",
                                tone: .blue,
                                bookings: checkouts
                            )
                        }

                        if !reservations.isEmpty {
                            UserBookingsCard(
                                title: "Recent Reservations",
                                systemImage: "calendar",
                                tone: .purple,
                                bookings: reservations
                            )
                        }

                        if checkouts.isEmpty && reservations.isEmpty && !isLoading {
                            // Empty is common for students; collapse to one quiet
                            // line instead of a full empty-state card.
                            HStack(spacing: 8) {
                                Image(systemName: "shippingbox")
                                    .font(.caption.weight(.semibold))
                                    .foregroundStyle(.tertiary)
                                Text("No recent bookings")
                                    .font(.subheadline)
                                    .foregroundStyle(.tertiary)
                                Spacer(minLength: 0)
                            }
                            .brandCard(padding: Brand.Space.sm)
                            .accessibilityElement(children: .combine)
                        }
                    }
                    .padding(.horizontal, Brand.Space.md)
                    .padding(.vertical, Brand.Space.sm)
                }
                .background(Color(.systemGroupedBackground))
            }
        }
        .navigationTitle(detail?.name ?? "Profile")
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
        .refreshable { await load() }
        .navigationDestination(for: String.self) { bookingId in
            BookingDetailView(bookingId: bookingId)
        }
        .sheet(isPresented: $showBadgeGallery) {
            if let badgeProfile {
                BadgeGallerySheet(profile: badgeProfile)
                    .presentationDetents([.large])
                    .presentationDragIndicator(.visible)
            }
        }
        .sheet(item: $selectedBadge) { badge in
            BadgeDetailSheet(badge: badge)
                .presentationDetents([.medium, .large])
                .presentationDragIndicator(.visible)
        }
    }

    @ViewBuilder
    private var badgesSection: some View {
        if let badgeProfile, badgeProfile.disabled != true {
            FormCard {
                VStack(alignment: .leading, spacing: 12) {
                    HStack(alignment: .center) {
                        VStack(alignment: .leading, spacing: 2) {
                            HStack(spacing: 6) {
                                Image(systemName: "trophy")
                                    .font(.caption.weight(.semibold))
                                    .foregroundStyle(Color.statusText(.orange))
                                    .accessibilityHidden(true)
                                Text("Badges")
                                    .font(.caption.weight(.semibold))
                                    .foregroundStyle(.secondary)
                                    .textCase(.uppercase)
                                    .tracking(0.04)
                            }
                            Text("\(badgeProfile.earnedCount) earned")
                                .font(.caption2)
                                .foregroundStyle(.tertiary)
                        }
                        Spacer()
                        Button {
                            showBadgeGallery = true
                        } label: {
                            Label("See all", systemImage: "square.grid.2x2")
                                .font(.caption.weight(.semibold))
                        }
                        .buttonStyle(.bordered)
                        .controlSize(.small)
                        .accessibilityLabel("See all badges")
                    }

                    if badgeProfile.earnedBadges.isEmpty {
                        Text("No badges yet")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    } else {
                        LazyVGrid(columns: [GridItem(.adaptive(minimum: 138), spacing: 10)], spacing: 10) {
                            ForEach(badgeProfile.earnedBadges.prefix(12)) { badge in
                                Button {
                                    badgeTapFeedback.toggle()
                                    selectedBadge = badge
                                } label: {
                                    BadgeTile(badge: badge, compact: true)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        .sensoryFeedback(.selection, trigger: badgeTapFeedback)
                    }
                }
            }
        }
    }

    private func profileHeader(_ detail: AppUserDetail) -> some View {
        // Hero card mirrors ItemDetail's ItemHeroCard: identity leads in Gotham,
        // contact lines are monospaced + actionable, role/location/joined read
        // as quiet metadata. Inactive accounts drop the role tone to gray.
        let tone: StatusTone = detail.active ? StatusTone.forRole(detail.role) : .gray
        return FormCard {
            HStack(alignment: .top, spacing: Brand.Space.md) {
                UserAvatarView(
                    name: detail.name,
                    avatarUrl: detail.avatarUrl,
                    size: 64,
                    fallbackBackground: Color.statusBackground(tone),
                    fallbackForeground: Color.statusText(tone),
                    showsBorder: false
                )
                .opacity(detail.active ? 1 : 0.6)

                VStack(alignment: .leading, spacing: 5) {
                    Text(detail.name)
                        .font(.gothamBlack(size: 22))
                        .lineLimit(2)
                        .minimumScaleFactor(0.8)
                    Text(detail.email)
                        .font(.system(.subheadline, design: .monospaced))
                        .foregroundStyle(.secondary)
                        .textSelection(.enabled)
                    if let phone = detail.phone, !phone.isEmpty {
                        // Tap to call — `tel:` dispatches to the system dialer.
                        // Sanitized to digits + leading + only.
                        let sanitized = phone.filter { $0.isNumber || $0 == "+" }
                        if let url = URL(string: "tel:\(sanitized)") {
                            Link(destination: url) {
                                HStack(spacing: 4) {
                                    Image(systemName: "phone.fill")
                                        .font(.caption2)
                                        .accessibilityHidden(true)
                                    Text(phone)
                                        .font(.system(.caption, design: .monospaced))
                                }
                                .foregroundStyle(Color.statusText(.blue))
                            }
                            .accessibilityLabel("Call \(detail.name)")
                        } else {
                            Text(phone)
                                .font(.system(.caption, design: .monospaced))
                                .foregroundStyle(.secondary)
                        }
                    }
                    HStack(spacing: 6) {
                        StatusPill.role(detail.role)
                        if !detail.active {
                            StatusPill(label: "Inactive", tone: .gray)
                        }
                        if let loc = detail.location {
                            Text(loc)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                    if let joined = joinedLabel(detail.createdAt) {
                        Text(joined)
                            .font(.caption2)
                            .foregroundStyle(.tertiary)
                    }
                }
                Spacer(minLength: 0)
            }
            .accessibilityElement(children: .combine)
            .accessibilityLabel(profileAccessibilityLabel(detail))
        }
    }

    private func profileAccessibilityLabel(_ detail: AppUserDetail) -> String {
        var parts: [String] = [detail.name, detail.role.capitalized]
        if !detail.active { parts.append("Inactive") }
        if let loc = detail.location, !loc.isEmpty { parts.append(loc) }
        if let joined = joinedLabel(detail.createdAt) { parts.append(joined) }
        return parts.joined(separator: ", ")
    }

    private func joinedLabel(_ createdAt: String?) -> String? {
        guard let createdAt else { return nil }
        let date = ISO8601DateFormatter.gearBadge.date(from: createdAt)
            ?? ISO8601DateFormatter().date(from: createdAt)
        guard let date else { return nil }
        return "Joined \(date.formatted(.dateTime.month(.abbreviated).year()))"
    }

    private func load() async {
        isLoading = true
        error = nil
        defer { isLoading = false }
        do {
            async let detailTask = APIClient.shared.user(id: userId)
            async let badgeTask = loadBadgeProfileSafely()
            async let checkoutsTask = APIClient.shared.checkoutsByUser(userId: userId, limit: 5)
            async let reservationsTask = APIClient.shared.reservationsByUser(userId: userId, limit: 5)
            let (d, b, c, r) = try await (detailTask, badgeTask, checkoutsTask, reservationsTask)
            detail = d
            badgeProfile = b
            checkouts = c.data
            reservations = r.data
        } catch {
            self.error = error.localizedDescription
        }
    }

    private func loadBadgeProfileSafely() async -> BadgeProfile? {
        do {
            return try await APIClient.shared.userBadgeProfile(userId: userId)
        } catch {
            return nil
        }
    }
}

// MARK: - Bookings card

/// Booking section card shared by Active Checkouts and Recent Reservations.
/// Same anatomy as ItemDetail's booking cards: toned uppercase icon header,
/// rows as nested tertiary tiles with a trailing chevron.
private struct UserBookingsCard: View {
    let title: String
    let systemImage: String
    let tone: StatusTone
    let bookings: [Booking]

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 6) {
                Image(systemName: systemImage)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Color.statusText(tone))
                    .accessibilityHidden(true)
                Text(title)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                    .textCase(.uppercase)
                    .tracking(0.04)
            }

            VStack(spacing: 6) {
                ForEach(bookings) { booking in
                    NavigationLink(value: booking.id) {
                        HStack(spacing: 10) {
                            BookingResultRow(booking: booking)
                            Image(systemName: "chevron.right")
                                .font(.caption2.weight(.semibold))
                                .foregroundStyle(.tertiary)
                                .accessibilityHidden(true)
                        }
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .background(Color(.tertiarySystemFill), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                    }
                    .buttonStyle(.plain)
                    .accessibilityElement(children: .combine)
                    .accessibilityHint("Double-tap to view booking")
                }
            }
        }
        .brandCard()
    }
}

// MARK: - Loading skeleton

private struct UserDetailSkeleton: View {
    var body: some View {
        ScrollView {
            VStack(spacing: Brand.Space.sm) {
                // Hero card shape
                HStack(alignment: .top, spacing: Brand.Space.md) {
                    Circle()
                        .fill(Color.secondary.opacity(0.15))
                        .frame(width: 64, height: 64)
                    VStack(alignment: .leading, spacing: 8) {
                        RoundedRectangle(cornerRadius: 4)
                            .fill(Color.secondary.opacity(0.15))
                            .frame(width: 160, height: 16)
                        RoundedRectangle(cornerRadius: 3)
                            .fill(Color.secondary.opacity(0.10))
                            .frame(width: 210, height: 11)
                        RoundedRectangle(cornerRadius: 8)
                            .fill(Color.secondary.opacity(0.12))
                            .frame(width: 56, height: 16)
                    }
                    Spacer(minLength: 0)
                }
                .brandCard()

                // Two section-card shapes
                ForEach(0..<2, id: \.self) { _ in
                    VStack(alignment: .leading, spacing: 10) {
                        RoundedRectangle(cornerRadius: 3)
                            .fill(Color.secondary.opacity(0.12))
                            .frame(width: 120, height: 10)
                        RoundedRectangle(cornerRadius: 10)
                            .fill(Color.secondary.opacity(0.08))
                            .frame(height: 52)
                        RoundedRectangle(cornerRadius: 10)
                            .fill(Color.secondary.opacity(0.08))
                            .frame(height: 52)
                    }
                    .brandCard()
                }
            }
            .padding(.horizontal, Brand.Space.md)
            .padding(.vertical, Brand.Space.sm)
        }
        .background(Color(.systemGroupedBackground))
        .redacted(reason: .placeholder)
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }
}

private struct BadgeTile: View {
    let badge: UserBadge
    var compact = false

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                BadgeMedallionView(badge: badge, size: compact ? 34 : 42)
                Spacer(minLength: 4)
                BadgeStatusChip(badge: badge)
            }

            VStack(alignment: .leading, spacing: 3) {
                Text(badge.name)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.primary)
                    .lineLimit(2)
                Text(badge.description)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(compact ? 3 : 2)
            }

            if compact, let note = badge.note, !note.isEmpty {
                Text(note)
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
                    .lineLimit(2)
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, minHeight: 130, alignment: .topLeading)
        .background(tileBackground, in: RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .strokeBorder(Color(.separator).opacity(badge.earned ? 0.5 : 0.35), lineWidth: 0.5)
        )
        .shadow(color: badge.recentlyEarned ? Color.statusText(badge.rarity.tone).opacity(0.18) : .clear, radius: 14, x: 0, y: 4)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(accessibilityLabel)
    }

    private var tileBackground: Color {
        badge.earned ? Color(.secondarySystemGroupedBackground) : Color(.tertiarySystemGroupedBackground)
    }

    private var accessibilityLabel: String {
        var parts = [badge.name, badge.earned ? "earned" : "locked", badge.description]
        if let note = badge.note, !note.isEmpty { parts.append(note) }
        return parts.joined(separator: ", ")
    }
}

private struct BadgeGallerySheet: View {
    let profile: BadgeProfile
    @Environment(\.dismiss) private var dismiss
    @State private var filter: BadgeGalleryFilter = .all
    @State private var selectedBadge: UserBadge?
    @State private var tapFeedback = false

    private var filteredBadges: [UserBadge] {
        profile.visibleBadges.filter { badge in
            switch filter {
            case .all: true
            case .earned: badge.earned
            case .locked: !badge.earned
            case .manual: badge.source == "MANUAL" || (badge.kind == "RULE" && badge.trigger == "manual")
            case .rare: badge.rarity == .rare || badge.rarity == .legendary
            }
        }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    gallerySummary
                    filterChips

                    if filteredBadges.isEmpty {
                        ContentUnavailableView(
                            "No \(filter.title.lowercased()) badges",
                            systemImage: filter == .locked ? "lock" : "trophy",
                            description: Text("Try another gallery filter.")
                        )
                        .frame(maxWidth: .infinity, minHeight: 220)
                    } else {
                        LazyVGrid(columns: [GridItem(.adaptive(minimum: 156), spacing: 12)], spacing: 12) {
                            ForEach(filteredBadges) { badge in
                                Button {
                                    tapFeedback.toggle()
                                    selectedBadge = badge
                                } label: {
                                    BadgeTile(badge: badge)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }

                    if profile.hiddenSurpriseCount > 0 && (filter == .all || filter == .locked) {
                        HiddenSurpriseCard(count: profile.hiddenSurpriseCount)
                    }
                }
                .padding()
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("Badge Gallery")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
        .sensoryFeedback(.selection, trigger: tapFeedback)
        .sheet(item: $selectedBadge) { badge in
            BadgeDetailSheet(badge: badge)
                .presentationDetents([.medium, .large])
                .presentationDragIndicator(.visible)
        }
    }

    private var gallerySummary: some View {
        HStack(spacing: 8) {
            BadgeSummaryCell(value: "\(profile.earnedCount)", label: "Earned")
            BadgeSummaryCell(value: "\(profile.visibleBadges.count)", label: "Gallery")
            BadgeSummaryCell(value: "\(profile.completionPercent)%", label: "Complete")
        }
    }

    private var filterChips: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(BadgeGalleryFilter.allCases) { item in
                    Button {
                        withAnimation(.snappy(duration: 0.18)) {
                            filter = item
                        }
                    } label: {
                        Text(item.title)
                            .font(.subheadline.weight(.semibold))
                            .padding(.horizontal, 14)
                            .frame(minHeight: 40)
                            .background(filter == item ? Color.accentColor.opacity(0.14) : Color(.secondarySystemGroupedBackground), in: Capsule())
                            .foregroundStyle(filter == item ? Color.accentColor : Color.secondary)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Show \(item.title.lowercased()) badges")
                }
            }
            .padding(.vertical, 2)
        }
    }
}

private struct BadgeDetailSheet: View {
    let badge: UserBadge
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    VStack(alignment: .leading, spacing: 14) {
                        BadgeMedallionView(badge: badge, size: 72)
                        VStack(alignment: .leading, spacing: 8) {
                            HStack(spacing: 6) {
                                BadgeStatusChip(badge: badge)
                                Text(badge.rarity.title)
                                    .font(.caption.weight(.semibold))
                                    .foregroundStyle(Color.statusText(badge.rarity.tone))
                            }
                            Text(badge.name)
                                .font(.title2.weight(.bold))
                                .textSelection(.enabled)
                            Text(badge.description)
                                .font(.body)
                                .foregroundStyle(.secondary)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(18)
                    .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 18))

                    detailGrid

                    if badge.hasProgress {
                        VStack(alignment: .leading, spacing: 8) {
                            HStack {
                                Text("Progress")
                                    .font(.subheadline.weight(.semibold))
                                Spacer()
                                Text("\(badge.progressCurrent ?? 0)/\(badge.progressTarget ?? 0)")
                                    .font(.caption.monospacedDigit().weight(.semibold))
                                    .foregroundStyle(.secondary)
                            }
                            ProgressView(value: badge.progressFraction)
                                .tint(Color.statusText(badge.rarity.tone))
                        }
                        .padding(14)
                        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 14))
                    }

                    if let note = badge.note, !note.isEmpty {
                        VStack(alignment: .leading, spacing: 6) {
                            Text("Award Note")
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(.secondary)
                                .textCase(.uppercase)
                                .tracking(0.3)
                            Text(note)
                                .font(.subheadline)
                                .foregroundStyle(.primary)
                        }
                        .padding(14)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 14))
                    }
                }
                .padding()
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("Badge")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }

    private var detailGrid: some View {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 140), spacing: 10)], spacing: 10) {
            BadgeDetailMetric(label: "Category", value: badge.category.displayCategory)
            BadgeDetailMetric(label: "Source", value: badge.source == "MANUAL" ? "Manual award" : badge.earned ? "Automatic" : "Not earned")
            BadgeDetailMetric(label: "Earned", value: badge.earnedDateText)
            BadgeDetailMetric(label: "Trigger", value: badge.trigger)
        }
    }
}

private struct BadgeSummaryCell: View {
    let value: String
    let label: String

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(value)
                .font(.title3.weight(.bold))
                .monospacedDigit()
            Text(label)
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 12))
        .accessibilityElement(children: .combine)
    }
}

private struct BadgeDetailMetric: View {
    let label: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label)
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.subheadline.weight(.semibold))
                .lineLimit(2)
                .minimumScaleFactor(0.8)
        }
        .padding(12)
        .frame(maxWidth: .infinity, minHeight: 72, alignment: .leading)
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 12))
    }
}

private struct BadgeMedallionView: View {
    let badge: UserBadge
    let size: CGFloat

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: size * 0.28)
                .fill(Color.statusBackground(badge.rarity.tone))
            RoundedRectangle(cornerRadius: size * 0.22)
                .stroke(Color.statusText(badge.rarity.tone).opacity(0.28), lineWidth: 1)
                .padding(size * 0.1)
            Image(systemName: badge.earned ? badge.icon.sfSymbolName : "lock.fill")
                .font(.system(size: size * 0.42, weight: .semibold))
                .foregroundStyle(Color.statusText(badge.rarity.tone))
                .symbolEffect(.bounce, value: badge.recentlyEarned)
        }
        .frame(width: size, height: size)
        .shadow(color: badge.recentlyEarned ? Color.statusText(badge.rarity.tone).opacity(0.22) : .clear, radius: 12, x: 0, y: 4)
        .accessibilityHidden(true)
    }
}

private struct BadgeStatusChip: View {
    let badge: UserBadge

    var body: some View {
        Text(badge.earned ? (badge.source == "MANUAL" ? "Manual" : "Earned") : "Locked")
            .font(.caption2.weight(.semibold))
            .padding(.horizontal, 7)
            .padding(.vertical, 3)
            .background(Color.statusBackground(badge.earned ? (badge.source == "MANUAL" ? .purple : .green) : .gray), in: Capsule())
            .foregroundStyle(Color.statusText(badge.earned ? (badge.source == "MANUAL" ? .purple : .green) : .gray))
    }
}

private struct HiddenSurpriseCard: View {
    let count: Int

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "sparkles")
                .font(.headline)
                .foregroundStyle(Color.statusText(.purple))
                .frame(width: 42, height: 42)
                .background(Color.statusBackground(.purple), in: RoundedRectangle(cornerRadius: 12))
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 3) {
                Text("Surprise badges")
                    .font(.subheadline.weight(.semibold))
                Text("\(count) hidden \(count == 1 ? "badge is" : "badges are") waiting for the right moment.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
        }
        .padding(14)
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 14))
        .accessibilityElement(children: .combine)
    }
}

private enum BadgeGalleryFilter: String, CaseIterable, Identifiable {
    case all, earned, locked, manual, rare

    var id: String { rawValue }

    var title: String {
        switch self {
        case .all: "All"
        case .earned: "Earned"
        case .locked: "Locked"
        case .manual: "Manual"
        case .rare: "Rare"
        }
    }
}

private enum BadgeRarity: String {
    case common, uncommon, rare, legendary

    var title: String {
        switch self {
        case .common: "Common"
        case .uncommon: "Uncommon"
        case .rare: "Rare"
        case .legendary: "Legendary"
        }
    }

    var tone: StatusTone {
        switch self {
        case .common: return .blue
        case .uncommon: return .green
        case .rare: return .orange
        case .legendary: return .purple
        }
    }
}

private let hiddenBadgeKeys: Set<String> = [
    "above_and_beyond",
    "event_hero",
    "clean_loop",
]

private let legendaryBadgeKeys: Set<String> = [
    "above_and_beyond",
    "category_collector",
    "checkout_100",
]

private let rareBadgeKeys: Set<String> = [
    "event_hero",
    "clean_loop",
    "perfect_handoff",
    "full_kit_no_misses",
    "semester_streak",
    "reliable_regular",
]

private let uncommonBadgeKeys: Set<String> = [
    "clutch_cover",
    "rookie_run",
    "zero_errors",
    "streak_on_time_5",
    "streak_shifts_5",
]

private extension BadgeProfile {
    var visibleBadges: [UserBadge] {
        badges.filter { badge in
            badge.earned || (badge.active && !hiddenBadgeKeys.contains(badge.key))
        }
    }

    var hiddenSurpriseCount: Int {
        badges.filter { !$0.earned && $0.active && hiddenBadgeKeys.contains($0.key) }.count
    }

    var completionPercent: Int {
        guard !visibleBadges.isEmpty else { return 0 }
        return Int((Double(earnedCount) / Double(visibleBadges.count) * 100).rounded())
    }
}

private extension UserBadge {
    var rarity: BadgeRarity {
        if legendaryBadgeKeys.contains(key) { return .legendary }
        if rareBadgeKeys.contains(key) || (threshold ?? 0) >= 50 { return .rare }
        if key.hasPrefix("custom_") { return .uncommon }
        if uncommonBadgeKeys.contains(key) || (threshold ?? 0) >= 10 || (kind == "RULE" && trigger == "manual") {
            return .uncommon
        }
        return .common
    }

    var hasProgress: Bool {
        !earned && progressCurrent != nil && progressTarget != nil && (progressTarget ?? 0) > 0
    }

    var progressFraction: Double {
        guard hasProgress, let current = progressCurrent, let target = progressTarget, target > 0 else { return 0 }
        return min(1, Double(current) / Double(target))
    }

    var recentlyEarned: Bool {
        guard earned, let date = awardedDate else { return false }
        return Date().timeIntervalSince(date) <= 7 * 86_400
    }

    var awardedDate: Date? {
        guard let awardedAt else { return nil }
        return ISO8601DateFormatter.gearBadge.date(from: awardedAt)
            ?? ISO8601DateFormatter().date(from: awardedAt)
    }

    var earnedDateText: String {
        guard let date = awardedDate else { return earned ? "Earned" : "Not earned yet" }
        return date.formatted(date: .abbreviated, time: .omitted)
    }
}

private extension ISO8601DateFormatter {
    static let gearBadge: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()
}

private extension String {
    var displayCategory: String {
        switch self {
        case "CHECKOUT": "Checkout"
        case "ON_TIME": "On-time returns"
        case "SCAN": "Scans"
        case "TRADE": "Trades"
        case "SHIFT": "Shifts"
        case "STREAK": "Streaks"
        case "MILESTONE": "Milestones"
        default: lowercased().replacingOccurrences(of: "_", with: " ")
        }
    }

    var badgeTone: StatusTone {
        switch self {
        case "CHECKOUT": .blue
        case "ON_TIME": .green
        case "SCAN": .green
        case "TRADE": .purple
        case "SHIFT": .orange
        case "STREAK": .orange
        case "MILESTONE": .red
        default: .blue
        }
    }

    var sfSymbolName: String {
        switch self {
        case "Trophy": "trophy.fill"
        case "Medal": "medal.fill"
        case "Star": "star.fill"
        case "Sparkles": "sparkles"
        case "Shield": "shield.fill"
        case "Zap": "bolt.fill"
        case "Heart": "heart.fill"
        case "Crown": "crown.fill"
        case "Rocket": "paperplane.fill"
        case "Target": "target"
        case "Wrench": "wrench.adjustable.fill"
        case "Coffee": "cup.and.saucer.fill"
        default: "seal.fill"
        }
    }
}
