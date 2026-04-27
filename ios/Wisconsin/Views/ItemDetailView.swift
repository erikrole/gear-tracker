import SwiftUI

struct ItemDetailView: View {
    let assetId: String

    @State private var asset: AssetDetail?
    @State private var isLoading = true
    @State private var error: String?
    @State private var showEdit = false
    @State private var isFavorited = false
    @State private var favoriteError: String?
    @Environment(SessionStore.self) private var session

    private var canEditAsset: Bool {
        let role = session.currentUser?.role ?? ""
        return role == "STAFF" || role == "ADMIN"
    }

    private func toggleFavorite() async {
        let previous = isFavorited
        isFavorited.toggle()
        do {
            isFavorited = try await APIClient.shared.toggleFavorite(assetId: assetId)
        } catch {
            isFavorited = previous
            favoriteError = error.localizedDescription
        }
    }

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
                    VStack(spacing: 12) {
                        ItemHeroCard(asset: asset)
                        if let booking = asset.activeBooking {
                            ActiveBookingCard(booking: booking)
                        }
                        if !asset.upcomingReservations.isEmpty {
                            UpcomingReservationsCard(reservations: asset.upcomingReservations)
                        }
                        if let notes = asset.notes, !notes.isEmpty {
                            NotesCard(notes: notes)
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 12)
                }
                .background(Color(.systemGroupedBackground))
            }
        }
        .navigationTitle(asset?.displayName ?? "Item")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if asset != nil {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        Task { await toggleFavorite() }
                    } label: {
                        Image(systemName: isFavorited ? "star.fill" : "star")
                            .foregroundStyle(isFavorited ? .yellow : .primary)
                            .frame(minWidth: 44, minHeight: 44)
                    }
                    .accessibilityLabel(isFavorited ? "Unfavorite" : "Favorite")
                    .sensoryFeedback(.selection, trigger: isFavorited)
                }
                if canEditAsset {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button { showEdit = true } label: {
                            Image(systemName: "pencil")
                                .frame(minWidth: 44, minHeight: 44)
                        }
                        .accessibilityLabel("Edit Item")
                    }
                }
            }
        }
        .alert("Couldn't update favorite", isPresented: Binding(
            get: { favoriteError != nil },
            set: { if !$0 { favoriteError = nil } }
        )) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(favoriteError ?? "")
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
            isFavorited = asset?.isFavorited ?? false
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
    @State private var showDiscardConfirm = false

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
                    Button("Cancel") {
                        if isSaving { return }
                        if hasChanges {
                            showDiscardConfirm = true
                        } else {
                            dismiss()
                        }
                    }
                    .disabled(isSaving)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { Task { await save() } }
                        .disabled(!hasChanges || isSaving)
                        .fontWeight(.semibold)
                }
            }
            .interactiveDismissDisabled(hasChanges || isSaving)
            .confirmationDialog(
                "Discard changes?",
                isPresented: $showDiscardConfirm,
                titleVisibility: .visible
            ) {
                Button("Discard", role: .destructive) { dismiss() }
                Button("Keep Editing", role: .cancel) {}
            } message: {
                Text("Your changes will be lost.")
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

// MARK: - Brand color

private let wiRed = Color(red: 0.773, green: 0.020, blue: 0.047)

// MARK: - Hero card

private struct ItemHeroCard: View {
    let asset: AssetDetail

    var body: some View {
        VStack(spacing: 0) {
            // Top accent stripe
            LinearGradient(
                stops: [
                    .init(color: wiRed, location: 0),
                    .init(color: wiRed.opacity(0.2), location: 0.4),
                    .init(color: .clear, location: 0.75),
                ],
                startPoint: .leading,
                endPoint: .trailing
            )
            .frame(height: 2)

            HStack(alignment: .top, spacing: 14) {
                AssetThumbnail(imageUrl: asset.imageUrl, size: 80)
                    .padding(.top, 2)

                VStack(alignment: .leading, spacing: 5) {
                    Text(asset.displayName)
                        .font(.system(size: 22, weight: .black))
                        .tracking(-0.3)
                        .lineLimit(2)

                    if let tag = asset.assetTag {
                        Text(tag)
                            .font(.system(.caption, design: .monospaced))
                            .foregroundStyle(.secondary)
                    }

                    FlowRow(spacing: 6) {
                        AssetStatusBadge(status: asset.computedStatus)
                        MetaChip(asset.location.name)
                        if let cat = asset.category?.name {
                            MetaChip(cat)
                        }
                        if let dept = asset.department?.name {
                            MetaChip(dept)
                        }
                    }
                    .padding(.top, 2)

                    if let serial = asset.serialNumber {
                        Text(serial)
                            .font(.system(.caption2, design: .monospaced))
                            .foregroundStyle(.tertiary)
                            .padding(.top, 1)
                    }
                }
                Spacer(minLength: 0)
            }
            .padding(16)
        }
        .background {
            ZStack(alignment: .topLeading) {
                Color(.secondarySystemGroupedBackground)
                RadialGradient(
                    colors: [wiRed.opacity(0.06), .clear],
                    center: .topLeading,
                    startRadius: 0,
                    endRadius: 220
                )
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .strokeBorder(Color(.separator).opacity(0.5), lineWidth: 0.5)
        )
    }
}

// Wraps children into rows (no layout DSL required — simple HStack with wrapping fallback)
private struct FlowRow<Content: View>: View {
    let spacing: CGFloat
    @ViewBuilder let content: Content

    var body: some View {
        HStack(alignment: .center, spacing: spacing) {
            content
        }
        .fixedSize(horizontal: false, vertical: true)
    }
}

private struct MetaChip: View {
    let text: String
    init(_ text: String) { self.text = text }

    var body: some View {
        Text(text)
            .font(.system(.caption2, design: .monospaced))
            .foregroundStyle(.secondary)
    }
}

// MARK: - Active booking card

private struct ActiveBookingCard: View {
    let booking: AssetActiveBooking

    private var isReservation: Bool { booking.kind == "RESERVATION" }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 6) {
                Image(systemName: isReservation ? "calendar.badge.clock" : "arrow.right.circle.fill")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(isReservation ? .purple : .blue)
                Text(isReservation ? "Active Reservation" : "Checked Out")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                    .textCase(.uppercase)
                    .tracking(0.04)
            }

            NavigationLink(destination: BookingDetailView(bookingId: booking.id)) {
                HStack(spacing: 12) {
                    VStack(alignment: .leading, spacing: 3) {
                        Text(booking.title)
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(.primary)
                        Text(booking.requesterName)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        Label(
                            "Due \(booking.endsAt.formatted(date: .abbreviated, time: .shortened))",
                            systemImage: booking.isOverdue ? "exclamationmark.triangle.fill" : "clock"
                        )
                        .font(.caption2)
                        .foregroundStyle(booking.isOverdue ? AnyShapeStyle(.red) : AnyShapeStyle(.tertiary))
                        .labelStyle(.titleAndIcon)
                    }
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(.tertiary)
                }
                .padding(12)
                .background(Color(.tertiarySystemFill), in: RoundedRectangle(cornerRadius: 10))
            }
            .buttonStyle(.plain)
        }
        .padding(14)
        .background(Color(.secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .strokeBorder(Color(.separator).opacity(0.5), lineWidth: 0.5)
        )
    }
}

// MARK: - Upcoming reservations card

private struct UpcomingReservationsCard: View {
    let reservations: [UpcomingReservation]

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 6) {
                Image(systemName: "calendar")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.purple)
                Text("Upcoming")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                    .textCase(.uppercase)
                    .tracking(0.04)
            }

            VStack(spacing: 6) {
                ForEach(reservations) { res in
                    HStack(spacing: 10) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(res.title)
                                .font(.subheadline.weight(.medium))
                                .lineLimit(1)
                            HStack(spacing: 4) {
                                Text(res.requesterName)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                                Text("·")
                                    .font(.caption)
                                    .foregroundStyle(.tertiary)
                                Text(res.startsAt.formatted(date: .abbreviated, time: .shortened))
                                    .font(.system(.caption2, design: .monospaced))
                                    .foregroundStyle(.tertiary)
                            }
                        }
                        Spacer()
                        StatusBadge(status: res.status, kind: .reservation)
                    }
                    .padding(10)
                    .background(Color(.tertiarySystemFill), in: RoundedRectangle(cornerRadius: 10))
                }
            }
        }
        .padding(14)
        .background(Color(.secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .strokeBorder(Color(.separator).opacity(0.5), lineWidth: 0.5)
        )
    }
}

// MARK: - Notes card

private struct NotesCard: View {
    let notes: String

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                Image(systemName: "note.text")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                Text("Notes")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                    .textCase(.uppercase)
                    .tracking(0.04)
            }
            Text(notes)
                .font(.subheadline)
                .foregroundStyle(.primary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(Color(.secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .strokeBorder(Color(.separator).opacity(0.5), lineWidth: 0.5)
        )
    }
}
