import SwiftUI

struct ItemDetailView: View {
    let assetId: String

    @State private var asset: AssetDetail?
    @State private var isLoading = true
    @State private var error: String?
    @State private var showEdit = false

    var body: some View {
        Group {
            if isLoading && asset == nil {
                ItemDetailSkeleton()
            } else if let error, asset == nil {
                ContentUnavailableView {
                    Label("Error", systemImage: "exclamationmark.triangle")
                } description: {
                    Text(error)
                } actions: {
                    Button("Retry") { Task { await loadAsset() } }
                        .buttonStyle(.borderedProminent)
                }
            } else if let asset {
                ScrollView {
                    VStack(spacing: 16) {
                        FormCard { ItemHeroSection(asset: asset) }
                        FormCard { ItemMetaSection(asset: asset) }
                        if let booking = asset.activeBooking {
                            FormCard { ActiveBookingSection(booking: booking) }
                        }
                        if !asset.upcomingReservations.isEmpty {
                            FormCard { UpcomingReservationsSection(reservations: asset.upcomingReservations) }
                        }
                        if let notes = asset.notes, !notes.isEmpty {
                            FormCard { NotesSection(notes: notes) }
                        }
                    }
                    .padding()
                }
                .background(Color(.systemGroupedBackground))
            }
        }
        .navigationTitle(asset?.displayName ?? "Item")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if asset != nil {
                ToolbarItem(placement: .topBarTrailing) {
                    Button { showEdit = true } label: {
                        Image(systemName: "pencil")
                    }
                }
            }
        }
        .task { await loadAsset() }
        .refreshable { await loadAsset() }
        .sheet(isPresented: $showEdit) {
            if let asset {
                EditAssetSheet(asset: asset) {
                    Task { await loadAsset() }
                }
            }
        }
    }

    private func loadAsset() async {
        isLoading = true
        error = nil
        do {
            asset = try await APIClient.shared.asset(id: assetId)
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }
}

// MARK: - Edit Sheet

struct EditAssetSheet: View {
    let asset: AssetDetail
    let onSaved: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var name: String
    @State private var serialNumber: String
    @State private var notes: String
    @State private var isSaving = false
    @State private var error: String?

    init(asset: AssetDetail, onSaved: @escaping () -> Void) {
        self.asset = asset
        self.onSaved = onSaved
        _name = State(wrappedValue: asset.name ?? "")
        _serialNumber = State(wrappedValue: asset.serialNumber ?? "")
        _notes = State(wrappedValue: asset.notes ?? "")
    }

    private var hasChanges: Bool {
        name != (asset.name ?? "")
            || serialNumber != (asset.serialNumber ?? "")
            || notes != (asset.notes ?? "")
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 12) {
                    FormCard {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Name")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                                .textCase(.uppercase)
                            TextField("Custom name (optional)", text: $name)
                                .font(.body)
                            Text("Overrides the default \(asset.displayName) label.")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                    FormCard {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Serial Number")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                                .textCase(.uppercase)
                            TextField("Serial number", text: $serialNumber)
                                .fontDesign(.monospaced)
                                .autocorrectionDisabled()
                                .textInputAutocapitalization(.never)
                        }
                    }
                    FormCard {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Notes")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                                .textCase(.uppercase)
                            TextField("Notes…", text: $notes, axis: .vertical)
                                .lineLimit(3...8)
                        }
                    }
                    if let error {
                        Text(error)
                            .foregroundStyle(.red)
                            .font(.footnote)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.horizontal, 4)
                    }
                }
                .padding(20)
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("Edit Item")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { Task { await save() } }
                        .disabled(!hasChanges || isSaving)
                        .fontWeight(.semibold)
                }
            }
        }
    }

    private func save() async {
        isSaving = true
        do {
            try await APIClient.shared.updateAsset(
                id: asset.id,
                name: name != (asset.name ?? "") ? (name.isEmpty ? nil : name) : nil,
                serialNumber: serialNumber != (asset.serialNumber ?? "") ? (serialNumber.isEmpty ? nil : serialNumber) : nil,
                notes: notes != (asset.notes ?? "") ? (notes.isEmpty ? nil : notes) : nil
            )
            onSaved()
            dismiss()
        } catch {
            self.error = error.localizedDescription
        }
        isSaving = false
    }
}

// MARK: - Sub-sections

private struct ItemHeroSection: View {
    let asset: AssetDetail

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top) {
                AssetThumbnail(imageUrl: asset.imageUrl, size: 72)
                VStack(alignment: .leading, spacing: 4) {
                    Text(asset.displayName)
                        .font(.title3.bold())
                    if let tag = asset.assetTag {
                        Text(tag)
                            .font(.caption.monospacedDigit())
                            .foregroundStyle(.secondary)
                    }
                    AssetStatusBadge(status: asset.computedStatus)
                }
                Spacer()
            }
        }
    }
}

private struct ItemMetaSection: View {
    let asset: AssetDetail

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Details")
                .font(.caption)
                .foregroundStyle(.secondary)
                .textCase(.uppercase)

            LabeledContent("Location", value: asset.location.name)
            if let cat = asset.category {
                LabeledContent("Category", value: cat.name)
            }
            if let dept = asset.department {
                LabeledContent("Department", value: dept.name)
            }
            if let serial = asset.serialNumber {
                LabeledContent("Serial") {
                    Text(serial).fontDesign(.monospaced).font(.subheadline)
                }
            }
            if let price = asset.purchasePrice.flatMap(Double.init) {
                LabeledContent("Purchase Price", value: price, format: .currency(code: "USD"))
            }
        }
    }
}

private struct NotesSection: View {
    let notes: String

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("Notes")
                .font(.caption)
                .foregroundStyle(.secondary)
                .textCase(.uppercase)
            Text(notes)
                .font(.subheadline)
        }
    }
}

private struct ActiveBookingSection: View {
    let booking: AssetActiveBooking

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Currently Checked Out")
                .font(.caption)
                .foregroundStyle(.secondary)
                .textCase(.uppercase)

            NavigationLink(destination: BookingDetailView(bookingId: booking.id)) {
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(booking.title)
                            .font(.subheadline.weight(.medium))
                        Text(booking.requesterName)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        Text("Due \(booking.endsAt.formatted(date: .abbreviated, time: .shortened))")
                            .font(.caption2)
                            .foregroundStyle(booking.isOverdue ? AnyShapeStyle(.red) : AnyShapeStyle(.tertiary))
                    }
                    Spacer()
                    if booking.isOverdue {
                        Image(systemName: "exclamationmark.circle.fill")
                            .foregroundStyle(.red)
                    }
                    Image(systemName: "chevron.right")
                        .foregroundStyle(.tertiary)
                        .font(.caption)
                }
                .padding(12)
                .background(.quaternary, in: RoundedRectangle(cornerRadius: 10))
            }
            .buttonStyle(.plain)
        }
    }
}

private struct UpcomingReservationsSection: View {
    let reservations: [UpcomingReservation]

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Upcoming Reservations")
                .font(.caption)
                .foregroundStyle(.secondary)
                .textCase(.uppercase)

            ForEach(reservations) { res in
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(res.title)
                            .font(.subheadline)
                            .lineLimit(1)
                        Text(res.requesterName)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        Text(res.startsAt.formatted(date: .abbreviated, time: .shortened))
                            .font(.caption2)
                            .foregroundStyle(.tertiary)
                    }
                    Spacer()
                    StatusBadge(status: res.status)
                }
                .padding(10)
                .background(.quaternary.opacity(0.5), in: RoundedRectangle(cornerRadius: 8))
            }
        }
    }
}
