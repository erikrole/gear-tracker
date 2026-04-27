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
    var lastLoadedAt: Date?
    var searchText = ""
    var selectedStatus: AssetComputedStatus?
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
            // Seed from cache immediately on unfiltered first-page load
            if searchText.isEmpty && selectedStatus == nil && !favoritesOnly {
                let cached = GearStore.shared.cachedAssets()
                if !cached.isEmpty { assets = cached.map(\.asAsset) }
            }
        }
        isLoading = true
        if reset { error = nil }
        do {
            let result = try await APIClient.shared.assets(
                search: searchText.isEmpty ? nil : searchText,
                status: selectedStatus,
                favoritesOnly: favoritesOnly,
                limit: limit,
                offset: offset
            )
            if Task.isCancelled { isLoading = false; return }
            if reset { assets = result.data } else { assets += result.data }
            offset += result.data.count
            hasMore = offset < result.total
            pageError = nil
            lastLoadedAt = Date()
            if reset && offset == result.data.count && searchText.isEmpty && selectedStatus == nil && !favoritesOnly {
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
        // Optimistic update
        assets = assets.map { a in
            guard a.id == asset.id else { return a }
            return Asset(
                id: a.id, assetTag: a.assetTag, name: a.name, brand: a.brand, model: a.model,
                serialNumber: a.serialNumber, imageUrl: a.imageUrl, computedStatus: a.computedStatus,
                location: a.location, category: a.category, department: a.department,
                activeBooking: a.activeBooking, purchaseDate: a.purchaseDate,
                purchasePrice: a.purchasePrice, residualValue: a.residualValue,
                isFavorited: !a.isFavorited
            )
        }
        do {
            let newState = try await APIClient.shared.toggleFavorite(assetId: asset.id)
            // Reconcile with server truth in case of race
            assets = assets.map { a in
                guard a.id == asset.id else { return a }
                return Asset(
                    id: a.id, assetTag: a.assetTag, name: a.name, brand: a.brand, model: a.model,
                    serialNumber: a.serialNumber, imageUrl: a.imageUrl, computedStatus: a.computedStatus,
                    location: a.location, category: a.category, department: a.department,
                    activeBooking: a.activeBooking, purchaseDate: a.purchaseDate,
                    purchasePrice: a.purchasePrice, residualValue: a.residualValue,
                    isFavorited: newState
                )
            }
            // If filtering by favorites, remove items that were just unfavorited
            if favoritesOnly && !newState {
                assets.removeAll { $0.id == asset.id }
            }
        } catch {
            // Revert on failure
            assets = assets.map { a in
                guard a.id == asset.id else { return a }
                return Asset(
                    id: a.id, assetTag: a.assetTag, name: a.name, brand: a.brand, model: a.model,
                    serialNumber: a.serialNumber, imageUrl: a.imageUrl, computedStatus: a.computedStatus,
                    location: a.location, category: a.category, department: a.department,
                    activeBooking: a.activeBooking, purchaseDate: a.purchaseDate,
                    purchasePrice: a.purchasePrice, residualValue: a.residualValue,
                    isFavorited: asset.isFavorited
                )
            }
        }
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
                        if let stamp = vm.lastLoadedAt?.freshnessLabel {
                            Text(stamp)
                                .font(.caption2)
                                .foregroundStyle(.tertiary)
                                .frame(maxWidth: .infinity, alignment: .center)
                                .listRowSeparator(.hidden)
                                .listRowBackground(Color.clear)
                                .padding(.top, 2)
                        }
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

                        AssetStatusFilterMenu(selected: $vm.selectedStatus) {
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

    var body: some View {
        if asset.computedStatus == .available {
            Text("Available")
                .font(.caption2.weight(.semibold))
                .padding(.horizontal, 6)
                .padding(.vertical, 2)
                .background(Color.green.opacity(0.15), in: Capsule())
                .foregroundStyle(.green)
        } else if let name = asset.activeBooking?.requesterName {
            Text(name)
                .font(.caption2.weight(.semibold))
                .padding(.horizontal, 6)
                .padding(.vertical, 2)
                .background(Color.red.opacity(0.15), in: Capsule())
                .foregroundStyle(.red)
                .lineLimit(1)
                .frame(maxWidth: 110, alignment: .trailing)
        } else {
            AssetStatusBadge(status: asset.computedStatus)
        }
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
    @Binding var selected: AssetComputedStatus?
    let onSelect: () -> Void

    private let statuses: [AssetComputedStatus?] = [nil, .available, .checkedOut, .reserved, .maintenance]

    var body: some View {
        Menu {
            ForEach(statuses, id: \.self) { status in
                Button {
                    selected = status
                    onSelect()
                } label: {
                    HStack {
                        Text(status?.label ?? "All")
                        if selected == status { Image(systemName: "checkmark") }
                    }
                }
            }
        } label: {
            Image(systemName: "line.3.horizontal.decrease.circle\(selected != nil ? ".fill" : "")")
                .frame(minWidth: 44, minHeight: 44)
        }
        .accessibilityLabel("Filter by status")
    }
}
