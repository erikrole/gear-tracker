import SwiftUI

struct BookingDetailView: View {
    let bookingId: String

    @State private var booking: Booking?
    @State private var conflicts: [String: AssetConflict] = [:]
    @State private var isLoading = true
    @State private var error: String?
    @State private var showCancelConfirm = false
    @State private var showExtend = false
    @State private var showEdit = false
    @State private var isActioning = false
    @Environment(SessionStore.self) private var session

    private var canEditBooking: Bool {
        guard let booking, let user = session.currentUser else { return false }
        let role = user.role
        if role == "STAFF" || role == "ADMIN" { return true }
        // Students can edit their own bookings while still mutable.
        return booking.requester.id == user.id
            && (booking.status == .draft || booking.status == .booked)
    }

    /// Wider gate than `canEditBooking` — Extend is a legitimate self-help
    /// action even after a booking transitions to OPEN ("I need it longer
    /// mid-shoot"). Hides the action panel from non-owners viewing through
    /// deep nav (Items tab → "out to {Person}" → that booking detail) where
    /// advertising "Cancel Booking" on someone else's gear is alarming even
    /// when the server would reject the request.
    private var canActOnBooking: Bool {
        guard let booking, let user = session.currentUser else { return false }
        let role = user.role
        if role == "STAFF" || role == "ADMIN" { return true }
        return booking.requester.id == user.id
    }

    var body: some View {
        Group {
            if isLoading && booking == nil {
                BookingDetailSkeleton()
            } else if let error, booking == nil {
                ContentUnavailableView {
                    Label("Couldn't load booking", systemImage: "exclamationmark.triangle")
                } description: {
                    Text(error)
                } actions: {
                    Button("Retry") { Task { await loadBooking() } }
                        .buttonStyle(.borderedProminent)
                }
            } else if let booking {
                ScrollView {
                    VStack(spacing: 16) {
                        FormCard { HeaderSection(booking: booking) }
                        FormCard { RequesterSection(booking: booking) }
                        if !booking.serializedItems.isEmpty {
                            FormCard { ItemsSection(items: booking.serializedItems, conflicts: conflicts) }
                        }
                        if !booking.bulkItems.isEmpty {
                            FormCard { BulkSection(items: booking.bulkItems) }
                        }
                        if let notes = booking.notes, !notes.isEmpty {
                            FormCard { NotesSection(notes: notes) }
                        }
                        if canActOnBooking,
                           booking.status == .booked || booking.status == .pendingPickup || booking.status == .open {
                            ActionsSection(
                                booking: booking,
                                isActioning: isActioning,
                                onExtend: { showExtend = true },
                                onCancel: { showCancelConfirm = true }
                            )
                        }
                        if let errorMsg = error {
                            Text(errorMsg)
                                .font(.footnote)
                                .foregroundStyle(Color.statusText(.red))
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                    }
                    .padding()
                }
                .background(Color(.systemGroupedBackground))
            }
        }
        .navigationTitle(booking?.title ?? "Booking")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if canEditBooking {
                ToolbarItem(placement: .topBarTrailing) {
                    Button { showEdit = true } label: {
                        Image(systemName: "pencil")
                    }
                    .accessibilityLabel("Edit Booking")
                }
            }
        }
        .task { await loadBooking() }
        .refreshable { await loadBooking() }
        .sheet(isPresented: $showExtend) {
            if let booking {
                ExtendBookingSheet(bookingId: booking.id, currentEndsAt: booking.endsAt) {
                    Task { await loadBooking() }
                }
            }
        }
        .sheet(isPresented: $showEdit) {
            if let booking {
                EditBookingSheet(booking: booking) {
                    Task { await loadBooking() }
                }
            }
        }
        .confirmationDialog("Cancel Booking", isPresented: $showCancelConfirm, titleVisibility: .visible) {
            Button("Cancel Booking", role: .destructive) {
                Task { await cancelBooking() }
            }
            Button("Keep Booking", role: .cancel) {}
        } message: {
            Text("This cannot be undone.")
        }
    }

    private func loadBooking() async {
        isLoading = true
        error = nil
        do {
            let loaded = try await APIClient.shared.booking(id: bookingId)
            booking = loaded
            isLoading = false
            await loadConflicts(for: loaded)
        } catch {
            self.error = error.localizedDescription
            isLoading = false
        }
    }

    /// Non-blocking preflight: surface per-item scheduling conflicts on active
    /// bookings, mirroring the web Equipment tab. Server enforcement at
    /// create/checkout remains authoritative; this is an at-a-glance hint.
    private func loadConflicts(for booking: Booking) async {
        let activeStatuses: Set<BookingStatus> = [.draft, .booked, .pendingPickup, .open]
        guard activeStatuses.contains(booking.status), !booking.serializedItems.isEmpty else {
            conflicts = [:]
            return
        }
        conflicts = await APIClient.shared.checkAvailability(
            locationId: booking.location.id,
            serializedAssetIds: booking.serializedItems.map(\.assetId),
            startsAt: booking.startsAt,
            endsAt: booking.endsAt,
            excludeBookingId: booking.id
        )
    }

    private func cancelBooking() async {
        isActioning = true
        do {
            try await APIClient.shared.cancelBooking(id: bookingId)
            await loadBooking()
            Haptics.success()
        } catch {
            self.error = error.localizedDescription
            Haptics.warning()
        }
        isActioning = false
    }

}

// MARK: - Edit Sheet

struct EditBookingSheet: View {
    let booking: Booking
    let onSaved: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var title: String
    @State private var notes: String
    @State private var startsAt: Date
    @State private var endsAt: Date
    @State private var isSaving = false
    @State private var error: String?
    @State private var showDiscardConfirm = false

    init(booking: Booking, onSaved: @escaping () -> Void) {
        self.booking = booking
        self.onSaved = onSaved
        _title = State(wrappedValue: booking.title)
        _notes = State(wrappedValue: booking.notes ?? "")
        _startsAt = State(wrappedValue: booking.startsAt)
        _endsAt = State(wrappedValue: booking.endsAt)
    }

    private var hasChanges: Bool {
        title != booking.title
            || notes != (booking.notes ?? "")
            || startsAt != booking.startsAt
            || endsAt != booking.endsAt
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 12) {
                    FormCard {
                        TextField("Title", text: $title)
                            .font(.body)
                    }
                    FormCard {
                        DatePicker("From", selection: $startsAt, displayedComponents: [.date, .hourAndMinute])
                        Divider().padding(.leading, 4)
                        DatePicker("To", selection: $endsAt, in: startsAt..., displayedComponents: [.date, .hourAndMinute])
                    }
                    FormCard {
                        TextField("Notes…", text: $notes, axis: .vertical)
                            .lineLimit(3...6)
                    }
                    if let error {
                        Text(error).foregroundStyle(Color.statusText(.red)).font(.footnote)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.horizontal, 4)
                    }
                }
                .padding(20)
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("Edit Booking")
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
                    .disabled(!hasChanges || title.trimmingCharacters(in: .whitespaces).isEmpty || isSaving)
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
            try await APIClient.shared.updateBooking(
                id: booking.id,
                title: title != booking.title ? title.trimmingCharacters(in: .whitespaces) : nil,
                notes: notes != (booking.notes ?? "") ? (notes.isEmpty ? nil : notes) : nil,
                startsAt: startsAt != booking.startsAt ? startsAt : nil,
                endsAt: endsAt != booking.endsAt ? endsAt : nil
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

// MARK: - Sub-sections

private struct HeaderSection: View {
    let booking: Booking

    private var isOverdue: Bool {
        booking.status == .open && booking.endsAt < .now
    }

    /// Web parity: a live "DUE BACK IN …" / "OVERDUE BY …" badge for active
    /// checkouts. Reads the same vocabulary `formatCountdown` returns on web.
    private var showsCountdown: Bool {
        booking.status == .open
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                StatusBadge(status: booking.status, kind: booking.kind)
                Spacer()
                if let ref = booking.refNumber {
                    Text(ref)
                        .font(.system(.caption, design: .monospaced))
                        .foregroundStyle(.secondary)
                }
            }
            if showsCountdown {
                // 30s tick: minute-precision label means at most 30s of staleness
                // without the cost of per-second redraws.
                TimelineView(.periodic(from: .now, by: 30)) { context in
                    let urgency = Date.bookingUrgency(
                        startsAt: booking.startsAt,
                        endsAt: booking.endsAt,
                        now: context.date
                    )
                    StatusPill(
                        label: Date.countdownLabel(for: booking.endsAt, now: context.date),
                        tone: urgency.tone,
                        emphasized: true
                    )
                }
            }
            if isOverdue {
                Label("Overdue — return gear at a kiosk", systemImage: "exclamationmark.triangle.fill")
                    .font(.caption.weight(.medium))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color.statusText(.red), in: RoundedRectangle(cornerRadius: 8))
                    .accessibilityLabel("Overdue. Return gear at a kiosk.")
            }
            if let event = booking.event, let summary = event.summary {
                Text(summary)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
            Label(booking.location.name, systemImage: "mappin.circle")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .accessibilityLabel("Location: \(booking.location.name)")
            Label {
                VStack(alignment: .leading) {
                    Text(booking.startsAt.formatted(date: .complete, time: .shortened))
                    Text("to \(booking.endsAt.formatted(date: .abbreviated, time: .shortened))")
                        .foregroundStyle(isOverdue ? Color.statusText(.red) : Color.secondary)
                }
            } icon: {
                Image(systemName: "calendar")
            }
            .font(.subheadline)
            .accessibilityLabel("From \(booking.startsAt.formatted(date: .complete, time: .shortened)) to \(booking.endsAt.formatted(date: .abbreviated, time: .shortened))")
        }
    }
}

private struct RequesterSection: View {
    let booking: Booking

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("Requester")
                .font(.caption)
                .foregroundStyle(.secondary)
                .textCase(.uppercase)
            Text(booking.requester.name)
                .font(.body)
            Text(booking.requester.email)
                .font(.system(.footnote, design: .monospaced))
                .foregroundStyle(.secondary)
        }
    }
}

/// Maps an allocation status to (label, tone) using the same vocabulary the
/// web uses in `src/lib/status-styles.ts` — checked-out gear = blue,
/// returned = gray, pending/draft = orange.
private func allocationLabel(_ status: String) -> (label: String, tone: StatusTone) {
    switch status.lowercased() {
    case "active": return ("Out", .blue)
    case "returned": return ("Returned", .gray)
    case "draft": return ("Pending", .orange)
    default: return (status.capitalized, .gray)
    }
}

private struct ItemsSection: View {
    let items: [BookingSerializedItem]
    let conflicts: [String: AssetConflict]

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            SectionHeader(title: "Equipment", count: items.count)
            ForEach(items) { item in
                let conflict = conflicts[item.assetId]
                HStack(spacing: 10) {
                    AssetThumbnail(imageUrl: item.asset.imageUrl, size: 40)
                    VStack(alignment: .leading, spacing: 2) {
                        Text([item.asset.brand, item.asset.model].compactMap { $0 }.joined(separator: " "))
                            .font(.subheadline)
                        if let tag = item.asset.assetTag {
                            Text(tag)
                                .font(.system(.caption, design: .monospaced))
                                .foregroundStyle(.secondary)
                        }
                        if let conflict {
                            Text(conflict.conflictingBookingTitle.map { "Conflicts with \($0)" } ?? "Scheduling conflict")
                                .font(.caption2)
                                .foregroundStyle(Color.statusText(.red))
                                .lineLimit(2)
                        }
                    }
                    Spacer()
                    if conflict != nil {
                        StatusPill(label: "Conflict", tone: .red, emphasized: true)
                    }
                    if let status = item.allocationStatus {
                        let allocation = allocationLabel(status)
                        StatusPill(label: allocation.label, tone: allocation.tone)
                    }
                }
                .accessibilityElement(children: .combine)
                .accessibilityLabel(rowAccessibilityLabel(item: item, conflict: conflict))
            }
        }
    }

    private func rowAccessibilityLabel(item: BookingSerializedItem, conflict: AssetConflict?) -> String {
        var parts: [String] = []
        if conflict != nil { parts.append("Conflict") }
        let name = [item.asset.brand, item.asset.model].compactMap { $0 }.joined(separator: " ")
        if !name.isEmpty { parts.append(name) }
        if let tag = item.asset.assetTag { parts.append(tag) }
        if let status = item.allocationStatus { parts.append(allocationLabel(status).label) }
        if let conflict {
            parts.append(conflict.conflictingBookingTitle.map { "conflicts with \($0)" } ?? "scheduling conflict")
        }
        return parts.joined(separator: ", ")
    }
}

private struct BulkSection: View {
    let items: [BookingBulkItem]

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            SectionHeader(title: "Consumables", count: items.count)
            ForEach(items) { item in
                HStack(spacing: 10) {
                    BulkThumbnail(imageUrl: item.bulkSku.imageUrl, size: 40)
                    Text(item.bulkSku.name)
                        .font(.subheadline)
                    Spacer()
                    Text("×\(item.plannedQuantity)")
                        .font(.subheadline.monospacedDigit())
                        .foregroundStyle(.secondary)
                }
            }
        }
    }
}

/// Bulk SKU thumbnail with a neutral placeholder when no image is set —
/// mirrors web's `bulkSku.imageUrl ? <ItemThumbnail/> : <ImageIcon/>` pattern.
private struct BulkThumbnail: View {
    let imageUrl: String?
    let size: CGFloat

    var body: some View {
        if let urlString = imageUrl, let url = URL(string: urlString) {
            AsyncImage(url: url) { phase in
                switch phase {
                case .success(let image):
                    image.resizable().scaledToFill()
                default:
                    placeholder
                }
            }
            .frame(width: size, height: size)
            .clipShape(RoundedRectangle(cornerRadius: 6))
            .overlay(
                RoundedRectangle(cornerRadius: 6)
                    .stroke(Color(.separator), lineWidth: 0.5)
            )
        } else {
            placeholder
                .frame(width: size, height: size)
                .background(Color(.tertiarySystemFill), in: RoundedRectangle(cornerRadius: 6))
        }
    }

    private var placeholder: some View {
        Image(systemName: "shippingbox")
            .font(.system(size: 16))
            .foregroundStyle(.tertiary)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
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

private struct ActionsSection: View {
    let booking: Booking
    let isActioning: Bool
    let onExtend: () -> Void
    let onCancel: () -> Void

    var body: some View {
        VStack(spacing: 10) {
            Button {
                onExtend()
            } label: {
                Label("Extend Return Date", systemImage: "clock.arrow.circlepath")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.glass)
            .controlSize(.large)
            .tint(Color.statusText(.blue))
            .disabled(isActioning)
            .accessibilityLabel("Extend Return Date")

            if booking.status == .pendingPickup {
                Label("Pick up gear at a kiosk", systemImage: "barcode.viewfinder")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity)
                    .padding(.top, 2)
                    .accessibilityLabel("Pick up gear at a kiosk")
            } else if booking.status == .open {
                Label("Return gear at a kiosk", systemImage: "barcode.viewfinder")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity)
                    .padding(.top, 2)
                    .accessibilityLabel("Return gear at a kiosk")
            } else {
                Button(role: .destructive) {
                    onCancel()
                } label: {
                    Group {
                        if isActioning {
                            ProgressView()
                        } else {
                            Label("Cancel Booking", systemImage: "xmark.circle")
                        }
                    }
                    .frame(maxWidth: .infinity)
                }
                .buttonStyle(.glass)
                .controlSize(.large)
                .tint(Color.statusText(.red))
                .disabled(isActioning)
                .accessibilityLabel(isActioning ? "Cancelling booking" : "Cancel Booking")
            }
        }
    }
}

private struct SectionHeader: View {
    let title: String
    let count: Int

    var body: some View {
        HStack {
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
                .textCase(.uppercase)
            Spacer()
            Text("\(count)")
                .font(.caption)
                .foregroundStyle(.tertiary)
        }
    }
}

// MARK: - Shared

struct ScalePressStyle: ButtonStyle {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed && !reduceMotion ? 0.96 : 1)
            .animation(reduceMotion ? nil : .easeInOut(duration: 0.15), value: configuration.isPressed)
    }
}
