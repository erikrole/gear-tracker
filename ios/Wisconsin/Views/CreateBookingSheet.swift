import SwiftUI

struct CreateBookingSheet: View {
    let onCreated: (String) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var vm: CreateBookingViewModel
    @State private var step = 1
    @State private var submitError: String?
    @State private var showDiscardConfirm = false
    @State private var initialUserId: String = ""
    @State private var initialLocationId: String = ""
    @State private var initialStartsAt: Date = .now
    @State private var initialEndsAt: Date = .now
    @State private var initialEventIds: [String] = []
    @State private var capturedInitial = false
    @State private var showScanner = false
    @State private var showNotesField = false
    @FocusState private var notesFocused: Bool
    @Environment(SessionStore.self) private var session

    init(onCreated: @escaping (String) -> Void) {
        _vm = State(wrappedValue: CreateBookingViewModel())
        self.onCreated = onCreated
    }

    init(vm: CreateBookingViewModel, onCreated: @escaping (String) -> Void) {
        _vm = State(wrappedValue: vm)
        self.onCreated = onCreated
    }

    private var canPickRequester: Bool {
        let role = session.currentUser?.role ?? ""
        return role == "STAFF" || role == "ADMIN"
    }

    private var hasUnsavedInput: Bool {
        if !vm.title.trimmingCharacters(in: .whitespaces).isEmpty { return true }
        if !vm.notes.isEmpty { return true }
        if !vm.selectedAssetIds.isEmpty { return true }
        if vm.selectedBulkTotal > 0 { return true }
        if vm.selectedEventIds != initialEventIds { return true }
        // Track requester / location / date deltas so a STAFF user who picks
        // a requester + adjusts dates and then taps Cancel gets a discard
        // prompt before losing the setup.
        guard capturedInitial else { return false }
        if vm.selectedUserId != initialUserId { return true }
        if vm.selectedLocationId != initialLocationId { return true }
        if vm.startsAt != initialStartsAt { return true }
        if vm.endsAt != initialEndsAt { return true }
        return false
    }

    private func attemptCancel() {
        if vm.isSubmitting { return }
        if hasUnsavedInput {
            showDiscardConfirm = true
        } else {
            dismiss()
        }
    }

    var body: some View {
        NavigationStack {
            Group {
                if step == 1 {
                    detailsForm
                } else if step == 2 {
                    equipmentPicker
                } else {
                    reviewStep
                }
            }
            .navigationTitle(step == 1 ? "New Reservation" : step == 2 ? "Equipment" : "Confirm")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { toolbar }
            .confirmationDialog(
                "Couldn't create reservation",
                isPresented: Binding(
                    get: { submitError != nil },
                    set: { if !$0 { submitError = nil } }
                ),
                titleVisibility: .visible
            ) {
                Button("Try again") {
                    submitError = nil
                    Task { await create() }
                }
                Button("OK", role: .cancel) {}
            } message: {
                Text(submitError ?? "")
            }
            .confirmationDialog(
                "Discard reservation?",
                isPresented: $showDiscardConfirm,
                titleVisibility: .visible
            ) {
                Button("Discard", role: .destructive) { dismiss() }
                Button("Keep Editing", role: .cancel) {}
            } message: {
                Text("Your changes will be lost.")
            }
            .interactiveDismissDisabled(hasUnsavedInput || vm.isSubmitting)
            .task {
                async let optionsTask: Void = vm.loadOptions()
                async let eventsTask: Void = vm.loadEvents()
                _ = await (optionsTask, eventsTask)
            }
            .fullScreenCover(isPresented: $showScanner) {
                // Continuous scanning: the scanner stays open after each hit
                // so a shelf of items is one session; feedback shows in-scanner.
                QRScannerSheet(resolve: { match in
                    switch match {
                    case .asset(let assetId):
                        let outcome = await vm.addScannedAsset(id: assetId)
                        return .continueScanning(message: outcome.message, success: outcome.success)
                    case .itemFamily(let family):
                        let outcome = vm.addScannedFamily(family)
                        return .continueScanning(message: outcome.message, success: outcome.success)
                    }
                })
            }
            .onChange(of: vm.options) {
                if vm.selectedUserId.isEmpty, let current = session.currentUser {
                    if vm.options?.users.contains(where: { $0.id == current.id }) == true {
                        vm.selectedUserId = current.id
                    }
                }
                captureInitialIfNeeded()
            }
            .onAppear { captureInitialIfNeeded() }
        }
    }

    /// Snapshots the initial requester / location / date values once the
    /// view-model has had a chance to apply prefills (from the items-list or
    /// item-detail Reserve flows). `hasUnsavedInput` compares against these
    /// to detect changes the user made on top of any prefill.
    private func captureInitialIfNeeded() {
        if capturedInitial { return }
        // Wait until we have a non-empty user (either prefilled or auto-set
        // from the current session) — otherwise the snapshot would record
        // "" and a later auto-fill would falsely register as a delta.
        guard !vm.selectedUserId.isEmpty else { return }
        initialUserId = vm.selectedUserId
        initialLocationId = vm.selectedLocationId
        initialStartsAt = vm.startsAt
        initialEndsAt = vm.endsAt
        initialEventIds = vm.selectedEventIds
        capturedInitial = true
    }

    @ToolbarContentBuilder
    private var toolbar: some ToolbarContent {
        ToolbarItem(placement: .cancellationAction) {
            if step == 1 {
                Button("Cancel") { attemptCancel() }
                    .disabled(vm.isSubmitting)
            } else {
                Button("Back") { step -= 1 }
                    .disabled(vm.isSubmitting)
            }
        }
        ToolbarItem(placement: .confirmationAction) {
            if step == 1 {
                Button("Next") {
                    step = 2
                    Task { await vm.loadAvailableAssets(reset: true) }
                    vm.scheduleConflictCheck()
                }
                .disabled(!vm.isValid || vm.isSubmitting)
                .fontWeight(.semibold)
            } else if step == 2 {
                // Review lives on the cart bar in step 2; the toolbar slot
                // hosts scan so it's always reachable above the keyboard.
                Button {
                    showScanner = true
                } label: {
                    Image(systemName: "barcode.viewfinder")
                }
                .accessibilityLabel("Scan equipment")
                .disabled(vm.isSubmitting)
            }
            // Step 3's primary action is the prominent inline button in
            // reviewStep (Apple review-screen pattern, same as web Step 3).
        }
    }

    @ViewBuilder
    private var detailsForm: some View {
        ScrollView {
            VStack(spacing: 18) {
                BookingStepHeader(
                    icon: "calendar.badge.plus",
                    eyebrow: "Reservation",
                    title: vm.title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? "Reservation details" : vm.title,
                    subtitle: detailHeaderSubtitle
                )

                // Events first: linking one auto-fills the title and window,
                // which is the fast path for most reservations.
                EventLinkingCard(
                    events: vm.events,
                    selectedEvents: vm.selectedEvents,
                    isLoading: vm.isLoadingEvents,
                    error: vm.eventError,
                    onRetry: { Task { await vm.loadEvents() } },
                    onToggle: { vm.toggleEvent($0) },
                    onRemove: { vm.removeSelectedEvent($0) }
                )

                FormCard {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Title")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(.secondary)
                            .textCase(.uppercase)
                        TextField(
                            "Booking title",
                            text: Binding(
                                get: { vm.title },
                                set: { vm.setTitleFromUser($0) }
                            )
                        )
                        .font(.title3.weight(.semibold))
                        .submitLabel(.next)
                    }
                }

                FormCard {
                    if vm.isLoadingOptions {
                        HStack {
                            ProgressView()
                            Text("Loading…").font(.subheadline).foregroundStyle(.secondary)
                        }
                        .frame(maxWidth: .infinity, alignment: .center)
                        .padding(.vertical, 4)
                    } else {
                        if canPickRequester {
                            NavigationLink {
                                RequesterPickerView(
                                    users: vm.options?.users ?? [],
                                    currentUserId: session.currentUser?.id,
                                    selection: $vm.selectedUserId
                                )
                            } label: {
                                FormPickerRow(
                                    label: "For",
                                    value: vm.selectedUser?.name ?? "Select person"
                                ) {
                                    if let selected = vm.selectedUser {
                                        UserAvatarView(name: selected.name, avatarUrl: selected.avatarUrl, size: 26)
                                    }
                                }
                            }
                            .buttonStyle(.plain)
                        } else {
                            // Student: locked to self.
                            FormPickerRow(
                                label: "For",
                                value: session.currentUser?.name ?? "You"
                            ) {
                                if let current = session.currentUser {
                                    UserAvatarView(name: current.name, avatarUrl: current.avatarUrl, size: 26)
                                }
                            }
                            .opacity(0.85)
                        }

                        Divider().padding(.leading, 4)

                        NavigationLink {
                            OptionPickerView(
                                title: "Pickup location",
                                options: vm.options?.locations.map { ($0.id, $0.name) } ?? [],
                                selection: Binding(
                                    get: { vm.selectedLocationId },
                                    set: { vm.setLocationFromUser($0) }
                                )
                            )
                        } label: {
                            FormPickerRow(
                                label: "Pickup",
                                value: vm.selectedLocation?.name ?? "Select pickup"
                            )
                        }
                        .buttonStyle(.plain)
                    }
                }

                FormCard {
                    DatePicker(
                        "From",
                        selection: Binding(
                            get: { vm.startsAt },
                            set: { vm.adjustStart(to: $0) }
                        ),
                        displayedComponents: [.date, .hourAndMinute]
                    )
                    .tint(.accentColor)
                    Divider().padding(.leading, 4)
                    DatePicker(
                        "To",
                        selection: Binding(
                            get: { vm.endsAt },
                            set: { vm.adjustEnd(to: $0) }
                        ),
                        in: vm.startsAt...,
                        displayedComponents: [.date, .hourAndMinute]
                    )
                        .tint(.accentColor)
                    Divider().padding(.leading, 4)
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            ForEach(BookingDurationPreset.allCases) { preset in
                                FilterChip(
                                    label: preset.rawValue,
                                    isOn: vm.activeDurationPreset == preset,
                                    tone: .purple
                                ) {
                                    vm.applyDurationPreset(preset)
                                    Haptics.selection()
                                }
                            }
                        }
                        .padding(.vertical, 2)
                    }
                    .accessibilityLabel("Quick duration presets")
                }

                if vm.notes.isEmpty && !showNotesField {
                    Button {
                        showNotesField = true
                        Task {
                            // Focus after the field exists in the hierarchy.
                            try? await Task.sleep(for: .milliseconds(80))
                            notesFocused = true
                        }
                    } label: {
                        FormCard {
                            Label("Add note", systemImage: "square.and.pencil")
                                .font(.body)
                                .foregroundStyle(Color.statusText(.blue))
                        }
                    }
                    .buttonStyle(.plain)
                } else {
                    FormCard {
                        TextField("Notes (optional)", text: $vm.notes, axis: .vertical)
                            .lineLimit(3...6)
                            .font(.body)
                            .focused($notesFocused)
                    }
                }

                if let error = vm.error {
                    Text(error)
                        .font(.footnote)
                        .foregroundStyle(Color.statusText(.red))
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, 4)
                }
            }
            .padding(20)
        }
        .background(Color(.systemGroupedBackground))
    }

    private var detailHeaderSubtitle: String {
        let window = detailWindowText
        if let linked = vm.linkedEventLabel {
            return "\(linked) · \(window)"
        }
        return window
    }

    private var detailWindowText: String {
        if !vm.userEditedWindow, let allDayWindow = selectedAllDayWindowText {
            return allDayWindow
        }
        return "\(vm.startsAt.formatted(date: .abbreviated, time: .shortened)) to \(vm.endsAt.formatted(date: .omitted, time: .shortened))"
    }

    private var selectedAllDayWindowText: String? {
        let selected = vm.selectedEvents
        let events = selected.isEmpty ? vm.prefillEvent.map { [$0] } ?? [] : selected
        guard !events.isEmpty, events.allSatisfy(\.displayAllDay) else { return nil }
        let days = events.flatMap(\.spannedDays).sorted()
        guard let start = days.first, let end = days.last else { return nil }
        let calendar = Calendar.current
        if calendar.isDate(start, inSameDayAs: end) {
            return "\(start.formatted(date: .abbreviated, time: .omitted)), All day"
        }
        return "\(shortDate(start))-\(shortDate(end)), All day"
    }

    private func shortDate(_ date: Date) -> String {
        date.formatted(.dateTime.month(.abbreviated).day())
    }

    private var reviewPickupText: String {
        if !vm.userEditedWindow, let allDayWindow = selectedAllDayWindowText {
            return allDayWindow
        }
        return vm.startsAt.formatted(date: .abbreviated, time: .shortened)
    }

    private var reviewReturnText: String? {
        if !vm.userEditedWindow, selectedAllDayWindowText != nil {
            return "Return after event"
        }
        return "Return \(vm.endsAt.formatted(date: .abbreviated, time: .shortened))"
    }

    @ViewBuilder
    private var equipmentPicker: some View {
        CreateBookingEquipmentPicker(vm: vm) {
            step = 3
        }
    }

    /// Apple-style review confirmation — the little brother of web Step 3:
    /// kind icon, the window as the hero claim, requester/location, a narrow
    /// facts table, the equipment list, and one primary action.
    @ViewBuilder
    private var reviewStep: some View {
        ScrollView {
            VStack(spacing: 24) {
                VStack(spacing: 0) {
                    // Canonical reservation identity: calendar on purple.
                    Image(systemName: vm.linkedEventCount > 0 ? "calendar.badge.checkmark" : "calendar")
                        .font(.title2.weight(.semibold))
                        .foregroundStyle(Color.statusText(.purple))
                        .frame(width: 56, height: 56)
                        .background(Color.statusBackground(.purple), in: RoundedRectangle(cornerRadius: 16))

                    Text(vm.title.isEmpty ? "Review your reservation" : vm.title)
                        .font(.title2.weight(.bold))
                        .multilineTextAlignment(.center)
                        .lineLimit(2)
                        .padding(.top, 18)

                    Text("Pickup")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                        .textCase(.uppercase)
                        .padding(.top, 20)
                    Text(reviewPickupText)
                        .font(.title2.weight(.semibold))
                        .monospacedDigit()
                        .padding(.top, 2)
                    if let reviewReturnText {
                        Text(reviewReturnText)
                            .font(.subheadline.weight(.medium))
                            .foregroundStyle(.secondary)
                            .padding(.top, 2)
                    }

                    VStack(spacing: 2) {
                        Text("For \(vm.selectedUser?.name ?? session.currentUser?.name ?? "")")
                        Text("Pickup \(vm.selectedLocation?.name ?? "")")
                    }
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .padding(.top, 14)

                    VStack(spacing: 0) {
                        reviewFactRow(label: "Status") {
                            Text("Reserved")
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(Color.statusText(.purple))
                                .padding(.horizontal, 8)
                                .padding(.vertical, 3)
                                .background(Color.statusBackground(.purple), in: Capsule())
                        }
                        Divider()
                        reviewFactRow(label: "Equipment") {
                            Text("\(vm.selectedEquipmentCount) item\(vm.selectedEquipmentCount == 1 ? "" : "s")")
                                .font(.subheadline.weight(.medium))
                                .monospacedDigit()
                        }
                        if let linked = vm.linkedEventLabel {
                            Divider()
                            reviewFactRow(label: vm.linkedEventCount > 1 ? "Events" : "Event") {
                                Label(linked, systemImage: "calendar.badge.checkmark")
                                    .font(.subheadline.weight(.medium))
                                    .multilineTextAlignment(.trailing)
                            }
                        }
                        if !vm.notes.isEmpty {
                            Divider()
                            reviewFactRow(label: "Notes") {
                                Text(vm.notes)
                                    .font(.subheadline)
                                    .multilineTextAlignment(.trailing)
                            }
                        }
                    }
                    .padding(.top, 22)
                    .overlay(Rectangle().frame(height: 0.5).foregroundStyle(Color(.separator)), alignment: .top)
                    .overlay(Rectangle().frame(height: 0.5).foregroundStyle(Color(.separator)), alignment: .bottom)
                }
                .frame(maxWidth: .infinity)
                .padding(.top, 28)
                .padding(.horizontal, 20)

                // Advisory only — server enforcement at submit is authoritative,
                // same semantics as the web availability review.
                if !vm.conflictedAssetIds.isEmpty {
                    let count = vm.conflictedAssetIds.count
                    HStack(spacing: 10) {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .foregroundStyle(Color.statusText(.orange))
                        Text("\(count) scheduling conflict\(count == 1 ? "" : "s") — availability is rechecked when you reserve.")
                            .font(.footnote)
                            .foregroundStyle(.primary)
                        Spacer(minLength: 0)
                    }
                    .padding(12)
                    .background(Color.statusBackground(.orange), in: RoundedRectangle(cornerRadius: 12))
                    .padding(.horizontal, 20)
                }

                // Equipment list — concise, not the visual center.
                VStack(alignment: .leading, spacing: 8) {
                    Text("Equipment")
                        .font(.subheadline.weight(.semibold))
                    VStack(spacing: 0) {
                        ForEach(Array(vm.selectedAssets.enumerated()), id: \.element.id) { index, asset in
                            if index > 0 { Divider().padding(.leading, 12) }
                            HStack(spacing: 10) {
                                BookingAssetThumbnail(imageUrl: asset.imageUrl, size: 40, cornerRadius: 8)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(asset.itemListPrimaryTitle)
                                        .font(.gothamBold(size: 16))
                                        .lineLimit(1)
                                    if let subtitle = asset.itemListSecondaryTitle {
                                        Text(subtitle)
                                            .font(.caption)
                                            .foregroundStyle(.secondary)
                                            .lineLimit(1)
                                    }
                                }
                                Spacer()
                                if vm.conflictedAssetIds.contains(asset.id) {
                                    Image(systemName: "exclamationmark.triangle.fill")
                                        .font(.caption)
                                        .foregroundStyle(Color.statusText(.orange))
                                        .accessibilityLabel("Scheduling conflict")
                                }
                            }
                            .padding(.horizontal, 12)
                            .padding(.vertical, 10)
                        }
                        if !vm.selectedAssets.isEmpty && !vm.selectedBulkSkus.isEmpty {
                            Divider().padding(.leading, 12)
                        }
                        ForEach(Array(vm.selectedBulkSkus.enumerated()), id: \.element.id) { index, sku in
                            if index > 0 { Divider().padding(.leading, 12) }
                            HStack(spacing: 10) {
                                BookingBulkThumbnail(imageUrl: sku.imageUrl, size: 40, cornerRadius: 8)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(sku.name)
                                        .font(.gothamBold(size: 16))
                                        .lineLimit(1)
                                    Text(bulkSubtitle(sku))
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                                Spacer()
                                Text("×\(vm.quantity(for: sku))")
                                    .font(.subheadline.weight(.semibold))
                                    .monospacedDigit()
                                    .foregroundStyle(.secondary)
                            }
                            .padding(.horizontal, 12)
                            .padding(.vertical, 10)
                        }
                    }
                    .background(Color.cardSurface, in: RoundedRectangle(cornerRadius: Brand.Radius.md, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: Brand.Radius.md, style: .continuous)
                            .strokeBorder(Color.hairline, lineWidth: 0.5)
                    )
                }
                .padding(.horizontal, 20)

                // One primary action, prominent and inline — like web Step 3.
                Button {
                    Task { await create() }
                } label: {
                    Group {
                        if vm.isSubmitting {
                            ProgressView().tint(.white)
                        } else {
                            Text("Reserve for later")
                                .fontWeight(.semibold)
                        }
                    }
                    .frame(maxWidth: .infinity, minHeight: 44)
                }
                .buttonStyle(.borderedProminent)
                .disabled(vm.isSubmitting)
                .padding(.horizontal, 20)
                .padding(.bottom, 24)
            }
        }
        .background(Color(.systemGroupedBackground))
    }

    @ViewBuilder
    private func reviewFactRow(label: String, @ViewBuilder value: () -> some View) -> some View {
        HStack(alignment: .firstTextBaseline) {
            Text(label.uppercased())
                .font(.caption2.weight(.bold))
                .kerning(0.8)
                .foregroundStyle(.secondary)
            Spacer()
            value()
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 12)
    }

    private func create() async {
        do {
            let id = try await vm.submit()
            Haptics.success()
            onCreated(id)
            dismiss()
        } catch {
            submitError = error.localizedDescription
            Haptics.warning()
        }
    }

    private func bulkSubtitle(_ sku: FormBulkSku) -> String {
        let unit = sku.unit?.isEmpty == false ? " \(sku.unit!)" : ""
        let pickup = sku.trackByNumber ? " · units scan at pickup" : ""
        return "\(sku.availableQuantity) available\(unit)\(pickup)"
    }
}
