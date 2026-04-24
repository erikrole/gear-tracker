import SwiftUI

@MainActor
@Observable
final class ItemsViewModel {
    var assets: [Asset] = []
    var isLoading = false
    var error: String?
    var searchText = ""
    var selectedStatus: AssetComputedStatus?
    var hasMore = true

    private var offset = 0
    private let limit = 30
    private var searchTask: Task<Void, Never>?

    func load(reset: Bool = false) async {
        guard !isLoading else { return }
        if reset {
            offset = 0
            hasMore = true
            // Don't clear assets — swap in place after fetch to avoid skeleton flash on tab return
        }
        isLoading = true
        error = nil
        do {
            let result = try await APIClient.shared.assets(
                search: searchText.isEmpty ? nil : searchText,
                status: selectedStatus,
                limit: limit,
                offset: offset
            )
            if reset { assets = result.data } else { assets += result.data }
            offset += result.data.count
            hasMore = offset < result.total
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }

    func onSearchChange() {
        searchTask?.cancel()
        searchTask = Task {
            try? await Task.sleep(for: .milliseconds(350))
            guard !Task.isCancelled else { return }
            await load(reset: true)
        }
    }
}

struct ItemsView: View {
    @State private var vm = ItemsViewModel()

    var body: some View {
        NavigationStack {
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
                        "No Items",
                        systemImage: "archivebox",
                        description: Text(vm.searchText.isEmpty ? "No gear found." : "No results for \"\(vm.searchText)\".")
                    )
                } else {
                    List {
                        ForEach(vm.assets) { asset in
                            NavigationLink(value: asset) {
                                AssetRow(asset: asset)
                            }
                        }
                        if vm.hasMore {
                            ProgressView()
                                .frame(maxWidth: .infinity)
                                .onAppear { Task { await vm.load() } }
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
                    AssetStatusFilterMenu(selected: $vm.selectedStatus) {
                        Task { await vm.load(reset: true) }
                    }
                }
            }
            .refreshable { await vm.load(reset: true) }
            .task { await vm.load(reset: true) }
            .navigationDestination(for: Asset.self) { asset in
                ItemDetailView(assetId: asset.id)
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
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let image):
                        image.resizable().scaledToFill()
                    default:
                        placeholder
                    }
                }
            } else {
                placeholder
            }
        }
        .frame(width: size, height: size)
        .background(Color(.systemGray6))
        .clipShape(RoundedRectangle(cornerRadius: cornerRadius))
        .overlay(
            RoundedRectangle(cornerRadius: cornerRadius)
                .strokeBorder(Color.black.opacity(0.08), lineWidth: 1)
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
        }
    }
}
