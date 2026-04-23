import SwiftUI

struct BookingDetailView: View {
    let bookingId: String

    @State private var booking: Booking?
    @State private var isLoading = true
    @State private var error: String?
    @State private var showCancelConfirm = false
    @State private var showExtend = false
    @State private var showEdit = false
    @State private var isActioning = false

    // Per-item check-in state (checkouts only)
    @State private var selectedCheckinIds: Set<String> = []
    @State private var isCheckingIn = false

    var canCheckin: Bool {
        booking?.kind == .checkout && booking?.status == .open
    }

    var body: some View {
        Group {
            if isLoading && booking == nil {
                BookingDetailSkeleton()
            } else if let error, booking == nil {
                ContentUnavailableView {
                    Label("Error", systemImage: "exclamationmark.triangle")
                } description: {
                    Text(error)
                } actions: {
                    Button("Retry") { Task { await loadBooking() } }
                        .buttonStyle(.borderedProminent)
                }
            } else if let booking {
                ScrollView {
                    VStack(alignment: .leading, spacing: 20) {
                        HeaderSection(booking: booking)
                        Divider()
                        RequesterSection(booking: booking)
                        if !booking.serializedItems.isEmpty {
                            Divider()
                            ItemsSection(
                                items: booking.serializedItems,
                                canCheckin: canCheckin,
                                selectedIds: $selectedCheckinIds
                            )
                            if canCheckin && !selectedCheckinIds.isEmpty {
                                CheckinButton(
                                    count: selectedCheckinIds.count,
                                    isLoading: isCheckingIn
                                ) {
                                    Task { await checkinSelected(booking: booking) }
                                }
                                .padding(.horizontal)
                            }
                        }
                        if !booking.bulkItems.isEmpty {
                            Divider()
                            BulkSection(items: booking.bulkItems)
                        }
                        if let notes = booking.notes, !notes.isEmpty {
                            Divider()
                            NotesSection(notes: notes)
                        }
                        if booking.status == .booked || booking.status == .pendingPickup || booking.status == .open {
                            Divider()
                            ActionsSection(
                                status: booking.status,
                                isActioning: isActioning,
                                onExtend: { showExtend = true },
                                onCancel: { showCancelConfirm = true }
                            )
                        }
                        if let errorMsg = error {
                            Text(errorMsg)
                                .font(.footnote)
                                .foregroundStyle(.red)
                                .padding(.horizontal)
                        }
                    }
                    .padding()
                }
            }
        }
        .navigationTitle(booking?.title ?? "Booking")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if booking != nil {
                ToolbarItem(placement: .topBarTrailing) {
                    Button { showEdit = true } label: {
                        Image(systemName: "pencil")
                    }
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
            booking = try await APIClient.shared.booking(id: bookingId)
            selectedCheckinIds = []
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }

    private func cancelBooking() async {
        isActioning = true
        do {
            try await APIClient.shared.cancelBooking(id: bookingId)
            await loadBooking()
        } catch {
            self.error = error.localizedDescription
        }
        isActioning = false
    }

    private func checkinSelected(booking: Booking) async {
        isCheckingIn = true
        do {
            try await APIClient.shared.checkinItems(bookingId: booking.id, assetIds: Array(selectedCheckinIds))
            await loadBooking()
        } catch {
            self.error = error.localizedDescription
        }
        isCheckingIn = false
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
            Form {
                Section("Details") {
                    TextField("Title", text: $title)
                }
                Section("Dates") {
                    DatePicker("Starts", selection: $startsAt, displayedComponents: [.date, .hourAndMinute])
                    DatePicker("Ends", selection: $endsAt, in: startsAt..., displayedComponents: [.date, .hourAndMinute])
                }
                Section("Notes") {
                    TextField("Notes…", text: $notes, axis: .vertical)
                        .lineLimit(3...6)
                }
                if let error {
                    Section {
                        Text(error).foregroundStyle(.red).font(.footnote)
                    }
                }
            }
            .navigationTitle("Edit Booking")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { Task { await save() } }
                        .disabled(!hasChanges || title.trimmingCharacters(in: .whitespaces).isEmpty || isSaving)
                        .fontWeight(.semibold)
                }
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
            onSaved()
            dismiss()
        } catch {
            self.error = error.localizedDescription
        }
        isSaving = false
    }
}

// MARK: - Sub-sections

private struct HeaderSection: View {
    let booking: Booking

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                StatusBadge(status: booking.status)
                Spacer()
                if let ref = booking.refNumber {
                    Text(ref)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            if let event = booking.event, let summary = event.summary {
                Text(summary)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
            Label(booking.location.name, systemImage: "mappin.circle")
                .font(.subheadline)
                .foregroundStyle(.secondary)
            Label {
                VStack(alignment: .leading) {
                    Text(booking.startsAt.formatted(date: .complete, time: .shortened))
                    Text("to \(booking.endsAt.formatted(date: .abbreviated, time: .shortened))")
                        .foregroundStyle(.secondary)
                }
            } icon: {
                Image(systemName: "calendar")
            }
            .font(.subheadline)
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
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
    }
}

private struct ItemsSection: View {
    let items: [BookingSerializedItem]
    let canCheckin: Bool
    @Binding var selectedIds: Set<String>

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            SectionHeader(title: "Equipment", count: items.count)
            ForEach(items) { item in
                HStack {
                    if canCheckin {
                        Image(systemName: selectedIds.contains(item.assetId) ? "checkmark.circle.fill" : "circle")
                            .font(.title3)
                            .foregroundStyle(selectedIds.contains(item.assetId) ? .blue : Color(.systemGray4))
                            .animation(.easeInOut(duration: 0.15), value: selectedIds.contains(item.assetId))
                            .frame(width: 44, height: 44)
                            .contentShape(Rectangle())
                            .onTapGesture {
                                if selectedIds.contains(item.assetId) {
                                    selectedIds.remove(item.assetId)
                                } else {
                                    selectedIds.insert(item.assetId)
                                }
                            }
                    }
                    VStack(alignment: .leading, spacing: 2) {
                        Text([item.asset.brand, item.asset.model].compactMap { $0 }.joined(separator: " "))
                            .font(.subheadline)
                        if let tag = item.asset.assetTag {
                            Text(tag)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                    Spacer()
                    if let status = item.allocationStatus {
                        Text(status)
                            .font(.caption2)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(.quaternary, in: Capsule())
                    }
                }
                .contentShape(Rectangle())
                .onTapGesture {
                    guard canCheckin else { return }
                    if selectedIds.contains(item.assetId) {
                        selectedIds.remove(item.assetId)
                    } else {
                        selectedIds.insert(item.assetId)
                    }
                }
            }
        }
    }
}

private struct CheckinButton: View {
    let count: Int
    let isLoading: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Group {
                if isLoading {
                    ProgressView().tint(.white)
                } else {
                    Label("Check In \(count) Item\(count == 1 ? "" : "s")", systemImage: "arrow.down.circle.fill")
                        .fontWeight(.semibold)
                }
            }
            .frame(maxWidth: .infinity)
            .padding()
            .background(Color.green, in: RoundedRectangle(cornerRadius: 12))
            .foregroundStyle(.white)
        }
        .buttonStyle(ScalePressStyle())
        .disabled(isLoading)
    }
}

private struct BulkSection: View {
    let items: [BookingBulkItem]

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            SectionHeader(title: "Consumables", count: items.count)
            ForEach(items) { item in
                HStack {
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
    let status: BookingStatus
    let isActioning: Bool
    let onExtend: () -> Void
    let onCancel: () -> Void

    var body: some View {
        VStack(spacing: 10) {
            Button {
                onExtend()
            } label: {
                Label("Extend Return Date", systemImage: "clock.badge.plus")
                    .fontWeight(.semibold)
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(Color.blue.opacity(0.1), in: RoundedRectangle(cornerRadius: 12))
                    .foregroundStyle(.blue)
            }
            .buttonStyle(ScalePressStyle())
            .disabled(isActioning)

            if status != .open {
                Button(role: .destructive) {
                    onCancel()
                } label: {
                    Group {
                        if isActioning {
                            ProgressView().tint(.red)
                        } else {
                            Label("Cancel Booking", systemImage: "xmark.circle")
                                .fontWeight(.semibold)
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(Color.red.opacity(0.1), in: RoundedRectangle(cornerRadius: 12))
                    .foregroundStyle(.red)
                }
                .buttonStyle(ScalePressStyle())
                .disabled(isActioning)
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
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.96 : 1)
            .animation(.easeInOut(duration: 0.15), value: configuration.isPressed)
    }
}
