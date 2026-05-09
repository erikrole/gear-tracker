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
    var assets: [Asset] = []
    var isLoading = false
    var error: String?
    var pageError: String?
    var searchText = ""
    var selectedStatuses: Set<AssetComputedStatus> = []
    var favoritesOnly = false
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
                favoritesOnly: favoritesOnly,
                limit: limit,
                offset: offset
            )
            if Task.isCancelled { isLoading = false; return }
            if reset { assets = result.data } else { assets += result.data }
            offset += result.data.count
            hasMore = offset < result.total
            pageError = nil
            if reset && offset == result.data.count && searchText.isEmpty && selectedStatuses.isEmpty && !favoritesOnly {
                GearStore.shared.seedAssets(result.data)
            }
        } catch is CancellationError {
            // Superseded by a newer load.
        } catch {
            if reset {
                self.error = error.localizedDescription
            } else {
                self.pageError = error.localizedDescription
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

    func toggleFavorite(_ asset: Asset) async {
        let optimistic = !asset.isFavorited
        applyFavorite(assetId: asset.id, value: optimistic)
        do {
            let newState = try await APIClient.shared.toggleFavorite(assetId: asset.id)
            applyFavorite(assetId: asset.id, value: newState)
            if favoritesOnly && !newState {
                assets.removeAll { $0.id == asset.id }
            }
        } catch {
            applyFavorite(assetId: asset.id, value: asset.isFavorited)
        }
    }

    private func applyFavorite(assetId: String, value: Bool) {
        assets = assets.map { $0.id == assetId ? $0.withFavorited(value) : $0 }
    }
}

struct ItemsView: View {
    @State private var vm = ItemsViewModel()
    @State private var reserveAsset: Asset?
    @State private var navigationPath = NavigationPath()

    var body: some View {
        NavigationStack(path: $navigationPath) {
            Group {
                if let error = vm.error, vm.assets.isEmpty {
                    ContentUnavailableView {
                        Label("Couldn't load items", systemImage: "exclamationmark.triangle")
                    } description: {
                        Text(error)
                    } actions: {
                        Button("Retry") { Task { await vm.load(reset: true) } }
                            .buttonStyle(.borderedProminent)
                    }
                } else if vm.assets.isEmpty && vm.isLoading {
                    List {
                        ForEach(0..<10, id: \.self) { _ in
                            ItemRowSkeleton().listRowSeparator(.hidden)
                        }
                    }
                    .listStyle(.plain)
                    .allowsHitTesting(false)
                    .accessibilityHidden(true)  // Don't pollute VO with placeholder shapes during initial load.
                } else if vm.assets.isEmpty {
                    ContentUnavailableView(
                        vm.favoritesOnly ? "No Favorites" : "No Items",
                        systemImage: vm.favoritesOnly ? "star" : "archivebox",
                        description: Text(vm.searchText.isEmpty
                            ? (vm.favoritesOnly ? "Star items to add them here." : "No gear found.")
                            : "No results for \"\(vm.searchText)\".")
                    )
                } else {
                    List {
                        ForEach(vm.assets) { asset in
                            NavigationLink(value: asset) {
                                AssetRow(asset: asset)
                            }
                            .swipeActions(edge: .leading, allowsFullSwipe: true) {
                                Button {
                                    Task { await vm.toggleFavorite(asset) }
                                } label: {
                                    Label(
                                        asset.isFavorited ? "Unfavorite" : "Favorite",
                                        systemImage: asset.isFavorited ? "star.slash" : "star"
                                    )
                                }
                                .tint(.yellow)
                            }
                            .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                                Button {
                                    reserveAsset = asset
                                } label: {
                                    Label("Reserve", systemImage: "plus.circle")
                                }
                                .tint(.accentColor)
                            }
                            .contextMenu {
                                Button {
                                    Task { await vm.toggleFavorite(asset) }
                                } label: {
                                    Label(
                                        asset.isFavorited ? "Unfavorite" : "Favorite",
                                        systemImage: asset.isFavorited ? "star.slash" : "star"
                                    )
                                }

                                Button {
                                    reserveAsset = asset
                                } label: {
                                    Label("Reserve", systemImage: "plus.circle")
                                }

                                if let tag = asset.assetTag {
                                    Button {
                                        UIPasteboard.general.string = tag
                                    } label: {
                                        Label("Copy Asset Tag", systemImage: "doc.on.doc")
                                    }
                                }
                            }
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
                        } else if vm.hasMore {
                            ProgressView()
                                .frame(maxWidth: .infinity)
                                .task(id: vm.assets.count) { await vm.load() }
                        } else if vm.assets.count > 10 {
                            Text("End of list")
                                .font(.caption2)
                                .foregroundStyle(.tertiary)
                                .frame(maxWidth: .infinity, alignment: .center)
                                .padding(.vertical, 12)
                                .listRowSeparator(.hidden)
                        }
                    }
                    .listStyle(.plain)
                }
            }
            .navigationTitle("Items")
            .searchable(text: $vm.searchText, prompt: "Search gear…")
            .onChange(of: vm.searchText) { vm.onSearchChange() }
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    HStack(spacing: 12) {
                        Button {
                            vm.favoritesOnly.toggle()
                            Task { await vm.load(reset: true) }
                        } label: {
                            Image(systemName: vm.favoritesOnly ? "star.fill" : "star")
                                .foregroundStyle(vm.favoritesOnly ? .yellow : .primary)
                                .frame(minWidth: 44, minHeight: 44)
                        }
                        .accessibilityLabel(vm.favoritesOnly ? "Showing favorites" : "Show favorites")
                        .sensoryFeedback(.selection, trigger: vm.favoritesOnly)

                        AssetStatusFilterMenu(selected: $vm.selectedStatuses) {
                            Task { await vm.load(reset: true) }
                        }
                    }
                }
            }
            .refreshable { await vm.load(reset: true) }
            .task { await vm.load(reset: true) }
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
        }
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

    var body: some View {
        HStack(spacing: 12) {
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
                HStack(spacing: 4) {
                    if let cat = asset.category {
                        Text(cat.name)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    if asset.category != nil {
                        Text("·").font(.caption).foregroundStyle(.tertiary)
                    }
                    Text(asset.location.name)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .lineLimit(1)
            }

            Spacer()

            AssetListBadge(asset: asset)
        }
        .padding(.vertical, 4)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(rowAccessibilityLabel)
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
           asset.computedStatus == .checkedOut || asset.computedStatus == .reserved {
            parts.append("\(asset.computedStatus.label.lowercased()) by \(name)")
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

private struct AssetListBadge: View {
    let asset: Asset

    /// Maps the asset's computed status (with overdue override) to a
    /// cross-app `StatusTone`. `nil` falls back to a muted gray pairing
    /// for retired / unknown — consistent with `Color.statusText/.statusBackground`'s
    /// gray case.
    private var tone: StatusTone {
        if asset.computedStatus == .checkedOut, asset.activeBooking?.isOverdue == true {
            return .red
        }
        switch asset.computedStatus {
        case .available:   return .green
        case .checkedOut:  return .blue
        case .reserved:    return .purple
        case .maintenance: return .orange
        case .retired:     return .gray
        case .unknown:     return .gray
        }
    }

    private var badgeText: String {
        if let name = asset.activeBooking?.requesterName,
           asset.computedStatus == .checkedOut || asset.computedStatus == .reserved {
            return name
        }
        return asset.computedStatus.label
    }

    private var dueLabel: String? {
        guard asset.computedStatus == .checkedOut, let booking = asset.activeBooking else { return nil }
        let endsAt = booking.endsAt
        let days = Int((endsAt.timeIntervalSinceNow / 86_400).rounded())
        if booking.isOverdue {
            let overdueDays = max(1, abs(days))
            return overdueDays == 1 ? "1d overdue" : "\(overdueDays)d overdue"
        }
        if days <= 0 { return "due today" }
        if days == 1 { return "due 1d" }
        if days < 14 { return "due \(days)d" }
        return nil
    }

    var body: some View {
        VStack(alignment: .trailing, spacing: 2) {
            Text(badgeText)
                .font(.caption2.weight(.semibold))
                .lineLimit(1)
                .fixedSize()
                .padding(.horizontal, 6)
                .padding(.vertical, 2)
                .background(Color.statusBackground(tone), in: Capsule())
                .foregroundStyle(Color.statusText(tone))
            if let dueLabel {
                Text(dueLabel)
                    .font(.caption2)
                    .foregroundStyle(Color.statusText(tone).opacity(0.8))
                    .monospacedDigit()
            }
        }
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

    private let statuses: [AssetComputedStatus] = [.available, .checkedOut, .reserved, .maintenance]

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
            Image(systemName: "line.3.horizontal.decrease.circle\(selected.isEmpty ? "" : ".fill")")
                .frame(minWidth: 44, minHeight: 44)
        }
        .accessibilityLabel(selected.isEmpty ? "Filter by status" : "Filtering by \(selected.count) statuses")
    }
}
