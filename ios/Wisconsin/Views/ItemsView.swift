import SwiftUI

/// Hashable wrapper so navigation can distinguish a "go to booking detail"
/// route from arbitrary String values pushed onto the path.
struct BookingRouteId: Hashable {
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
                        Label("Error", systemImage: "exclamationmark.triangle")
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

    var body: some View {
        HStack(spacing: 12) {
            AssetThumbnail(imageUrl: asset.imageUrl, size: 44)

            VStack(alignment: .leading, spacing: 3) {
                Text(asset.assetTag ?? asset.displayName)
                    .font(.subheadline.weight(.medium))
                    .lineLimit(1)
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
    }
}

private struct AssetListBadge: View {
    let asset: Asset

    private var badgeColor: Color {
        if asset.computedStatus == .checkedOut, asset.activeBooking?.isOverdue == true {
            return .red
        }
        switch asset.computedStatus {
        case .available: return .green
        case .checkedOut: return .blue
        case .reserved: return .purple
        case .maintenance: return .orange
        case .retired: return .secondary
        case .unknown: return .gray
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
                .background(badgeColor.opacity(0.15), in: Capsule())
                .foregroundStyle(badgeColor)
            if let dueLabel {
                Text(dueLabel)
                    .font(.caption2)
                    .foregroundStyle(badgeColor.opacity(0.8))
                    .monospacedDigit()
            }
        }
        .frame(maxWidth: 140, alignment: .trailing)
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
            .background(color.opacity(0.15), in: Capsule())
            .foregroundStyle(color)
    }

    private var color: Color {
        switch status {
        case .available: .green
        case .checkedOut: .blue
        case .reserved: .purple
        case .maintenance: .orange
        case .retired: .secondary
        case .unknown: .gray
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
