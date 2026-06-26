import SwiftUI

/// Hashable wrapper so navigation can distinguish a "go to booking detail"
/// route from arbitrary String values pushed onto the path.
struct BookingRouteId: Hashable {
    let id: String
}

/// Hashable wrapper so navigation can distinguish a "go to asset detail"
/// route from arbitrary String values pushed onto the path. Used by the
/// notifications sheet to route damage / lost / low-stock notifications
/// to the right asset.
struct AssetRouteId: Hashable {
    let id: String
}

@MainActor
@Observable
final class ItemsViewModel {
    enum SortOption: String, CaseIterable, Identifiable {
        case assetTag = "assetTag"
        case popular = "popular"

        var id: String { rawValue }

        var label: String {
            switch self {
            case .assetTag: "Asset tag"
            case .popular: "Most popular"
            }
        }
    }

    var rows: [ItemListRow] = []
    var isLoading = false
    var error: String?
    var pageError: String?
    var searchText = ""
    var selectedStatuses: Set<AssetComputedStatus> = []
    var favoritesOnly = false
    var sortOption: SortOption = .assetTag
    var hasMore = true

    private var offset = 0
    private let limit = 30
    private var searchTask: Task<Void, Never>?
    private var loadTask: Task<Void, Never>?

    func load(reset: Bool = false) async {
        if reset {
            // Filter / search change: cancel in-flight load so the new query wins.
            loadTask?.cancel()
        } else if isLoading {
            return
        }
        let task = Task { await performLoad(reset: reset) }
        loadTask = task
        await task.value
    }

    private func performLoad(reset: Bool) async {
        if reset {
            offset = 0
            hasMore = true
            pageError = nil
        }
        isLoading = true
        if reset { error = nil }
        do {
            let result = try await APIClient.shared.assets(
                search: searchText.isEmpty ? nil : searchText,
                statuses: selectedStatuses,
                sort: sortOption.rawValue,
                favoritesOnly: favoritesOnly,
                limit: limit,
                offset: offset
            )
            if Task.isCancelled { isLoading = false; return }
            let resultRows = result.orderedRows
            if reset { rows = resultRows } else { rows += resultRows }
            offset += resultRows.count
            hasMore = offset < result.total
            pageError = nil
            if reset && offset == resultRows.count && searchText.isEmpty && selectedStatuses.isEmpty && !favoritesOnly {
                GearStore.shared.seedAssets(result.data)
            }
        } catch is CancellationError {
            // Superseded by a newer load.
        } catch {
            if reset {
                self.error = itemListErrorMessage(error)
            } else {
                self.pageError = itemListErrorMessage(error, loadingMore: true)
                hasMore = false
            }
        }
        isLoading = false
    }

    func retryPage() async {
        pageError = nil
        hasMore = true
        await load()
    }

    func onSearchChange() {
        searchTask?.cancel()
        searchTask = Task {
            try? await Task.sleep(for: .milliseconds(350))
            guard !Task.isCancelled else { return }
            await load(reset: true)
        }
    }

    func resetDefaults() {
        searchTask?.cancel()
        loadTask?.cancel()
        searchText = ""
        selectedStatuses = []
        favoritesOnly = false
        sortOption = .assetTag
        rows = []
        offset = 0
        hasMore = true
        error = nil
        pageError = nil
    }

    func toggleFavorite(_ asset: Asset) async throws {
        let optimistic = !asset.isFavorited
        applyFavorite(assetId: asset.id, value: optimistic)
        do {
            let newState = try await APIClient.shared.toggleFavorite(assetId: asset.id)
            applyFavorite(assetId: asset.id, value: newState)
            if favoritesOnly && !newState {
                rows.removeAll { row in
                    if case .asset(let item) = row {
                        return item.id == asset.id
                    }
                    return false
                }
            }
        } catch {
            applyFavorite(assetId: asset.id, value: asset.isFavorited)
            throw error
        }
    }

    private func applyFavorite(assetId: String, value: Bool) {
        rows = rows.map { row in
            guard case .asset(let asset) = row, asset.id == assetId else { return row }
            return .asset(asset.withFavorited(value))
        }
    }

    private func itemListErrorMessage(_ error: Error, loadingMore: Bool = false) -> String {
        let fallback = loadingMore
            ? "Couldn't load more items. Check your connection and try again."
            : "Couldn't load items. Check your connection and try again."

        if let apiError = error as? APIError {
            return apiError.errorDescription ?? fallback
        }
        if error is DecodingError {
            return "Items could not be read. Refresh and try again."
        }
        if let urlError = error as? URLError {
            return APIError.networkError(urlError).errorDescription ?? fallback
        }
        return fallback
    }
}

struct ItemsView: View {
    @State private var vm = ItemsViewModel()
    @State private var reserveAsset: Asset?
    @State private var reserveFamily: AssetFamilySearchResult?
    @State private var navigationPath = NavigationPath()
    @State private var toast: Toast?
    @Environment(AppState.self) private var appState

    var body: some View {
        NavigationStack(path: $navigationPath) {
            VStack(spacing: 0) {
                itemsControlStrip
                Group {
                    if let error = vm.error, vm.rows.isEmpty {
                        ContentUnavailableView {
                            Label("Couldn't load items", systemImage: "exclamationmark.triangle")
                        } description: {
                            Text(error)
                        } actions: {
                            Button("Retry") { Task { await vm.load(reset: true) } }
                                .buttonStyle(.borderedProminent)
                        }
                    } else if vm.rows.isEmpty && vm.isLoading {
                        List {
                            ForEach(0..<10, id: \.self) { _ in
                                ItemRowSkeleton()
                                    .listRowSeparator(.hidden)
                                    .listRowBackground(Color.clear)
                                    .listRowInsets(EdgeInsets(top: 5, leading: 16, bottom: 5, trailing: 16))
                            }
                        }
                        .listStyle(.plain)
                        .scrollContentBackground(.hidden)
                        .background(Color(.systemGroupedBackground))
                        .allowsHitTesting(false)
                        .accessibilityHidden(true)  // Don't pollute VO with placeholder shapes during initial load.
                    } else if vm.rows.isEmpty {
                        ContentUnavailableView {
                            Label(
                                vm.favoritesOnly ? "No Favorites" : "No Items",
                                systemImage: vm.favoritesOnly ? "star" : "archivebox"
                            )
                        } description: {
                            Text(vm.searchText.isEmpty
                                ? (vm.favoritesOnly ? "Star items to add them here." : "No gear found.")
                                : "No results for \"\(vm.searchText)\".")
                        } actions: {
                            emptyStateActions
                        }
                    } else {
                        List {
                            ForEach(vm.rows) { row in
                                itemRow(row)
                            }
                            if let pageError = vm.pageError {
                                VStack(spacing: 8) {
                                    Text(pageError)
                                        .font(.footnote)
                                        .foregroundStyle(.secondary)
                                        .multilineTextAlignment(.center)
                                    Button("Retry") { Task { await vm.retryPage() } }
                                        .buttonStyle(.bordered)
                                }
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 8)
                                .listRowSeparator(.hidden)
                                .listRowBackground(Color.clear)
                            } else if vm.hasMore {
                                ProgressView()
                                    .frame(maxWidth: .infinity)
                                    .listRowSeparator(.hidden)
                                    .listRowBackground(Color.clear)
                                    .task(id: vm.rows.count) { await vm.load() }
                            } else if vm.rows.count > 10 {
                                Text("End of list")
                                    .font(.caption2)
                                    .foregroundStyle(.tertiary)
                                    .frame(maxWidth: .infinity, alignment: .center)
                                    .padding(.vertical, 12)
                                    .listRowSeparator(.hidden)
                                    .listRowBackground(Color.clear)
                            }
                        }
                        .listStyle(.plain)
                        .scrollContentBackground(.hidden)
                        .contentMargins(.bottom, 96, for: .scrollContent)
                        .background(Color(.systemGroupedBackground))
                    }
                }
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("Items")
            .searchable(text: $vm.searchText, prompt: "Search tag, model, serial, location")
            .onChange(of: vm.searchText) { vm.onSearchChange() }
            .refreshable { await vm.load(reset: true) }
            .task { await vm.load(reset: true) }
            .toast($toast)
            .onChange(of: appState.tabResetToken) { _, _ in
                guard appState.resetTab == 2 else { return }
                reserveAsset = nil
                reserveFamily = nil
                navigationPath = NavigationPath()
                vm.resetDefaults()
                Task { await vm.load(reset: true) }
            }
            .navigationDestination(for: Asset.self) { asset in
                ItemDetailView(assetId: asset.id)
            }
            .navigationDestination(for: BookingRouteId.self) { route in
                BookingDetailView(bookingId: route.id)
            }
            .sheet(item: $reserveAsset) { asset in
                CreateBookingSheet(vm: {
                    let vm = CreateBookingViewModel()
                    vm.prefillReservation(for: asset)
                    return vm
                }()) { newId in
                    reserveAsset = nil
                    navigationPath.append(BookingRouteId(id: newId))
                }
            }
            .sheet(item: $reserveFamily) { family in
                CreateBookingSheet(vm: {
                    let vm = CreateBookingViewModel()
                    vm.prefillReservation(forFamily: family)
                    return vm
                }()) { newId in
                    reserveFamily = nil
                    navigationPath.append(BookingRouteId(id: newId))
                }
            }
        }
    }

    @ViewBuilder
    private func itemRow(_ row: ItemListRow) -> some View {
        switch row {
        case .asset(let asset):
            ZStack {
                NavigationLink(value: asset) { EmptyView() }.opacity(0)
                AssetRow(asset: asset)
            }
            .listRowSeparator(.hidden)
            .listRowBackground(Color.clear)
            .listRowInsets(EdgeInsets(top: 5, leading: 16, bottom: 5, trailing: 16))
            .swipeActions(edge: .leading, allowsFullSwipe: true) {
                Button {
                    Task { await toggleFavorite(asset) }
                } label: {
                    Label(
                        asset.isFavorited ? "Unfavorite" : "Favorite",
                        systemImage: asset.isFavorited ? "star.slash" : "star"
                    )
                }
                .tint(.yellow)
            }
            .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                if asset.computedStatus != .retired {
                    Button {
                        reserveAsset = asset
                    } label: {
                        Label("Reserve", systemImage: "plus.circle")
                    }
                    .tint(.accentColor)
                }
            }
            .contextMenu {
                Button {
                    Task { await toggleFavorite(asset) }
                } label: {
                    Label(
                        asset.isFavorited ? "Unfavorite" : "Favorite",
                        systemImage: asset.isFavorited ? "star.slash" : "star"
                    )
                }

                if asset.computedStatus != .retired {
                    Button {
                        reserveAsset = asset
                    } label: {
                        Label("Reserve", systemImage: "plus.circle")
                    }
                }

                if let tag = asset.assetTag {
                    Button {
                        UIPasteboard.general.string = tag
                    } label: {
                        Label("Copy Asset Tag", systemImage: "doc.on.doc")
                    }
                }
            }
        case .family(let family):
            ItemFamilyListRow(family: family)
                .listRowSeparator(.hidden)
                .listRowBackground(Color.clear)
                .listRowInsets(EdgeInsets(top: 5, leading: 16, bottom: 5, trailing: 16))
                .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                    Button {
                        reserveFamily = family
                    } label: {
                        Label("Reserve", systemImage: "plus.circle")
                    }
                    .tint(.accentColor)
                }
                .contextMenu {
                    Button {
                        reserveFamily = family
                    } label: {
                        Label("Reserve", systemImage: "plus.circle")
                    }
                }
        }
    }

    private func toggleFavorite(_ asset: Asset) async {
        do {
            try await vm.toggleFavorite(asset)
        } catch {
            toast = Toast(message: "Couldn't update favorite", icon: "exclamationmark.triangle.fill", role: .error)
        }
    }

    @ViewBuilder
    private var emptyStateActions: some View {
        if !vm.searchText.isEmpty {
            Button {
                vm.searchText = ""
                Task { await vm.load(reset: true) }
            } label: {
                Label("Clear search", systemImage: "xmark.circle")
            }
            .buttonStyle(.borderedProminent)
        } else if vm.favoritesOnly {
            Button {
                vm.favoritesOnly = false
                Task { await vm.load(reset: true) }
            } label: {
                Label("Show all items", systemImage: "archivebox")
            }
            .buttonStyle(.borderedProminent)
        }
    }

    private var itemsControlStrip: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                Button {
                    vm.favoritesOnly.toggle()
                    Task { await vm.load(reset: true) }
                } label: {
                    ItemControlPill(
                        title: "Favorites",
                        systemImage: vm.favoritesOnly ? "star.fill" : "star",
                        isActive: vm.favoritesOnly,
                        tone: .orange
                    )
                }
                .buttonStyle(.plain)
                .accessibilityLabel(vm.favoritesOnly ? "Favorites on" : "Favorites off")
                .sensoryFeedback(.selection, trigger: vm.favoritesOnly)

                AssetStatusFilterMenu(selected: $vm.selectedStatuses) {
                    Task { await vm.load(reset: true) }
                }

                ItemSortMenu(selected: $vm.sortOption) {
                    Task { await vm.load(reset: true) }
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
        }
        .background(Color(.systemGroupedBackground))
    }
}


struct AssetRow: View {
    let asset: Asset

    /// Mirrors web's `BookingDetailPage`/columns subtitle logic: when the
    /// asset tag is the primary, the subtitle is the custom name (when set)
    /// or brand+model — but only if it isn't just a casing/whitespace
    /// duplicate of the tag itself.
    private var subtitleWhenTagIsPrimary: String? {
        guard let tag = asset.assetTag else { return nil }
        let candidate = asset.name?.isEmpty == false ? asset.name! : asset.displayName
        let normalized = candidate.trimmingCharacters(in: .whitespaces).lowercased()
        let normalizedTag = tag.trimmingCharacters(in: .whitespaces).lowercased()
        guard !normalized.isEmpty, normalized != normalizedTag else { return nil }
        return candidate
    }

    private var metadataLine: String {
        [asset.category?.name, asset.location.name]
            .compactMap { $0 }
            .joined(separator: " · ")
    }

    var body: some View {
        let tone = assetStatusTone(asset)

        HStack(spacing: 12) {
            // Shared rail atom — same leading accent the Bookings and dashboard
            // rows use, tinted by the item's status (overdue red, etc.).
            StatusRail(tone: tone)

            AssetThumbnail(imageUrl: asset.imageUrl, size: 44)
                .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: 3) {
                // Asset tag is an ID — render in SF Mono to match web's font-mono
                // treatment for asset tags. Fallback (brand+model) stays in SF Pro.
                if let tag = asset.assetTag {
                    Text(tag)
                        .font(.system(.subheadline, design: .monospaced).weight(.medium))
                        .lineLimit(1)
                    // Web parity: when the tag is the primary, brand/model
                    // (or a custom name) reads as the subtitle — but only when
                    // it's not just a duplicate of the tag.
                    if let subtitle = subtitleWhenTagIsPrimary {
                        Text(subtitle)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                } else {
                    Text(asset.displayName)
                        .font(.subheadline.weight(.medium))
                        .lineLimit(1)
                }
                Text(metadataLine)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .truncationMode(.tail)
                .lineLimit(1)
            }
            .layoutPriority(1)

            Spacer()

            AssetListBadge(asset: asset, tone: tone)

            Image(systemName: "chevron.right")
                .font(.caption2.weight(.semibold))
                .foregroundStyle(.tertiary)
                .accessibilityHidden(true)
        }
        .brandCard(padding: Brand.Space.md, radius: Brand.Radius.card)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(rowAccessibilityLabel)
        .accessibilityHint("Double-tap to view item details")
    }

    /// Single combined VoiceOver readout. Surfaces overdue state first when
    /// applicable so VO users hear the most important fact in time-pressure
    /// scrolling. Mirrors today's BookingsView + HomeView row patterns.
    private var rowAccessibilityLabel: String {
        var parts: [String] = []

        let isOverdue = asset.computedStatus == .checkedOut && asset.activeBooking?.isOverdue == true
        if isOverdue { parts.append("Overdue") }

        // Title: tag (when present) + the brand/model subtitle, otherwise displayName.
        if let tag = asset.assetTag {
            parts.append(tag)
            if let subtitle = subtitleWhenTagIsPrimary { parts.append(subtitle) }
        } else {
            parts.append(asset.displayName)
        }

        if let cat = asset.category { parts.append(cat.name) }
        parts.append(asset.location.name)

        // Status + due/overdue: speak who has it (when applicable) + status label.
        if let name = asset.activeBooking?.requesterName,
           asset.computedStatus == .checkedOut || asset.computedStatus == .pendingPickup || asset.computedStatus == .reserved {
            let activeLabel = isOverdue ? "overdue" : asset.computedStatus.label.lowercased()
            parts.append("\(activeLabel) by \(name)")
        } else {
            parts.append(asset.computedStatus.label)
        }

        // Due/overdue label, if active checkout has one.
        if asset.computedStatus == .checkedOut, let booking = asset.activeBooking {
            let days = Int((booking.endsAt.timeIntervalSinceNow / 86_400).rounded())
            if booking.isOverdue {
                let n = max(1, abs(days))
                parts.append("\(n) day\(n == 1 ? "" : "s") overdue")
            } else if days <= 0 {
                parts.append("due today")
            } else if days < 14 {
                parts.append("due in \(days) day\(days == 1 ? "" : "s")")
            }
        }
        return parts.joined(separator: ", ")
    }
}

struct ItemFamilyListRow: View {
    let family: AssetFamilySearchResult

    private var metadataLine: String {
        "\(family.category) · \(family.locationName)"
    }

    var body: some View {
        let tone: StatusTone = .green

        HStack(spacing: 12) {
            StatusRail(tone: tone)

            SearchBulkThumbnail(imageUrl: family.imageUrl, size: 44)
                .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: 3) {
                Text(family.name)
                    .font(.subheadline.weight(.medium))
                    .lineLimit(1)
                Text(family.trackingStyleLabel)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                Text(metadataLine)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .truncationMode(.tail)
                    .lineLimit(1)
            }
            .layoutPriority(1)

            Spacer()

            VStack(alignment: .trailing, spacing: 2) {
                Text(family.listAvailabilityLabel)
                    .font(.caption2.weight(.semibold))
                    .lineLimit(1)
                    .fixedSize()
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(Color.statusBackground(tone), in: Capsule())
                    .foregroundStyle(Color.statusText(tone))

                Text(family.trackByNumber ? "Units" : "Quantity")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
            .frame(maxWidth: 140, alignment: .trailing)
            .accessibilityHidden(true)
        }
        .brandCard(padding: Brand.Space.md, radius: Brand.Radius.card)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(family.name), \(family.trackingStyleLabel), \(family.category), \(family.locationName), \(family.listAvailabilityLabel)")
        .accessibilityHint("Swipe or open the context menu to reserve")
    }
}

/// Maps an asset's computed status (with overdue override) to a cross-app
/// `StatusTone`. Shared by the row's leading `StatusRail` and its trailing
/// badge so both speak the same color.
func assetStatusTone(_ asset: Asset) -> StatusTone {
    if asset.computedStatus == .checkedOut, asset.activeBooking?.isOverdue == true {
        return .red
    }
    switch asset.computedStatus {
    case .available:   return .green
    case .checkedOut:  return .blue
    case .pendingPickup: return .orange
    case .reserved:    return .purple
    case .maintenance: return .orange
    case .retired:     return .gray
    case .unknown:     return .gray
    }
}

private struct AssetListBadge: View {
    let asset: Asset
    let tone: StatusTone

    private var badgeText: String {
        if showsHolderAvatar, let booking = asset.activeBooking {
            return booking.requesterName
        }
        return asset.computedStatus.label
    }

    private var showsHolderAvatar: Bool {
        asset.activeBooking != nil &&
            (asset.computedStatus == .checkedOut || asset.computedStatus == .pendingPickup || asset.computedStatus == .reserved)
    }

    var body: some View {
        HStack(spacing: 5) {
            if showsHolderAvatar, let booking = asset.activeBooking {
                UserAvatarView(
                    name: booking.requesterName,
                    avatarUrl: booking.requesterAvatarUrl,
                    size: 18,
                    fallbackBackground: Color.statusBackground(tone),
                    fallbackForeground: Color.statusText(tone),
                    showsBorder: false
                )
            }
            Text(badgeText)
                .font(.caption2.weight(.semibold))
                .lineLimit(1)
                .fixedSize()
        }
        .padding(.horizontal, 6)
        .padding(.vertical, 2)
        .background(Color.statusBackground(tone), in: Capsule())
        .foregroundStyle(Color.statusText(tone))
        .frame(maxWidth: 140, alignment: .trailing)
        .accessibilityHidden(true)  // Status surfaced via the combined row label in AssetRow.
    }
}

struct AssetThumbnail: View {
    let imageUrl: String?
    let size: CGFloat

    var body: some View {
        Group {
            if let urlString = imageUrl, let url = URL(string: urlString) {
                CachedThumbnail(url: url, size: size)
            } else {
                placeholder
            }
        }
        .frame(width: size, height: size)
        .background(Color(.systemGray6))
        .clipShape(RoundedRectangle(cornerRadius: cornerRadius))
        .overlay(
            RoundedRectangle(cornerRadius: cornerRadius)
                .strokeBorder(Color(.separator), lineWidth: 1)
        )
    }

    private var cornerRadius: CGFloat { max(6, size * 0.18) }

    private var placeholder: some View {
        Image(systemName: "bag")
            .font(.system(size: size * 0.36))
            .foregroundStyle(Color(.systemGray3))
    }
}

struct AssetStatusBadge: View {
    let status: AssetComputedStatus

    var body: some View {
        Text(status.label)
            .font(.caption2.weight(.semibold))
            .lineLimit(1)
            .fixedSize()
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(Color.statusBackground(tone), in: Capsule())
            .foregroundStyle(Color.statusText(tone))
    }

    private var tone: StatusTone {
        switch status {
        case .available:   return .green
        case .checkedOut:  return .blue
        case .pendingPickup: return .orange
        case .reserved:    return .purple
        case .maintenance: return .orange
        case .retired:     return .gray
        case .unknown:     return .gray
        }
    }
}

struct AssetStatusFilterMenu: View {
    @Binding var selected: Set<AssetComputedStatus>
    let onSelect: () -> Void

    private let statuses: [AssetComputedStatus] = [.available, .checkedOut, .pendingPickup, .reserved, .maintenance, .retired]

    var body: some View {
        Menu {
            Button {
                if !selected.isEmpty {
                    selected = []
                    onSelect()
                }
            } label: {
                HStack {
                    Text("All")
                    if selected.isEmpty { Image(systemName: "checkmark") }
                }
            }
            Divider()
            ForEach(statuses, id: \.self) { status in
                Button {
                    if selected.contains(status) {
                        selected.remove(status)
                    } else {
                        selected.insert(status)
                    }
                    onSelect()
                } label: {
                    HStack {
                        Text(status.label)
                        if selected.contains(status) { Image(systemName: "checkmark") }
                    }
                }
            }
        } label: {
            ItemControlPill(
                title: statusFilterTitle,
                systemImage: "line.3.horizontal.decrease.circle\(selected.isEmpty ? "" : ".fill")",
                isActive: !selected.isEmpty,
                tone: .blue
            )
        }
        .accessibilityLabel(selected.isEmpty ? "Filter by status" : "Filtering by \(selected.count) statuses")
    }

    private var statusFilterTitle: String {
        selected.isEmpty ? "All statuses" : "\(selected.count) statuses"
    }
}

struct ItemSortMenu: View {
    @Binding var selected: ItemsViewModel.SortOption
    let onSelect: () -> Void

    var body: some View {
        Menu {
            ForEach(ItemsViewModel.SortOption.allCases) { option in
                Button {
                    guard selected != option else { return }
                    selected = option
                    onSelect()
                } label: {
                    HStack {
                        Text(option.label)
                        if selected == option { Image(systemName: "checkmark") }
                    }
                }
            }
        } label: {
            ItemControlPill(
                title: selected.label,
                systemImage: "arrow.up.arrow.down",
                isActive: selected != .assetTag,
                tone: .red
            )
        }
        .accessibilityLabel("Sort items by \(selected.label)")
    }
}

private struct ItemControlPill: View {
    let title: String
    let systemImage: String
    let isActive: Bool
    let tone: StatusTone

    var body: some View {
        Label(title, systemImage: systemImage)
            .font(.subheadline.weight(.semibold))
            .lineLimit(1)
            .foregroundStyle(isActive ? Color.statusText(tone) : Color.primary)
            .padding(.horizontal, 12)
            .frame(minHeight: 44)
            .background {
                Capsule().fill(isActive ? Color.statusBackground(tone) : Color(.secondarySystemBackground))
                Capsule().strokeBorder(
                    isActive ? Color.statusText(tone).opacity(0.35) : Color.primary.opacity(0.12),
                    lineWidth: 1
                )
            }
    }
}
