import SwiftUI

struct BookingDetailView: View {
    let bookingId: String

    @State private var booking: Booking?
    @State private var isLoading = true
    @State private var error: String?
    @State private var showCancelConfirm = false
    @State private var showExtend = false
    @State private var showEdit = false
    @State private var showReturn = false
    @State private var isActioning = false

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
                    VStack(spacing: 16) {
                        FormCard { HeaderSection(booking: booking) }
                        FormCard { RequesterSection(booking: booking) }
                        if !booking.serializedItems.isEmpty {
                            FormCard { ItemsSection(items: booking.serializedItems) }
                        }
                        if !booking.bulkItems.isEmpty {
                            FormCard { BulkSection(items: booking.bulkItems) }
                        }
                        if let notes = booking.notes, !notes.isEmpty {
                            FormCard { NotesSection(notes: notes) }
                        }
                        if booking.status == .booked || booking.status == .pendingPickup || booking.status == .open {
                            ActionsSection(
                                booking: booking,
                                isActioning: isActioning,
                                onExtend: { showExtend = true },
                                onReturn: { showReturn = true },
                                onCancel: { showCancelConfirm = true }
                            )
                        }
                        if let errorMsg = error {
                            Text(errorMsg)
                                .font(.footnote)
                                .foregroundStyle(.red)
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
        .sheet(isPresented: $showReturn) {
            if let booking {
                ReturnItemsSheet(booking: booking) {
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
                        Text(error).foregroundStyle(.red).font(.footnote)
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

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            SectionHeader(title: "Equipment", count: items.count)
            ForEach(items) { item in
                HStack(spacing: 10) {
                    AssetThumbnail(imageUrl: item.asset.imageUrl, size: 40)
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
            }
        }
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
    let booking: Booking
    let isActioning: Bool
    let onExtend: () -> Void
    let onReturn: () -> Void
    let onCancel: () -> Void

    private var unreturned: [BookingSerializedItem] {
        booking.serializedItems.filter { $0.allocationStatus == "active" }
    }

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

            if booking.status == .pendingPickup {
                Label("Pick up gear at a kiosk", systemImage: "barcode.viewfinder")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity)
                    .padding(.top, 2)
            } else if booking.status == .open {
                if !unreturned.isEmpty {
                    Button {
                        onReturn()
                    } label: {
                        Label("Return Items (\(unreturned.count))", systemImage: "arrow.uturn.left.circle")
                            .fontWeight(.semibold)
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(Color.green.opacity(0.1), in: RoundedRectangle(cornerRadius: 12))
                            .foregroundStyle(.green)
                    }
                    .buttonStyle(ScalePressStyle())
                    .disabled(isActioning)
                }
                Label("Or return at a kiosk", systemImage: "barcode.viewfinder")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity)
                    .padding(.top, 2)
            } else {
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

// MARK: - Return Items Sheet

struct ReturnItemsSheet: View {
    let booking: Booking
    let onReturned: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var selectedIds: Set<String> = []
    @State private var isReturning = false
    @State private var error: String?

    private var activeItems: [BookingSerializedItem] {
        booking.serializedItems.filter { $0.allocationStatus == "active" }
    }

    var body: some View {
        NavigationStack {
            List(activeItems) { item in
                Button {
                    if selectedIds.contains(item.assetId) {
                        selectedIds.remove(item.assetId)
                    } else {
                        selectedIds.insert(item.assetId)
                    }
                } label: {
                    HStack(spacing: 12) {
                        AssetThumbnail(imageUrl: item.asset.imageUrl, size: 40)
                        VStack(alignment: .leading, spacing: 2) {
                            Text([item.asset.brand, item.asset.model].compactMap { $0 }.joined(separator: " "))
                                .font(.subheadline)
                                .foregroundStyle(.primary)
                            if let tag = item.asset.assetTag {
                                Text(tag)
                                    .font(.caption)
                                    .fontDesign(.monospaced)
                                    .foregroundStyle(.secondary)
                            }
                        }
                        Spacer()
                        Image(systemName: selectedIds.contains(item.assetId) ? "checkmark.circle.fill" : "circle")
                            .font(.title3)
                            .foregroundStyle(selectedIds.contains(item.assetId) ? .green : Color(.systemGray4))
                            .animation(.easeInOut(duration: 0.15), value: selectedIds.contains(item.assetId))
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
            .overlay {
                if activeItems.isEmpty {
                    ContentUnavailableView("All Items Returned", systemImage: "checkmark.seal")
                }
            }
            .navigationTitle("Return Items")
            .navigationBarTitleDisplayMode(.inline)
            .safeAreaInset(edge: .bottom) {
                if let error {
                    Text(error)
                        .foregroundStyle(.red)
                        .font(.footnote)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding()
                        .background(.ultraThinMaterial)
                }
            }
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button {
                        Task { await returnSelected() }
                    } label: {
                        if isReturning {
                            ProgressView().scaleEffect(0.8)
                        } else {
                            Text("Return").fontWeight(.semibold)
                        }
                    }
                    .disabled(selectedIds.isEmpty || isReturning)
                }
            }
        }
    }

    private func returnSelected() async {
        isReturning = true
        error = nil
        do {
            try await APIClient.shared.checkinItems(bookingId: booking.id, assetIds: Array(selectedIds))
            onReturned()
            dismiss()
        } catch {
            self.error = error.localizedDescription
        }
        isReturning = false
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
