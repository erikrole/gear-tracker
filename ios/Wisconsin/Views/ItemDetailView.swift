import SwiftUI

struct ItemDetailView: View {
    let assetId: String

    @State private var asset: AssetDetail?
    @State private var isLoading = true
    @State private var error: String?
    @State private var showEdit = false
    @State private var isFavorited = false
    @State private var favoriteToggleCount = 0  // user-action ticks; isolates haptic from initial load
    @State private var toast: Toast?
    @State private var reserveAsset: Asset?
    @State private var pushBooking: BookingRouteId?
    @Environment(SessionStore.self) private var session

    private var canEditAsset: Bool {
        let role = session.currentUser?.role ?? ""
        return role == "STAFF" || role == "ADMIN"
    }

    private func toggleFavorite() async {
        let previous = isFavorited
        isFavorited.toggle()
        favoriteToggleCount &+= 1  // Tick the haptic counter only on user action.
        do {
            isFavorited = try await APIClient.shared.toggleFavorite(assetId: assetId)
        } catch {
            isFavorited = previous
            toast = Toast(message: "Couldn't update favorite", icon: "exclamationmark.triangle.fill", role: .error)
        }
    }

    var body: some View {
        Group {
            if isLoading && asset == nil {
                ItemDetailSkeleton()
            } else if let error, asset == nil {
                ContentUnavailableView {
                    Label("Couldn't load item", systemImage: "exclamationmark.triangle")
                } description: {
                    Text(error)
                } actions: {
                    Button("Retry") { Task { await loadAsset() } }
                        .buttonStyle(.borderedProminent)
                }
            } else if let asset {
                ScrollView {
                    VStack(spacing: Brand.Space.sm) {
                        if let parent = asset.parentAsset {
                            ParentLinkCard(parent: parent)
                        }
                        ItemHeroCard(asset: asset, onCopyQR: copyQR)
                        if asset.computedStatus != .retired {
                            ReserveButton {
                                reserveAsset = asset.asAsset
                            }
                        }
                        ItemDetailsCard(asset: asset, canSeeProcurement: canEditAsset)
                        if let booking = asset.activeBooking {
                            ActiveBookingCard(booking: booking)
                        }
                        UpcomingReservationsCard(reservations: asset.upcomingReservations)
                        if let accessories = asset.accessories, !accessories.isEmpty {
                            AccessoriesCard(accessories: accessories)
                        }
                        if let notes = asset.notes, !notes.isEmpty {
                            NotesCard(notes: notes)
                        }
                    }
                    .padding(.horizontal, Brand.Space.md)
                    .padding(.vertical, Brand.Space.sm)
                }
                .background(Color(.systemGroupedBackground))
            }
        }
        .navigationTitle(asset?.assetTag ?? asset?.displayName ?? "Item")
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
                    .sensoryFeedback(.selection, trigger: favoriteToggleCount)
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
        .toast($toast)
        .task { await loadAsset() }
        .refreshable { await loadAsset() }
        .sheet(isPresented: $showEdit) {
            if let asset {
                EditAssetSheet(asset: asset) {
                    Task { await loadAsset() }
                }
            }
        }
        .sheet(item: $reserveAsset) { asset in
            CreateBookingSheet(vm: {
                let vm = CreateBookingViewModel()
                vm.prefillReservation(for: asset)
                return vm
            }()) { newId in
                reserveAsset = nil
                // Push onto the parent's NavigationStack via the
                // item-driven destination below (auto-pushes when set,
                // auto-clears on back).
                pushBooking = BookingRouteId(id: newId)
            }
        }
        .navigationDestination(item: $pushBooking) { route in
            BookingDetailView(bookingId: route.id)
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

    /// Copy the QR sticker code to the clipboard with a confirming toast +
    /// haptic. Replaces the silent-copy behavior the hero card had inline.
    private func copyQR(_ value: String) {
        UIPasteboard.general.string = value
        Haptics.tap()
        toast = Toast(
            message: "Copied \(value)",
            icon: "checkmark.circle.fill",
            role: .success
        )
    }
}

// MARK: - Reserve button

private struct ReserveButton: View {
    let action: () -> Void

    var body: some View {
        // Matches the scan hero sheet's primary action: solid black
        // prominent button, so "reserve" reads the same everywhere.
        Button(action: action) {
            Label("Reserve Equipment", systemImage: "calendar.badge.plus")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Color(.systemBackground))
                .frame(maxWidth: .infinity)
        }
        .buttonStyle(.borderedProminent)
        .controlSize(.large)
        .tint(Color(.label))
        .accessibilityLabel("Reserve Equipment")
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
                            .foregroundStyle(Color.statusText(.red))
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
                    Button {
                        Task { await save() }
                    } label: {
                        if isSaving {
                            ProgressView().controlSize(.small)
                        } else {
                            Text("Save").fontWeight(.semibold)
                        }
                    }
                    .disabled(!hasChanges || isSaving)
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
            Haptics.success()
            onSaved()
            dismiss()
        } catch {
            self.error = error.localizedDescription
            Haptics.warning()
        }
        isSaving = false
    }
}

// MARK: - Hero card

private struct ItemHeroCard: View {
    let asset: AssetDetail
    let onCopyQR: (String) -> Void
    @State private var showZoom = false

    // Primary identifier: assetTag if set, else brand+model
    private var heroTitle: String {
        asset.assetTag ?? asset.displayName
    }
    // Secondary: custom name, or brand+model when assetTag is the hero
    private var subtitle: String? {
        let candidate = asset.assetTag != nil
            ? (asset.name ?? asset.displayName)
            : asset.name
        guard let s = candidate, !s.isEmpty else { return nil }
        return s
    }

    var body: some View {
        VStack(spacing: 0) {
            banner
            infoBlock
        }
        .background(Color.cardSurface)
        .clipShape(RoundedRectangle(cornerRadius: Brand.Radius.card, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Brand.Radius.card, style: .continuous)
                .strokeBorder(Color.hairline, lineWidth: 0.5)
        )
        .shadow(color: Color.black.opacity(0.07), radius: 12, x: 0, y: 5)
        .fullScreenCover(isPresented: $showZoom) {
            if let urlString = asset.imageUrl, let url = URL(string: urlString) {
                ZoomableImageViewer(url: url)
            }
        }
    }

    // MARK: Banner

    private var banner: some View {
        ZStack(alignment: .topTrailing) {
            Button {
                if asset.imageUrl != nil { showZoom = true }
            } label: {
                // Full white when a photo exists: inventory shots are catalog
                // images on white, so the frame disappears into the image instead
                // of letterboxing it. Placeholders keep the brand-tinted gradient.
                Group {
                    if asset.imageUrl != nil {
                        Color.white
                    } else {
                        Color.clear
                    }
                }
                .overlay { bannerImage }
                .frame(maxWidth: .infinity)
                .frame(height: 200)
                .clipped()
            }
            .buttonStyle(.plain)
            .disabled(asset.imageUrl == nil)
            .accessibilityLabel(asset.imageUrl == nil ? "Item image placeholder" : "Open item photo")

            // The badge carries its own tinted capsule; on the white hero
            // that's contrast enough, so no extra material wrapper — just a
            // soft shadow to lift it off the image.
            AssetStatusBadge(status: asset.computedStatus)
                .shadow(color: .black.opacity(0.12), radius: 4, y: 1)
                .padding(12)
        }
    }

    @ViewBuilder
    private var bannerImage: some View {
        if let urlString = asset.imageUrl, let url = URL(string: urlString) {
            AsyncImage(url: url) { phase in
                switch phase {
                case .success(let image):
                    // Fit, not fill: catalog product shots get cropped by fill.
                    image.resizable().scaledToFit().padding(16)
                case .empty:
                    ZStack { bannerPlaceholder; ProgressView() }
                default:
                    bannerPlaceholder
                }
            }
        } else {
            bannerPlaceholder
        }
    }

    private var bannerPlaceholder: some View {
        ZStack {
            LinearGradient(
                colors: [Color.brandPrimary.opacity(0.20), Color.brandPrimary.opacity(0.04)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            Image(systemName: "shippingbox.fill")
                .font(.system(size: 52))
                .foregroundStyle(Color.brandPrimary.opacity(0.35))
        }
        .accessibilityHidden(true)
    }

    // MARK: Info

    private var infoBlock: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(heroTitle)
                .font(.gothamBlack(size: 26))
                .tracking(-0.3)
                .lineLimit(2)

            if let sub = subtitle {
                Text(sub)
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }

            // "Can I grab this right now?" — one-line availability answer.
            if let snapshot = availabilitySnapshot(for: asset) {
                Text(snapshot)
                    .font(.caption.weight(.medium))
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
                    .padding(.top, 2)
            }

            // QR sticker code — tap copies the value for the kiosk / relink form.
            if let qr = asset.qrCodeValue, !qr.isEmpty {
                Button {
                    onCopyQR(qr)
                } label: {
                    HStack(spacing: 5) {
                        Image(systemName: "qrcode")
                            .font(.caption2.weight(.semibold))
                        Text(qr)
                            .font(.system(.caption2, design: .monospaced))
                        Image(systemName: "doc.on.doc")
                            .font(.caption2)
                            .foregroundStyle(.tertiary)
                    }
                    .foregroundStyle(.secondary)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(Color(.tertiarySystemFill), in: Capsule())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("QR code \(qr), tap to copy")
                .padding(.top, 2)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
    }
}

// MARK: - Details card

private struct ItemDetailsCard: View {
    let asset: AssetDetail
    /// Web gates purchase date / fiscal year / price / product link to non-
    /// students under the "Procurement" section. iOS mirrors that gate via
    /// canEditAsset, which is already STAFF+ADMIN-only.
    let canSeeProcurement: Bool

    private struct Row {
        let label: String
        let value: String
        var mono: Bool = false
        var link: URL? = nil
    }

    private var rows: [Row] {
        var result: [Row] = []
        result.append(Row(label: "Location", value: asset.location.name))
        if let cat = asset.category { result.append(Row(label: "Category", value: cat.name)) }
        if let dept = asset.department { result.append(Row(label: "Department", value: dept.name)) }
        if let serial = asset.serialNumber { result.append(Row(label: "Serial", value: serial, mono: true)) }
        if let uwTag = asset.metadata?.uwAssetTag, !uwTag.isEmpty {
            result.append(Row(label: "UW Asset Tag", value: uwTag, mono: true))
        }
        if canSeeProcurement {
            if let raw = asset.purchaseDate,
               let date = ISO8601DateFormatter().date(from: raw) {
                result.append(Row(label: "Purchased", value: date.formatted(date: .abbreviated, time: .omitted)))
            }
            if let price = asset.purchasePrice.flatMap(Double.init) {
                let formatted = price.formatted(.currency(code: Locale.current.currency?.identifier ?? "USD"))
                result.append(Row(label: "Purchase Price", value: formatted))
            }
            if let raw = asset.linkUrl, !raw.isEmpty, let url = URL(string: raw) {
                result.append(Row(label: "Link", value: url.host ?? raw, link: url))
            }
        }
        return result
    }

    var body: some View {
        VStack(spacing: 0) {
            ForEach(Array(rows.enumerated()), id: \.offset) { index, row in
                VStack(spacing: 0) {
                    if index > 0 {
                        Divider().padding(.leading, 14)
                    }
                    rowContent(row)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 11)
                }
            }
        }
        .background(Color.cardSurface)
        .clipShape(RoundedRectangle(cornerRadius: Brand.Radius.card, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Brand.Radius.card, style: .continuous)
                .strokeBorder(Color.hairline, lineWidth: 0.5)
        )
        .shadow(color: Color.black.opacity(0.05), radius: 10, x: 0, y: 4)
    }

    @ViewBuilder
    private func rowContent(_ row: Row) -> some View {
        if let url = row.link {
            Link(destination: url) {
                HStack {
                    Text(row.label)
                        .font(.subheadline)
                        // Explicit label color: inside a tinted Link, the
                        // hierarchical `.primary` style adopts the accent
                        // (brand red) instead of the neutral label color.
                        .foregroundStyle(Color(.label))
                    Spacer()
                    Text(row.value)
                        .font(.subheadline)
                        .foregroundStyle(Color.statusText(.blue))
                        .lineLimit(1)
                    Image(systemName: "arrow.up.right.square")
                        .font(.caption2)
                        .foregroundStyle(Color.statusText(.blue))
                }
            }
            .accessibilityLabel("\(row.label) — opens in browser")
        } else {
            HStack {
                Text(row.label)
                    .font(.subheadline)
                    .foregroundStyle(.primary)
                Spacer()
                Text(row.value)
                    .font(row.mono ? .system(.subheadline, design: .monospaced) : .subheadline)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
        }
    }
}

/// Builds the one-line "can I grab this?" snapshot shown on the hero card.
/// Matches the vocabulary the item list already uses, with a relative time
/// hint pulled from `Date.countdownLabel`.
private func availabilitySnapshot(for asset: AssetDetail) -> String? {
    if let booking = asset.activeBooking {
        let countdown = Date.countdownLabel(for: booking.endsAt)
        return "\(booking.requesterName) · \(countdown.lowercased())"
    }
    switch asset.computedStatus {
    case .available:
        if let next = asset.upcomingReservations.first {
            let when = next.startsAt.formatted(date: .abbreviated, time: .shortened)
            return "Available · next reserved \(when)"
        }
        // Bare "Available" is redundant with the corner status badge; the
        // snapshot only earns its line when it adds custody/timing info.
        return nil
    case .maintenance: return "Out for maintenance"
    case .retired:     return "Retired from service"
    case .unknown, .checkedOut, .pendingPickup, .reserved:
        return nil
    }
}

// MARK: - Active booking card

private struct ActiveBookingCard: View {
    let booking: AssetActiveBooking

    private var isReservation: Bool { booking.kind == "RESERVATION" }
    private var isPendingPickup: Bool { booking.kind == "CHECKOUT" && booking.status == "PENDING_PICKUP" }

    var body: some View {
        let headerTone: StatusTone = isReservation ? .purple : isPendingPickup ? .orange : .blue
        let title = isReservation ? "Active Reservation" : isPendingPickup ? "Awaiting Pickup" : "Checked Out"
        return VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 6) {
                Image(systemName: isReservation ? "calendar.badge.clock" : isPendingPickup ? "tray.and.arrow.down.fill" : "arrow.right.circle.fill")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Color.statusText(headerTone))
                Text(title)
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
                        .foregroundStyle(booking.isOverdue ? AnyShapeStyle(Color.statusText(.red)) : AnyShapeStyle(.tertiary))
                        .accessibilityLabel(booking.isOverdue
                            ? "Overdue. Due \(booking.endsAt.formatted(date: .abbreviated, time: .shortened))"
                            : "Due \(booking.endsAt.formatted(date: .abbreviated, time: .shortened))")
                    }
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(.tertiary)
                        .accessibilityHidden(true)
                }
                .padding(12)
                .background(Color(.tertiarySystemFill), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
            }
            .buttonStyle(.plain)
            .accessibilityElement(children: .combine)
            .accessibilityLabel("\(title): \(booking.title), \(booking.requesterName)")
        }
        .brandCard()
    }
}

// MARK: - Upcoming reservations card

private struct UpcomingReservationsCard: View {
    let reservations: [UpcomingReservation]

    var body: some View {
        // Empty is the common case; collapse to a single quiet line instead
        // of a full header-plus-body card that eats vertical space.
        if reservations.isEmpty {
            HStack(spacing: 8) {
                Image(systemName: "calendar")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.tertiary)
                Text("No upcoming reservations")
                    .font(.subheadline)
                    .foregroundStyle(.tertiary)
                Spacer(minLength: 0)
            }
            .brandCard(padding: Brand.Space.sm)
            .accessibilityElement(children: .combine)
        } else {
            populated
        }
    }

    private var populated: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 6) {
                Image(systemName: "calendar")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Color.statusText(.purple))
                Text("Upcoming Reservations")
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
                                    Text(res.startsAt.relativeLabel)
                                        .font(.system(.caption2, design: .monospaced))
                                        .foregroundStyle(.tertiary)
                                }
                            }
                            Spacer()
                            StatusBadge(status: res.status, kind: .reservation)
                        }
                        .padding(10)
                        .background(Color(.tertiarySystemFill), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                        .accessibilityElement(children: .combine)
                        .accessibilityLabel("Upcoming reservation: \(res.title), \(res.requesterName), starts \(res.startsAt.relativeLabel)")
                    }
                }
        }
        .brandCard()
    }
}

// MARK: - Parent link card

/// Shown above the hero when this asset is itself an accessory — a tap leads
/// back to the parent gear so floor users can answer "what does this cable
/// belong to?" in one tap.
private struct ParentLinkCard: View {
    let parent: AssetParentLink

    var body: some View {
        NavigationLink(destination: ItemDetailView(assetId: parent.id)) {
            HStack(spacing: 10) {
                Image(systemName: "link")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Part of")
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(.secondary)
                        .textCase(.uppercase)
                        .tracking(0.04)
                    HStack(spacing: 6) {
                        Text(parent.assetTag)
                            .font(.system(.subheadline, design: .monospaced).weight(.medium))
                        Text(parent.name ?? parent.displayName)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(.tertiary)
                    .accessibilityHidden(true)
            }
            .padding(12)
            .background(Color(.secondarySystemGroupedBackground))
            .clipShape(RoundedRectangle(cornerRadius: Brand.Radius.md, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Brand.Radius.md, style: .continuous)
                    .strokeBorder(Color.hairline, lineWidth: 0.5)
            )
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Part of \(parent.assetTag), \(parent.name ?? parent.displayName)")
    }
}

// MARK: - Accessories card

/// Renders child accessories on this asset's detail — answers "what comes
/// with this kit?" on the floor. Each row is tappable and pushes the child's
/// detail view, so users can drill into a specific cable or battery without
/// going back to the items list.
private struct AccessoriesCard: View {
    let accessories: [AssetAccessory]

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 6) {
                Image(systemName: "shippingbox")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                Text("Accessories")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                    .textCase(.uppercase)
                    .tracking(0.04)
                Spacer()
                Text("\(accessories.count)")
                    .font(.caption.monospacedDigit())
                    .foregroundStyle(.tertiary)
            }

            VStack(spacing: 6) {
                ForEach(accessories) { acc in
                    NavigationLink(destination: ItemDetailView(assetId: acc.id)) {
                        HStack(spacing: 10) {
                            AssetThumbnail(imageUrl: acc.imageUrl, size: 36)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(acc.assetTag)
                                    .font(.system(.subheadline, design: .monospaced).weight(.medium))
                                    .foregroundStyle(.primary)
                                Text(acc.name ?? acc.displayName)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                                    .lineLimit(1)
                            }
                            Spacer()
                            Image(systemName: "chevron.right")
                                .font(.caption2.weight(.semibold))
                                .foregroundStyle(.tertiary)
                                .accessibilityHidden(true)
                        }
                        .padding(10)
                        .background(Color(.tertiarySystemFill), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                    }
                    .buttonStyle(.plain)
                    .accessibilityElement(children: .combine)
                    .accessibilityLabel("Accessory: \(acc.assetTag), \(acc.name ?? acc.displayName)")
                }
            }
        }
        .brandCard()
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
        .brandCard()
    }
}

// MARK: - Date helpers

private extension Date {
    /// "Today", "Tomorrow", "in N days" for near dates; abbreviated date beyond 7 days.
    var relativeLabel: String {
        let days = Calendar.current.dateComponents([.day], from: .now, to: self).day ?? 0
        switch days {
        case 0: return "Today"
        case 1: return "Tomorrow"
        case 2...7: return "in \(days) days"
        default: return formatted(date: .abbreviated, time: .omitted)
        }
    }
}
