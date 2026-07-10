import SwiftUI

/// Step 2 of Create Reservation: a search-first equipment picker.
///
/// The interaction model is "search, grab, search again": tapping a result
/// adds it, clears the query, and keeps the keyboard up so the next search
/// starts immediately. Tapping an already-added row removes it (the undo
/// path). Selected gear lives in a cart drawer pinned to the bottom edge;
/// bulk quantities are fine-tuned there rather than in the results.
struct CreateBookingEquipmentPicker: View {
    @Bindable var vm: CreateBookingViewModel
    let onReview: () -> Void

    @State private var showCart = false
    @State private var justAdded: String?
    @State private var justAddedClearTask: Task<Void, Never>?
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private var isBrowsing: Bool {
        vm.assetSearch.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private var hasNoResults: Bool {
        vm.displayedAssetGroups.isEmpty
            && vm.displayedBulkSkus.isEmpty
            && !vm.isLoadingAssets
            && vm.error == nil
    }

    var body: some View {
        List {
            if isBrowsing && vm.browseCategories.count > 1 {
                categoryChips
            }

            statusSection

            if !vm.displayedBulkSkus.isEmpty {
                Section("Supplies") {
                    ForEach(vm.displayedBulkSkus) { sku in
                        BulkResultRow(sku: sku, quantity: vm.quantity(for: sku)) {
                            handleBulkTap(sku)
                        }
                    }
                }
            }

            ForEach(vm.displayedAssetGroups) { group in
                Section(group.title) {
                    ForEach(group.assets) { asset in
                        AssetPickerRow(
                            asset: asset,
                            isSelected: vm.selectedAssetIds.contains(asset.id),
                            isConflicted: vm.conflictedAssetIds.contains(asset.id)
                        ) {
                            handleAssetTap(asset)
                        }
                    }
                }
            }

            if vm.hasMoreAssets && !vm.isLoadingAssets {
                Section {
                    Label("More equipment exists. Search to narrow results.", systemImage: "line.3.horizontal.decrease.circle")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .listStyle(.insetGrouped)
        .searchable(
            text: $vm.assetSearch,
            placement: .navigationBarDrawer(displayMode: .always),
            prompt: Text("Search equipment")
        )
        .onChange(of: vm.assetSearch) { vm.onSearchChange() }
        .scrollDismissesKeyboard(.immediately)
        .safeAreaInset(edge: .bottom, spacing: 0) { cartBar }
        .sheet(isPresented: $showCart) {
            EquipmentCartSheet(vm: vm)
                .presentationDetents([.medium, .large])
                .presentationDragIndicator(.visible)
        }
    }

    // MARK: - Sections

    private var categoryChips: some View {
        Section {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    FilterChip(label: "All", isOn: vm.browseCategoryFilter == nil) {
                        vm.browseCategoryFilter = nil
                        Haptics.selection()
                    }
                    ForEach(vm.browseCategories, id: \.self) { category in
                        FilterChip(label: category, isOn: vm.browseCategoryFilter == category) {
                            vm.browseCategoryFilter = vm.browseCategoryFilter == category ? nil : category
                            Haptics.selection()
                        }
                    }
                }
                .padding(.horizontal, 20)
                .padding(.vertical, 2)
            }
            .listRowInsets(EdgeInsets())
            .listRowBackground(Color.clear)
            .accessibilityLabel("Filter by category")
        }
    }

    @ViewBuilder
    private var statusSection: some View {
        if vm.isLoadingAssets || vm.error != nil || hasNoResults {
            Section {
                if vm.isLoadingAssets {
                    HStack {
                        Spacer()
                        ProgressView()
                        Spacer()
                    }
                    .listRowBackground(Color.clear)
                } else if let err = vm.error {
                    // Surface a load error with retry so server failures do not
                    // look like an empty equipment room.
                    HStack(spacing: 12) {
                        Image(systemName: "wifi.exclamationmark")
                            .foregroundStyle(Color.statusText(.red))
                            .accessibilityHidden(true)
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Couldn't load equipment")
                                .font(.subheadline.weight(.medium))
                            Text(err)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                                .lineLimit(2)
                        }
                        Spacer()
                        Button("Retry") {
                            Task { await vm.loadAvailableAssets(reset: true) }
                        }
                        .buttonStyle(.bordered)
                        .controlSize(.small)
                    }
                } else if isBrowsing {
                    Text("No available equipment found.")
                        .foregroundStyle(.secondary)
                        .font(.subheadline)
                } else {
                    ContentUnavailableView.search(text: vm.assetSearch)
                        .listRowBackground(Color.clear)
                }
            }
        }
    }

    // MARK: - Cart bar

    private var cartBar: some View {
        HStack(spacing: 12) {
            Button {
                showCart = true
                Haptics.tap()
            } label: {
                HStack(spacing: 10) {
                    Image(systemName: "shippingbox.fill")
                        .font(.body.weight(.semibold))
                        .foregroundStyle(vm.selectedEquipmentCount > 0 ? Color.statusText(.blue) : Color(.systemGray3))
                    Group {
                        if let justAdded {
                            Label(justAdded, systemImage: "checkmark.circle.fill")
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(Color.statusText(.green))
                                .lineLimit(1)
                        } else if vm.selectedEquipmentCount == 0 {
                            Text("No equipment yet")
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                        } else {
                            HStack(spacing: 5) {
                                Text("\(vm.selectedEquipmentCount) item\(vm.selectedEquipmentCount == 1 ? "" : "s")")
                                    .font(.subheadline.weight(.semibold))
                                    .monospacedDigit()
                                    .contentTransition(.numericText())
                                Image(systemName: "chevron.up")
                                    .font(.caption2.weight(.bold))
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .disabled(vm.selectedEquipmentCount == 0)
            .accessibilityLabel("\(vm.selectedEquipmentCount) items selected, view selected equipment")
            .animation(reduceMotion ? nil : .easeInOut(duration: 0.2), value: justAdded)
            .animation(reduceMotion ? nil : .easeInOut(duration: 0.2), value: vm.selectedEquipmentCount)

            Spacer(minLength: 12)

            Button {
                onReview()
            } label: {
                Text("Review")
                    .fontWeight(.semibold)
                    .padding(.horizontal, 6)
            }
            .buttonStyle(.borderedProminent)
            .disabled(vm.selectedEquipmentCount == 0 || vm.isSubmitting)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .frame(maxWidth: .infinity)
        .background(.bar)
        .overlay(alignment: .top) { Divider() }
    }

    // MARK: - Tap handling

    private func handleAssetTap(_ asset: Asset) {
        if vm.selectedAssetIds.contains(asset.id) {
            vm.toggleAsset(asset)
            Haptics.selection()
        } else {
            vm.addAsset(asset)
            noteAdded(asset.itemListPrimaryTitle)
        }
    }

    private func handleBulkTap(_ sku: FormBulkSku) {
        guard vm.quantity(for: sku) < sku.availableQuantity else {
            Haptics.warning()
            return
        }
        vm.incrementBulk(sku)
        noteAdded(sku.name)
    }

    /// Post-add bookkeeping: haptic, clear the query so the next search
    /// starts clean (keyboard stays up), and flash the name on the cart bar.
    private func noteAdded(_ name: String) {
        Haptics.selection()
        if !vm.assetSearch.isEmpty {
            vm.assetSearch = ""
        }
        justAddedClearTask?.cancel()
        justAdded = name
        justAddedClearTask = Task {
            try? await Task.sleep(for: .seconds(1.6))
            guard !Task.isCancelled else { return }
            justAdded = nil
        }
    }
}

// MARK: - Bulk result row

/// A bulk SKU in the results list. Tap adds one unit; quantity adjustments
/// beyond that happen in the cart drawer.
struct BulkResultRow: View {
    let sku: FormBulkSku
    let quantity: Int
    let onTap: () -> Void

    private var atMax: Bool { quantity >= sku.availableQuantity }
    private var subtitle: String {
        let unit = sku.unit?.isEmpty == false ? " \(sku.unit!)" : ""
        return "\(sku.availableQuantity) available\(unit)"
    }

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 12) {
                BookingBulkThumbnail(imageUrl: sku.imageUrl)

                VStack(alignment: .leading, spacing: 3) {
                    Text(sku.name)
                        .font(.gothamBold(size: 16))
                        .foregroundStyle(.primary)
                        .lineLimit(1)
                    Text(subtitle)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }

                Spacer()

                if quantity > 0 {
                    Text("×\(quantity)")
                        .font(.subheadline.weight(.semibold))
                        .monospacedDigit()
                        .foregroundStyle(Color.statusText(.blue))
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(Color.statusBackground(.blue), in: Capsule())
                        .contentTransition(.numericText())
                } else {
                    Image(systemName: "plus.circle")
                        .font(.title3)
                        .foregroundStyle(atMax ? Color(.systemGray4) : Color(.systemGray2))
                }
            }
            .contentShape(Rectangle())
            .opacity(atMax && quantity == 0 ? 0.5 : 1)
        }
        .buttonStyle(ScalePressStyle())
        .disabled(atMax)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(sku.name), \(subtitle), \(quantity) selected")
        .accessibilityHint(atMax ? "None left to add" : "Adds one")
    }
}

// MARK: - Cart drawer

/// The cart: everything picked so far, with removal and bulk quantity
/// steppers. Presented as a medium/large detent sheet from the cart bar.
struct EquipmentCartSheet: View {
    @Bindable var vm: CreateBookingViewModel
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Group {
                if vm.selectedEquipmentCount == 0 {
                    ContentUnavailableView(
                        "No equipment selected",
                        systemImage: "shippingbox",
                        description: Text("Search or scan to add gear to this reservation.")
                    )
                } else {
                    List {
                        if !vm.conflictedAssetIds.isEmpty {
                            let count = vm.conflictedAssetIds.count
                            Section {
                                Label(
                                    "\(count) scheduling conflict\(count == 1 ? "" : "s") — availability is rechecked when you reserve.",
                                    systemImage: "exclamationmark.triangle.fill"
                                )
                                .font(.footnote)
                                .foregroundStyle(Color.statusText(.orange))
                            }
                        }

                        if !vm.selectedAssets.isEmpty {
                            Section("Equipment") {
                                ForEach(vm.selectedAssets) { asset in
                                    SelectedEquipmentRow(
                                        asset: asset,
                                        isConflicted: vm.conflictedAssetIds.contains(asset.id)
                                    ) {
                                        vm.removeSelectedAsset(asset)
                                        Haptics.selection()
                                    }
                                }
                            }
                        }

                        if !vm.selectedBulkSkus.isEmpty {
                            Section("Supplies") {
                                ForEach(vm.selectedBulkSkus) { sku in
                                    BulkQuantityRow(
                                        sku: sku,
                                        quantity: vm.quantity(for: sku),
                                        onDecrement: {
                                            vm.decrementBulk(sku)
                                            Haptics.selection()
                                        },
                                        onIncrement: {
                                            vm.incrementBulk(sku)
                                            Haptics.selection()
                                        }
                                    )
                                }
                            }
                        }
                    }
                    .listStyle(.insetGrouped)
                }
            }
            .navigationTitle("Selected Equipment")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                        .fontWeight(.semibold)
                }
            }
        }
    }
}
