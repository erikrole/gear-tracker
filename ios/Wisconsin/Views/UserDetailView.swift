import SwiftUI

struct UserDetailView: View {
    let userId: String

    @Environment(SessionStore.self) private var session

    @State private var detail: AppUserDetail?
    @State private var badgeProfile: BadgeProfile?
    @State private var reservations: [Booking] = []
    @State private var checkouts: [Booking] = []
    @State private var shifts: [MyShift] = []
    @State private var pushedBookingId: String?
    @State private var selectedShift: MyShift?
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
                        ProfileNextUpCard(
                            checkouts: checkouts,
                            reservations: reservations,
                            shifts: shifts,
                            openBooking: { pushedBookingId = $0 },
                            openShift: { selectedShift = $0 }
                        )
                        badgesSection
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
        .navigationDestination(item: $pushedBookingId) { bookingId in
            BookingDetailView(bookingId: bookingId)
        }
        .navigationDestination(item: $selectedShift) { shift in
            EventDetailView(event: shift.asScheduleEvent, myShift: shift, eventWork: nil)
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
        if let badgeProfile {
            BadgeShelfCard(
                profile: badgeProfile,
                openGallery: { showBadgeGallery = true },
                openBadge: { selectedBadge = $0 }
            )
        }
    }

    private func profileHeader(_ detail: AppUserDetail) -> some View {
        // Hero card mirrors ItemDetail's ItemHeroCard: identity leads in Gotham,
        // contact lines are monospaced + actionable, and role/joined read as
        // quiet metadata. Inactive accounts drop the role tone to gray.
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
                    // The standing the Users list leads with. A profile that
                    // skipped it said less about the person than the row you
                    // tapped to reach it. Area is not joined onto this line --
                    // a long job title wraps, and " · Video" starting a line of
                    // its own reads as a rendering fault.
                    if let standing = UserIdentity.standing(
                        role: detail.role,
                        title: detail.title,
                        gradYear: detail.gradYear,
                        studentYearOverride: detail.studentYearOverride
                    ) {
                        Text(standing)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                            .lineLimit(2)
                    }
                    HStack(spacing: 6) {
                        StatusPill.role(detail.role)
                        if !detail.active {
                            StatusPill(label: "Inactive", tone: .gray)
                        }
                    }
                    if let meta = metaLine(detail) {
                        Text(meta)
                            .font(.caption2)
                            .foregroundStyle(.tertiary)
                    }
                }
                Spacer(minLength: 0)
            }
            .accessibilityElement(children: .combine)
            .accessibilityLabel(profileAccessibilityLabel(detail))

            // Contact as things you do, not addresses to read -- and only for
            // other people. Offering to email or call yourself is a dead end,
            // and it was the one thing your own profile had that a teammate's
            // needed.
            if detail.id != session.currentUser?.id {
                ContactActions(detail: detail)
            }
        }
    }

    /// The two quiet facts, together on one line: which area they work in and
    /// how long they have been here.
    private func metaLine(_ detail: AppUserDetail) -> String? {
        var parts: [String] = []
        if let area = detail.primaryArea, !area.isEmpty { parts.append(area.shiftAreaLabel) }
        if let joined = joinedLabel(detail.createdAt) { parts.append(joined) }
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }


    private func profileAccessibilityLabel(_ detail: AppUserDetail) -> String {
        var parts: [String] = [detail.name]
        if let standing = UserIdentity.standing(
            role: detail.role,
            title: detail.title,
            gradYear: detail.gradYear,
            studentYearOverride: detail.studentYearOverride
        ) {
            parts.append(standing)
        }
        parts.append(detail.role.capitalized)
        if !detail.active { parts.append("Inactive") }
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
            // Active only. The card said "Active Checkouts" while the request
            // asked for every checkout this person had ever made, so a profile
            // routinely listed four rows stamped "Completed" under a heading
            // promising the opposite.
            async let checkoutsTask = APIClient.shared.checkoutsByUser(userId: userId, activeOnly: true, limit: 5)
            async let reservationsTask = APIClient.shared.reservationsByUser(userId: userId, activeOnly: true, limit: 5)
            async let shiftsTask = try? await APIClient.shared.myShifts(userId: userId, limit: 5)
            let (d, b, c, r, s) = try await (detailTask, badgeTask, checkoutsTask, reservationsTask, shiftsTask)
            detail = d
            badgeProfile = b
            checkouts = c.data
            reservations = r.data
            shifts = s ?? []
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

// MARK: - Badge shelf

/// The trophy shelf, shared by the profile you open for someone else and the
/// one you open for yourself. Earned medallions scroll horizontally so the
/// profile stays short; locked badges and progress live in the gallery sheet.
struct BadgeShelfCard: View {
    let profile: BadgeProfile
    let openGallery: () -> Void
    let openBadge: (UserBadge) -> Void

    @State private var tapFeedback = false

    var body: some View {
        if profile.disabled != true {
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
                            Text("\(profile.earnedCount) earned")
                                .font(.caption2)
                                .foregroundStyle(.tertiary)
                        }
                        Spacer()
                        Button(action: openGallery) {
                            Label("See all", systemImage: "square.grid.2x2")
                                .font(.caption.weight(.semibold))
                        }
                        .buttonStyle(.bordered)
                        .controlSize(.small)
                        // Neutral, not brand red: opening a gallery is not
                        // urgent and not destructive.
                        .tint(Color.primary)
                        .accessibilityLabel("See all badges")
                    }

                    if profile.earnedBadges.isEmpty {
                        Text("No badges yet")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    } else {
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(alignment: .top, spacing: 2) {
                                ForEach(profile.earnedBadges.prefix(16)) { badge in
                                    Button {
                                        tapFeedback.toggle()
                                        openBadge(badge)
                                    } label: {
                                        BadgeShelfItem(badge: badge)
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                        }
                        .sensoryFeedback(.selection, trigger: tapFeedback)
                    }

                    if !liveStreaks.isEmpty {
                        Divider()
                        // A run in force is the most motivating thing this
                        // system knows, and it has been tracked since the
                        // beginning while being shown to nobody.
                        ForEach(liveStreaks) { streak in
                            BadgeStreakRow(streak: streak)
                        }
                    }

                    if let next = closestToEarned {
                        Divider()
                        BadgeProgressRow(badge: next) {
                            tapFeedback.toggle()
                            openBadge(next)
                        }
                    }
                }
            }
        }
    }

    /// The unearned badge this person is nearest to earning. The server already
    /// derives real progress for threshold and streak badges; until now it was
    /// only legible after opening the gallery, so the shelf showed what you had
    /// and never what was within reach.
    private var closestToEarned: UserBadge? {
        profile.badges
            .filter(\.hasProgress)
            .max { $0.progressFraction < $1.progressFraction }
    }

    private var liveStreaks: [BadgeStreakSummary] {
        (profile.streaks ?? []).filter(\.isWorthShowing)
    }
}

/// "4 on-time returns in a row · best 7". Current is the number that moves, so
/// it leads; the best is context, not the headline.
private struct BadgeStreakRow: View {
    let streak: BadgeStreakSummary

    private var tone: StatusTone {
        streak.type == "SCAN_CLEAN" ? .green : .blue
    }

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: streak.systemImage)
                .font(.caption.weight(.semibold))
                .foregroundStyle(Color.statusText(tone))
                .frame(width: 18)
                .accessibilityHidden(true)
            // A broken streak still says something worth knowing: what it was.
            Text(streak.current > 0 ? streak.label : "Streak reset")
                .font(.subheadline)
                .foregroundStyle(streak.current > 0 ? .primary : .secondary)
                .lineLimit(1)
            Spacer(minLength: 8)
            if streak.longest > streak.current {
                Text("best \(streak.longest)")
                    .font(.caption)
                    .monospacedDigit()
                    .foregroundStyle(.tertiary)
            }
        }
        .frame(minHeight: 28)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(
            streak.current > 0
                ? "\(streak.label), best \(streak.longest)"
                : "Streak reset, best \(streak.longest)"
        )
    }
}

/// "3 of 5 · Gear Regular" with a bar. Only ever rendered for a badge whose
/// progress the server could actually derive.
private struct BadgeProgressRow: View {
    let badge: UserBadge
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: 8) {
                    Text("Closest")
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(.tertiary)
                        .textCase(.uppercase)
                        .tracking(0.04)
                    Text(badge.name)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.primary)
                        .lineLimit(1)
                    Spacer(minLength: 8)
                    Text("\(badge.progressCurrent ?? 0)/\(badge.progressTarget ?? 0)")
                        .font(.caption.weight(.medium))
                        .monospacedDigit()
                        .foregroundStyle(.secondary)
                }
                ProgressView(value: badge.progressFraction)
                    .tint(Color.statusText(badge.rarity.tone))
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Closest badge: \(badge.name), \(badge.progressCurrent ?? 0) of \(badge.progressTarget ?? 0)")
    }
}

// MARK: - Contact

/// Email and phone as two equal actions. Neutral-tinted: reaching someone is
/// not a custody state, and blue here collided with the checked-out blue used
/// three rows down.
private struct ContactActions: View {
    let detail: AppUserDetail

    private var phoneURL: URL? {
        guard let phone = detail.phone, !phone.isEmpty else { return nil }
        return URL(string: "tel:\(phone.filter { $0.isNumber || $0 == "+" })")
    }

    var body: some View {
        HStack(spacing: Brand.Space.sm) {
            if let url = URL(string: "mailto:\(detail.email)") {
                Link(destination: url) {
                    ContactActionLabel(systemImage: "envelope.fill", title: "Email")
                }
                .accessibilityLabel("Email \(detail.name) at \(detail.email)")
            }
            if let phoneURL {
                Link(destination: phoneURL) {
                    ContactActionLabel(systemImage: "phone.fill", title: "Call")
                }
                .accessibilityLabel("Call \(detail.name)")
            }
        }
        .padding(.top, 2)
    }
}

private struct ContactActionLabel: View {
    let systemImage: String
    let title: String

    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: systemImage)
                .font(.caption.weight(.semibold))
                .accessibilityHidden(true)
            Text(title)
                .font(.subheadline.weight(.semibold))
        }
        .foregroundStyle(Color.primary)
        .frame(maxWidth: .infinity, minHeight: 40)
        .background(Color.cardSurfaceRaised, in: Capsule())
        .overlay(Capsule().strokeBorder(Color.hairline, lineWidth: 0.5))
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

/// Compact medallion-first gallery tile. The artifact leads, the name and one
/// quiet meta line follow; the description and award note moved into the
/// detail sheet so tiles stay scannable in a grid.
private struct BadgeTile: View {
    let badge: UserBadge

    var body: some View {
        VStack(spacing: 8) {
            BadgeMedallionView(badge: badge, size: 48)
            VStack(spacing: 2) {
                Text(badge.name)
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(badge.earned ? AnyShapeStyle(.primary) : AnyShapeStyle(.secondary))
                    .multilineTextAlignment(.center)
                    .lineLimit(2, reservesSpace: true)
                Text(badge.tileMetaLine)
                    .font(.caption2.monospacedDigit())
                    .foregroundStyle(.tertiary)
                    .lineLimit(1)
            }
            if badge.hasProgress {
                ProgressView(value: badge.progressFraction)
                    .tint(Color.statusText(badge.rarity.tone))
                    .frame(maxWidth: 88)
            }
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 12)
        .frame(maxWidth: .infinity)
        .background(
            badge.earned ? Color(.secondarySystemGroupedBackground) : Color(.secondarySystemGroupedBackground).opacity(0.55),
            in: RoundedRectangle(cornerRadius: 14, style: .continuous)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .strokeBorder(Color(.separator).opacity(badge.earned ? 0.5 : 0.35), lineWidth: 0.5)
        )
        .shadow(color: badge.recentlyEarned ? Color.statusText(badge.rarity.tone).opacity(0.20) : .clear, radius: 12, x: 0, y: 4)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(accessibilityLabel)
    }

    private var accessibilityLabel: String {
        [badge.name, badge.earned ? "earned" : "locked", badge.tileMetaLine].joined(separator: ", ")
    }
}

/// Horizontal-shelf item for the profile card: medallion over a two-line name.
struct BadgeShelfItem: View {
    let badge: UserBadge

    var body: some View {
        VStack(spacing: 6) {
            BadgeMedallionView(badge: badge, size: 52)
            Text(badge.name)
                .font(.caption2.weight(.medium))
                .foregroundStyle(.primary)
                .multilineTextAlignment(.center)
                .lineLimit(2, reservesSpace: true)
        }
        .frame(width: 82)
        .padding(.vertical, 4)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(badge.name), earned. Double-tap for details.")
    }
}

struct BadgeGallerySheet: View {
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
            case .manual: badge.isManualRecognition
            case .rare: badge.rarity == .rare || badge.rarity == .legendary
            }
        }
    }

    /// Same five shelves as the web badges tab. Counts come from the whole
    /// visible collection; only the tile grid respects the active filter.
    private var sections: [BadgeGallerySection] {
        let filtered = filteredBadges
        return BadgeCollection.allCases.compactMap { collection in
            let collectionBadges = profile.visibleBadges.filter { $0.primaryCollection == collection }
            let displayBadges = filtered
                .filter { $0.primaryCollection == collection }
                .sorted { a, b in
                    if a.earned != b.earned { return a.earned }
                    return (a.awardedDate ?? .distantPast) > (b.awardedDate ?? .distantPast)
                }
            guard !displayBadges.isEmpty else { return nil }
            return BadgeGallerySection(
                collection: collection,
                badges: displayBadges,
                earnedCount: collectionBadges.filter(\.earned).count,
                totalCount: collectionBadges.count
            )
        }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    gallerySummary
                    filterChips

                    if sections.isEmpty {
                        ContentUnavailableView(
                            "No \(filter.title.lowercased()) badges",
                            systemImage: filter == .locked ? "lock" : "trophy",
                            description: Text("Try another gallery filter.")
                        )
                        .frame(maxWidth: .infinity, minHeight: 220)
                    } else {
                        ForEach(sections) { section in
                            VStack(alignment: .leading, spacing: 10) {
                                HStack(alignment: .firstTextBaseline, spacing: 6) {
                                    Image(systemName: section.collection.systemImage)
                                        .font(.caption.weight(.semibold))
                                        .foregroundStyle(.secondary)
                                        .accessibilityHidden(true)
                                    Text(section.collection.title)
                                        .font(.subheadline.weight(.semibold))
                                    Spacer(minLength: 8)
                                    Text("\(section.earnedCount)/\(section.totalCount) earned")
                                        .font(.caption2.monospacedDigit())
                                        .foregroundStyle(.secondary)
                                }
                                .accessibilityElement(children: .combine)

                                LazyVGrid(columns: [GridItem(.adaptive(minimum: 104), spacing: 10)], spacing: 10) {
                                    ForEach(section.badges) { badge in
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

struct BadgeDetailSheet: View {
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

// MARK: - Shaped medallions (web BadgeMedallion parity)

private struct BadgeMedallionView: View {
    let badge: UserBadge
    let size: CGFloat

    var body: some View {
        // One medallion shape for every badge. The per-badge silhouettes this
        // replaces -- coin, hex, shield, stack -- were drawn from hand-plotted
        // paths, and `stack` in particular rendered as a notched square behind
        // an offset second square, which read as a clipping fault rather than a
        // medal. A single ringed disc says "award" without any badge looking
        // broken, and rarity still speaks through colour.
        let tone: StatusTone = badge.earned ? badge.rarity.tone : .gray
        ZStack {
            Circle()
                .fill(Color.statusBackground(tone))
            Circle()
                .strokeBorder(Color.statusText(tone).opacity(badge.earned ? 0.35 : 0.2), lineWidth: max(1, size * 0.05))
            // A locked badge keeps its own icon, dimmed. Every locked badge used
            // to draw `lock.fill`, which told you a badge existed but never what
            // it was -- the same "one glyph repeated" problem the icon map had,
            // just confined to the half of the shelf you have not earned yet.
            // What it takes is the reason to go get it.
            Image(systemName: badge.icon.sfSymbolName)
                .font(.system(size: size * 0.42, weight: .semibold))
                .foregroundStyle(Color.statusText(tone))
                .opacity(badge.earned ? 1 : 0.45)
                .symbolEffect(.bounce, value: badge.recentlyEarned)
        }
        .frame(width: size, height: size)
        .shadow(color: badge.recentlyEarned ? Color.statusText(badge.rarity.tone).opacity(0.22) : .clear, radius: 12, x: 0, y: 4)
        .accessibilityHidden(true)
    }
}

// MARK: - Award collections (web shelf parity)

/// The five award shelves shared with the web badges tab, in display order.
private enum BadgeCollection: String, CaseIterable, Identifiable {
    case gearFlow, reliability, scans, teamwork, staffPicks

    var id: String { rawValue }

    var title: String {
        switch self {
        case .gearFlow: "Gear Flow"
        case .reliability: "Reliability"
        case .scans: "Scans"
        case .teamwork: "Teamwork"
        case .staffPicks: "Staff Picks"
        }
    }

    var systemImage: String {
        switch self {
        case .gearFlow: "shippingbox"
        case .reliability: "clock.badge.checkmark"
        case .scans: "qrcode.viewfinder"
        case .teamwork: "person.2"
        case .staffPicks: "sparkles"
        }
    }
}

private struct BadgeGallerySection: Identifiable {
    let collection: BadgeCollection
    let badges: [UserBadge]
    let earnedCount: Int
    let totalCount: Int

    var id: String { collection.id }
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

    /// The server sends title case ("Legendary"); an unrecognised value means a
    /// newer server vocabulary, so fall through to the local rating rather than
    /// guessing.
    init?(serverValue: String) {
        self.init(rawValue: serverValue.lowercased())
    }

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
    var isManualRecognition: Bool {
        source == "MANUAL" || (kind == "RULE" && trigger == "manual")
    }

    /// Mirrors the web tab's `primaryCollectionKey`: every badge lives on
    /// exactly one shelf, and staff recognition wins over thematic hints.
    var primaryCollection: BadgeCollection {
        if isManualRecognition || category == "MILESTONE" { return .staffPicks }
        switch category {
        case "CHECKOUT": return .gearFlow
        case "ON_TIME": return .reliability
        case "SCAN": return .scans
        case "TRADE", "SHIFT": return .teamwork
        default: break
        }
        if key.contains("streak") || key.contains("reliable") || key.contains("zero_errors") { return .reliability }
        return .gearFlow
    }

    /// One quiet line under the tile name: earned date, progress, requirement,
    /// or how the badge unlocks.
    var tileMetaLine: String {
        if earned { return earnedDateText }
        if hasProgress { return "\(progressCurrent ?? 0)/\(progressTarget ?? 0)" }
        if let threshold, threshold > 0 { return "\(threshold) required" }
        return trigger == "manual" ? "Staff recognition" : "Locked"
    }

    /// The server computes rarity from how many people actually hold a badge,
    /// so prefer its answer. The local key lists below are the same
    /// difficulty-based guess the server falls back to for a badge nobody has
    /// earned yet, kept only so an older payload still renders.
    var rarity: BadgeRarity {
        if let served = servedRarity.flatMap(BadgeRarity.init(serverValue:)) { return served }
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
    // Read-only after initialization (formatOptions set once, then only
    // `.date(from:)` is called) — safe to share without actor isolation.
    // `UserBadge` is a plain data model, not MainActor-bound, so this avoids
    // forcing the whole model into MainActor isolation for one cached formatter.
    nonisolated(unsafe) static let gearBadge: ISO8601DateFormatter = {
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

    /// `BadgeDefinition.icon` holds a Lucide name, because the catalog was built
    /// for the web. This map has to cover every name the catalog actually uses
    /// or badges silently collapse into one glyph -- which is exactly what
    /// happened: the twelve names below the seeded set were the only ones here,
    /// they overlap the catalog on `Trophy` alone, and 31 of 33 badges rendered
    /// `seal.fill`. A shelf of identical medals is not a shelf.
    ///
    /// `tests/ios-badge-icon-coverage.test.ts` fails if the seed catalog or the
    /// custom-icon picker gains a name this switch does not answer.
    var sfSymbolName: String {
        switch self {
        // Seeded catalog: gear flow
        case "PackageCheck": "shippingbox.circle.fill"
        case "PackageOpen": "shippingbox.fill"
        case "Boxes": "square.stack.3d.up.fill"
        case "Warehouse": "building.2.fill"
        // Seeded catalog: scans
        case "ScanLine": "barcode.viewfinder"
        case "ScanSearch": "text.viewfinder"
        case "QrCode": "qrcode"
        // Seeded catalog: time and reliability
        case "Clock3": "clock.fill"
        case "CalendarCheck2": "calendar.badge.checkmark"
        case "AlarmClockCheck": "alarm.waves.left.and.right.fill"
        case "CalendarClock": "calendar.badge.clock"
        case "CalendarDays": "calendar"
        case "CalendarRange": "calendar.badge.plus"
        case "ShieldCheck": "checkmark.shield.fill"
        case "BadgeCheck": "checkmark.seal.fill"
        // Seeded catalog: people and teamwork
        case "Handshake": "hands.sparkles.fill"
        case "UserCheck": "person.fill.checkmark"
        case "Repeat2": "arrow.triangle.2.circlepath"
        case "Flame": "flame.fill"
        case "Trophy": "trophy.fill"
        // Custom-badge picker options that are not already covered above.
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
