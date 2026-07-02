import SwiftUI

struct BookingDetailView: View {
    let bookingId: String

    @State private var booking: Booking?
    @State private var conflicts: [String: AssetConflict] = [:]
    @State private var returnInsight = CheckoutReturnInsight(nextNeedAt: nil, hasUpcomingNeed: false)
    @State private var isLoading = true
    @State private var error: String?
    @State private var showCancelConfirm = false
    @State private var showExtend = false
    @State private var showEdit = false
    @State private var isActioning = false
    @Environment(SessionStore.self) private var session
    @Environment(AppState.self) private var appState

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
                        FormCard {
                            BookingDetailsSection(
                                booking: booking,
                                canEdit: canEditBooking,
                                onEdit: { showEdit = true }
                            )
                        }
                        if !booking.serializedItems.isEmpty || !booking.bulkItems.isEmpty {
                            FormCard {
                                EquipmentSection(
                                    serializedItems: booking.serializedItems,
                                    bulkItems: booking.bulkItems,
                                    conflicts: conflicts,
                                    bookingKind: booking.kind,
                                    bookingStatus: booking.status
                                )
                            }
                        }
                        if canActOnBooking && !canEditBooking {
                            FormCard { BookingEditLockedNotice(booking: booking) }
                        }
                        if canActOnBooking,
                           booking.status == .booked || booking.status == .pendingPickup || booking.status == .open {
                            ActionsSection(
                                booking: booking,
                                returnInsight: returnInsight,
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
                        Label("Edit Details", systemImage: "pencil")
                            .frame(minHeight: 44)
                    }
                    .accessibilityLabel("Edit booking details")
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
            await loadReturnInsight(for: loaded)
            await reconcileLiveActivity(afterLoading: loaded)
            openPendingExtendIfAllowed(for: loaded)
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

    private func loadReturnInsight(for booking: Booking) async {
        guard booking.kind == .checkout, booking.status == .open else {
            returnInsight = CheckoutReturnInsight(nextNeedAt: nil, hasUpcomingNeed: false)
            return
        }
        returnInsight = await APIClient.shared.checkoutReturnInsight(for: booking)
    }

    private func reconcileLiveActivity(afterLoading booking: Booking) async {
        if booking.kind == .checkout, booking.status != .open {
            await CheckoutReturnLiveActivityManager.shared.endAll()
        } else {
            await CheckoutReturnLiveActivityManager.shared.reconcileCurrentUserCheckouts(
                requesterId: session.currentUser?.id
            )
        }
    }

    private func openPendingExtendIfAllowed(for booking: Booking) {
        guard appState.pendingExtendBookingId == booking.id else { return }
        appState.pendingExtendBookingId = nil
        guard canActOnBooking, booking.status == .open, !returnInsight.hasUpcomingNeed else { return }
        showExtend = true
    }

    private func cancelBooking() async {
        if isActioning { return }
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
    @State private var locationId: String
    @State private var startsAt: Date
    @State private var endsAt: Date
    @State private var formOptions: FormOptions?
    @State private var isLoadingOptions = false
    @State private var isSaving = false
    @State private var error: String?
    @State private var optionsError: String?
    @State private var showDiscardConfirm = false

    init(booking: Booking, onSaved: @escaping () -> Void) {
        self.booking = booking
        self.onSaved = onSaved
        _title = State(wrappedValue: booking.title)
        _notes = State(wrappedValue: booking.notes ?? "")
        _locationId = State(wrappedValue: booking.location.id)
        _startsAt = State(wrappedValue: booking.startsAt)
        _endsAt = State(wrappedValue: booking.endsAt)
    }

    private var canEditLocation: Bool {
        booking.kind == .reservation
    }

    private var locationOptions: [(id: String, name: String)] {
        formOptions?.locations.map { ($0.id, $0.name) } ?? []
    }

    private var selectedLocationName: String {
        formOptions?.locations.first(where: { $0.id == locationId })?.name ?? booking.location.name
    }

    private var hasChanges: Bool {
        title != booking.title
            || notes != (booking.notes ?? "")
            || (canEditLocation && locationId != booking.location.id)
            || startsAt != booking.startsAt
            || endsAt != booking.endsAt
    }

    private var canSave: Bool {
        hasChanges
            && !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && endsAt > startsAt
            && (!canEditLocation || !locationId.isEmpty)
            && !isSaving
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 12) {
                    FormCard {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Title")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                                .textCase(.uppercase)
                            TextField("Booking title", text: $title)
                                .font(.body)
                                .textInputAutocapitalization(.words)
                                .accessibilityLabel("Booking title")
                        }
                    }

                    FormCard {
                        VStack(alignment: .leading, spacing: 10) {
                            Text("Pickup and return")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                                .textCase(.uppercase)
                            DatePicker("From", selection: $startsAt, displayedComponents: [.date, .hourAndMinute])
                            Divider().padding(.leading, 4)
                            DatePicker("To", selection: $endsAt, in: startsAt..., displayedComponents: [.date, .hourAndMinute])
                            if endsAt <= startsAt {
                                Text("Return must be after pickup.")
                                    .font(.caption)
                                    .foregroundStyle(Color.statusText(.red))
                            }
                        }
                    }

                    FormCard {
                        VStack(alignment: .leading, spacing: 10) {
                            Text("Pickup location")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                                .textCase(.uppercase)
                            if canEditLocation {
                                NavigationLink {
                                    OptionPickerView(
                                        title: "Pickup Location",
                                        options: locationOptions,
                                        selection: $locationId
                                    )
                                } label: {
                                    EditDetailPickerRow(
                                        title: selectedLocationName,
                                        subtitle: isLoadingOptions ? "Loading locations..." : "Reservation pickup location",
                                        systemImage: "mappin.circle"
                                    )
                                }
                                .disabled(isSaving || isLoadingOptions || locationOptions.isEmpty)
                                if let optionsError {
                                    VStack(alignment: .leading, spacing: 6) {
                                        Text(optionsError)
                                            .font(.caption)
                                            .foregroundStyle(Color.statusText(.red))
                                        Button("Retry Locations") {
                                            Task { await loadFormOptions(force: true) }
                                        }
                                        .font(.caption.weight(.semibold))
                                    }
                                }
                            } else {
                                EditDetailPickerRow(
                                    title: booking.location.name,
                                    subtitle: "Location changes are reservation-only in this editor",
                                    systemImage: "mappin.circle"
                                )
                                .accessibilityLabel("Pickup location, \(booking.location.name). Location changes are reservation-only in this editor.")
                            }
                        }
                    }

                    FormCard {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Notes")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                                .textCase(.uppercase)
                            ZStack(alignment: .topLeading) {
                                if notes.isEmpty {
                                    Text("Add booking notes")
                                        .foregroundStyle(.tertiary)
                                        .padding(.top, 8)
                                        .padding(.leading, 5)
                                        .allowsHitTesting(false)
                                }
                                TextEditor(text: $notes)
                                    .frame(minHeight: 120)
                                    .scrollContentBackground(.hidden)
                                    .accessibilityLabel("Booking notes")
                            }
                        }
                    }

                    Text("Equipment changes, pickup, and return stay in kiosk workflows. This sheet edits booking details only.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, 4)

                    if let error {
                        Text(error).foregroundStyle(Color.statusText(.red)).font(.footnote)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.horizontal, 4)
                    }
                }
                .padding(20)
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("Edit Details")
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
                    .disabled(!canSave)
                    .accessibilityLabel(isSaving ? "Saving booking details" : "Save booking details")
                }
            }
            .task {
                await loadFormOptions()
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

    private func loadFormOptions(force: Bool = false) async {
        guard canEditLocation else { return }
        guard force || formOptions == nil else { return }
        isLoadingOptions = true
        optionsError = nil
        do {
            formOptions = try await APIClient.shared.formOptions()
        } catch {
            optionsError = "Couldn't load locations. The current pickup location will stay selected."
        }
        isLoadingOptions = false
    }

    private func save() async {
        if isSaving { return }
        isSaving = true
        do {
            try await APIClient.shared.updateBooking(
                id: booking.id,
                title: title != booking.title ? title.trimmingCharacters(in: .whitespacesAndNewlines) : nil,
                notes: notes != (booking.notes ?? "") ? notes.trimmingCharacters(in: .whitespacesAndNewlines) : nil,
                locationId: canEditLocation && locationId != booking.location.id ? locationId : nil,
                startsAt: startsAt != booking.startsAt ? startsAt : nil,
                endsAt: endsAt != booking.endsAt ? endsAt : nil,
                updatedAt: booking.updatedAt
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

private struct EditDetailPickerRow: View {
    let title: String
    let subtitle: String
    let systemImage: String

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: systemImage)
                .foregroundStyle(.secondary)
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .foregroundStyle(.primary)
                Text(subtitle)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
        }
        .contentShape(Rectangle())
    }
}

// MARK: - Sub-sections

private struct BookingDetailsSection: View {
    let booking: Booking
    let canEdit: Bool
    let onEdit: () -> Void

    private var isOverdue: Bool {
        booking.status == .open && booking.endsAt < .now
    }

    /// Web parity: a live "DUE BACK IN …" / "OVERDUE BY …" badge for active
    /// checkouts. Reads the same vocabulary `formatCountdown` returns on web.
    private var showsCountdown: Bool {
        booking.status == .open
    }

    private var sameCalendarDay: Bool {
        Calendar.current.isDate(booking.startsAt, inSameDayAs: booking.endsAt)
    }

    /// "(6 hours)" / "(2 days)" / "(45 min)" -- a compact duration chip beside
    /// the date range, mirroring the web detail page's "(6 hours)" annotation.
    private var durationText: String {
        let secs = booking.endsAt.timeIntervalSince(booking.startsAt)
        if secs >= 86_400 {
            let days = Int((secs / 86_400).rounded())
            return "(\(days) day\(days == 1 ? "" : "s"))"
        }
        if secs >= 3_600 {
            let hours = Int((secs / 3_600).rounded())
            return "(\(hours) hour\(hours == 1 ? "" : "s"))"
        }
        let mins = Swift.max(1, Int((secs / 60).rounded()))
        return "(\(mins) min)"
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .top, spacing: 12) {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Details")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .textCase(.uppercase)
                    HStack(spacing: 8) {
                        StatusBadge(status: booking.status, kind: booking.kind)
                        if let ref = booking.refNumber {
                            Text(ref)
                                .font(.system(.caption, design: .monospaced))
                                .foregroundStyle(.secondary)
                        }
                    }
                }
                Spacer()
                if canEdit {
                    Button(action: onEdit) {
                        Label("Edit Details", systemImage: "pencil")
                    }
                    .buttonStyle(.bordered)
                    .buttonBorderShape(.capsule)
                    .controlSize(.small)
                    .accessibilityLabel("Edit booking details")
                }
            }

            Text(booking.title)
                .font(.gothamBold(size: 24))
                .foregroundStyle(.primary)
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityAddTraits(.isHeader)

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
            } else if booking.kind == .checkout,
                      booking.status == .pendingPickup || booking.status == .booked {
                // Pre-pickup checkouts get the same live urgency badge, counting
                // down to the pickup window instead of the return.
                TimelineView(.periodic(from: .now, by: 30)) { context in
                    let pickup = Date.startCountdown(for: booking.startsAt, now: context.date)
                    let label: String = pickup.isLate
                        ? (pickup.body == "less than a minute" ? "PICKUP DUE NOW" : "PICKUP \(pickup.body.uppercased()) LATE")
                        : "PICKUP IN \(pickup.body.uppercased())"
                    StatusPill(label: label, tone: pickup.tone, emphasized: true)
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

            VStack(alignment: .leading, spacing: 12) {
                if let event = booking.event, let summary = event.summary {
                    detailRow(
                        icon: "calendar.badge.clock",
                        title: "Event",
                        value: summary
                    )
                }

                requesterRow

                detailRow(
                    icon: "mappin.circle",
                    title: "Pickup location",
                    value: booking.location.name
                )

                if let kiosk = booking.pickupKioskDevice {
                    detailRow(
                        icon: "barcode.viewfinder",
                        title: "Pickup kiosk",
                        value: "\(kiosk.name), \(kiosk.location.name)"
                    )
                }

                Label {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Pickup and return")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .textCase(.uppercase)
                        Text(booking.startsAt.gearLong)
                            .font(.subheadline)
                        HStack(spacing: 6) {
                            Text("to \(sameCalendarDay ? booking.endsAt.gearTime : booking.endsAt.gearShort)")
                                .font(.subheadline)
                                .foregroundStyle(isOverdue ? Color.statusText(.red) : Color.secondary)
                            Text(durationText)
                                .font(.subheadline)
                                .foregroundStyle(.tertiary)
                        }
                    }
                } icon: {
                    Image(systemName: "calendar")
                        .foregroundStyle(.secondary)
                }
                .accessibilityElement(children: .combine)
                .accessibilityLabel("Pickup and return, from \(booking.startsAt.gearLong) to \(booking.endsAt.gearShort), \(durationText.trimmingCharacters(in: CharacterSet(charactersIn: "()")))")

                notesRow
            }
        }
    }

    private var requesterRow: some View {
        Label {
            VStack(alignment: .leading, spacing: 6) {
                Text("Requester")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .textCase(.uppercase)
                HStack(spacing: 10) {
                    UserAvatarView(name: booking.requester.name, avatarUrl: booking.requester.avatarUrl, size: 36)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(booking.requester.name)
                            .font(.subheadline)
                        Text(booking.requester.email)
                            .font(.system(.caption, design: .monospaced))
                            .foregroundStyle(.secondary)
                    }
                }
            }
        } icon: {
            Image(systemName: "person.crop.circle")
                .foregroundStyle(.secondary)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Requester, \(booking.requester.name), \(booking.requester.email)")
    }

    private var notesRow: some View {
        Label {
            VStack(alignment: .leading, spacing: 2) {
                Text("Notes")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .textCase(.uppercase)
                Text(booking.notes?.nonBlankText ?? "No notes")
                    .font(.subheadline)
                    .foregroundStyle(booking.notes?.nonBlankText == nil ? .secondary : .primary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        } icon: {
            Image(systemName: "note.text")
                .foregroundStyle(.secondary)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Notes, \(booking.notes?.nonBlankText ?? "No notes")")
    }

    private func detailRow(icon: String, title: String, value: String) -> some View {
        Label {
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .textCase(.uppercase)
                Text(value)
                    .font(.subheadline)
                    .foregroundStyle(.primary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        } icon: {
            Image(systemName: icon)
                .foregroundStyle(.secondary)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(title), \(value)")
    }
}

/// Informational next-step banner for kiosk custody handoffs. Tinted (not a
/// button) because pickup and return happen at a physical kiosk, never in-app.
private struct KioskHandoffCallout: View {
    let text: String
    let detail: String
    let tone: StatusTone

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "barcode.viewfinder")
                .font(.title3)
                .foregroundStyle(Color.statusText(tone))
            VStack(alignment: .leading, spacing: 2) {
                Text(text)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.primary)
                Text(detail)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer(minLength: 0)
        }
        .padding(Brand.Space.sm)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.statusBackground(tone), in: RoundedRectangle(cornerRadius: Brand.Radius.md, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Brand.Radius.md, style: .continuous)
                .strokeBorder(Color.statusText(tone).opacity(0.18), lineWidth: 1)
        )
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(text). \(detail)")
    }
}

/// Per-item badge that reflects the booking lifecycle, not the raw allocation
/// flag. `allocationStatus == "active"` only means the item is committed to the
/// booking (set at creation) -- it is not physically out until the checkout
/// reaches OPEN. So before pickup the item reads "Reserved", and "Out" only
/// once the checkout is open. Returned items always read "Returned". Returns
/// nil when no badge applies (completed/cancelled with nothing to say).
private func equipmentItemPill(
    allocationStatus: String?,
    bookingStatus: BookingStatus
) -> (label: String, tone: StatusTone)? {
    if allocationStatus?.lowercased() == "returned" {
        return ("Returned", .gray)
    }
    switch bookingStatus {
    case .open:
        return ("Out", .blue)
    case .booked, .pendingPickup:
        return ("Reserved", .orange)
    case .draft:
        return ("Pending", .orange)
    case .completed, .cancelled, .unknown:
        return nil
    }
}

/// Single "Equipment" list mirroring the web booking detail: serialized gear
/// first, then bulk items, under one header whose count is the combined total.
private struct EquipmentSection: View {
    let serializedItems: [BookingSerializedItem]
    let bulkItems: [BookingBulkItem]
    let conflicts: [String: AssetConflict]
    let bookingKind: BookingKind
    let bookingStatus: BookingStatus

    private var handoffCopy: String {
        switch bookingStatus {
        case .pendingPickup:
            return "Scan each item at a kiosk to start custody. Gear is read-only here."
        case .open:
            return "Return, add, and remove physical gear at a kiosk. This list is read-only here."
        default:
            return bookingKind == .reservation
                ? "Equipment is read-only in this detail view. Kiosk pickup verifies the physical handoff."
                : "Equipment is read-only here. Kiosk flows own physical custody changes."
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            SectionHeader(title: "Equipment", count: serializedItems.count + bulkItems.count)
            Text(handoffCopy)
                .font(.caption)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
            ForEach(serializedItems) { item in
                serializedRow(item)
            }
            ForEach(bulkItems) { item in
                bulkRow(item)
            }
        }
    }

    @ViewBuilder
    private func serializedRow(_ item: BookingSerializedItem) -> some View {
        let conflict = conflicts[item.assetId]
        HStack(spacing: 10) {
            AssetThumbnail(imageUrl: item.asset.imageUrl, size: 40)
            VStack(alignment: .leading, spacing: 2) {
                Text(item.asset.itemListPrimaryTitle)
                    .font(.gothamBold(size: 16))
                    .lineLimit(1)
                if let subtitle = item.asset.itemListSecondaryTitle {
                    Text(subtitle)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
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
            if let pill = equipmentItemPill(allocationStatus: item.allocationStatus, bookingStatus: bookingStatus) {
                StatusPill(label: pill.label, tone: pill.tone)
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(rowAccessibilityLabel(item: item, conflict: conflict))
    }

    @ViewBuilder
    private func bulkRow(_ item: BookingBulkItem) -> some View {
        let units = item.assignedUnitNumbers
        HStack(spacing: 10) {
            BulkThumbnail(imageUrl: item.bulkSku.imageUrl, size: 40)
            VStack(alignment: .leading, spacing: 2) {
                Text(item.itemListPrimaryTitle)
                    .font(.gothamBold(size: 16))
                    .lineLimit(1)
                if let subtitle = item.itemListSecondaryTitle {
                    Text(subtitle)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            }
            Spacer()
            Text("×\(item.plannedQuantity)")
                .font(.subheadline.monospacedDigit())
                .foregroundStyle(.secondary)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(bulkRowAccessibilityLabel(item: item, quantity: item.plannedQuantity, units: units))
    }

    private func bulkRowAccessibilityLabel(item: BookingBulkItem, quantity: Int, units: [Int]) -> String {
        var label = "\(item.itemListPrimaryTitle), quantity \(quantity)"
        if let subtitle = item.itemListSecondaryTitle {
            label += ", \(subtitle)"
        }
        if !units.isEmpty {
            label += ", units " + units.map(String.init).joined(separator: ", ")
        }
        return label
    }

    private func rowAccessibilityLabel(item: BookingSerializedItem, conflict: AssetConflict?) -> String {
        var parts: [String] = []
        if conflict != nil { parts.append("Conflict") }
        parts.append(item.asset.itemListPrimaryTitle)
        if let subtitle = item.asset.itemListSecondaryTitle { parts.append(subtitle) }
        if let pill = equipmentItemPill(allocationStatus: item.allocationStatus, bookingStatus: bookingStatus) {
            parts.append(pill.label)
        }
        if let conflict {
            parts.append(conflict.conflictingBookingTitle.map { "conflicts with \($0)" } ?? "scheduling conflict")
        }
        return parts.joined(separator: ", ")
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

private struct BookingEditLockedNotice: View {
    let booking: Booking

    private var message: String {
        switch booking.status {
        case .pendingPickup:
            return "Pickup is ready. Details are locked now, but you can still cancel before pickup or ask staff for changes."
        case .open:
            return "Checkout is active. Use Extend Return Date if you need more time; pickup and return stay at a kiosk."
        default:
            return "This booking is view-only in its current state."
        }
    }

    var body: some View {
        Label {
            VStack(alignment: .leading, spacing: 3) {
                Text("Editing locked")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.primary)
                Text(message)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        } icon: {
            Image(systemName: "lock.fill")
                .foregroundStyle(Color.statusText(.gray))
        }
        .accessibilityElement(children: .combine)
    }
}

private struct ActionsSection: View {
    let booking: Booking
    let returnInsight: CheckoutReturnInsight
    let isActioning: Bool
    let onExtend: () -> Void
    let onCancel: () -> Void

    /// Extend is valid only once a return window exists -- BOOKED and OPEN. The
    /// canonical action matrix (src/lib/booking-actions.ts) is
    /// PENDING_PICKUP: [edit, cancel], so an Awaiting-Pickup booking must not
    /// offer "Extend Return Date" (there is no return date to extend yet).
    private var canExtend: Bool {
        if booking.status == .open, returnInsight.hasUpcomingNeed { return false }
        return booking.status == .booked || booking.status == .open
    }

    /// Cancel is allowed before custody transfers (BOOKED, PENDING_PICKUP).
    /// Active (OPEN) checkouts are returned at a kiosk, not cancelled here.
    private var canCancel: Bool {
        booking.status == .booked || booking.status == .pendingPickup
    }

    var body: some View {
        VStack(spacing: 10) {
            if canExtend {
                Button {
                    onExtend()
                } label: {
                    Label("Extend Return Date", systemImage: "clock.arrow.circlepath")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .buttonBorderShape(.capsule)
                .controlSize(.large)
                .tint(Color.statusText(.blue))
                .disabled(isActioning)
                .accessibilityLabel("Extend Return Date")
            }

            if canCancel {
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
                .buttonStyle(.bordered)
                .buttonBorderShape(.capsule)
                .controlSize(.large)
                .tint(Color.statusText(.red))
                .disabled(isActioning)
                .accessibilityLabel(isActioning ? "Cancelling booking" : "Cancel Booking")
            }

            if booking.status == .pendingPickup {
                KioskHandoffCallout(
                    text: "Pick up gear at a kiosk",
                    detail: "Scan each item at a kiosk to start the checkout.",
                    tone: .orange
                )
            } else if booking.status == .open {
                KioskHandoffCallout(
                    text: "Return gear at a kiosk",
                    detail: "Bring the gear to a kiosk and scan it back in.",
                    tone: .blue
                )
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
