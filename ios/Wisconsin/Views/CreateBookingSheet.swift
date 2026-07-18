import SwiftUI

private enum ReservationSetupMode: String, CaseIterable, Identifiable {
    case event = "Event Linked"
    case manual = "Manual"

    var id: String { rawValue }
}

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
    @State private var setupMode: ReservationSetupMode
    @FocusState private var notesFocused: Bool
    @Environment(SessionStore.self) private var session
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    init(onCreated: @escaping (String) -> Void) {
        _vm = State(wrappedValue: CreateBookingViewModel())
        _setupMode = State(wrappedValue: .event)
        self.onCreated = onCreated
    }

    init(vm: CreateBookingViewModel, onCreated: @escaping (String) -> Void) {
        _vm = State(wrappedValue: vm)
        _setupMode = State(wrappedValue: vm.linkedEventCount > 0 ? .event : .manual)
        self.onCreated = onCreated
    }

    private var canContinueToGear: Bool {
        vm.isValid && (setupMode == .manual || vm.linkedEventCount > 0)
    }

    private var hasUnsavedInput: Bool {
        if !vm.title.trimmingCharacters(in: .whitespaces).isEmpty { return true }
        if !vm.notes.isEmpty { return true }
        if !vm.selectedAssetIds.isEmpty { return true }
        if vm.selectedBulkTotal > 0 { return true }
        if vm.selectedEventIds != initialEventIds { return true }
        // Track auto-filled identity, location, and date deltas so Cancel can
        // warn before losing meaningful setup work.
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
            VStack(spacing: 0) {
                ReservationStepProgress(currentStep: step)
                Group {
                    if step == 1 {
                        detailsForm
                    } else if step == 2 {
                        equipmentPicker
                    } else {
                        reviewStep
                    }
                }
            }
            .navigationTitle(step == 1 ? "New Reservation" : step == 2 ? "Gear" : "Review")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { toolbar }
            .safeAreaInset(edge: .bottom, spacing: 0) {
                if step == 1 {
                    Button {
                        step = 2
                        Task { await vm.loadAvailableAssets(reset: true) }
                        vm.scheduleConflictCheck()
                    } label: {
                        Label("Choose Gear", systemImage: "shippingbox")
                            .fontWeight(.semibold)
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .buttonBorderShape(.capsule)
                    .controlSize(.large)
                    .tint(Color.statusText(.purple))
                    .disabled(!canContinueToGear || vm.isSubmitting)
                    .padding(.horizontal, Brand.Space.md)
                    .padding(.vertical, 10)
                    .background(.bar)
                    .overlay(alignment: .top) { Divider() }
                } else if step == 3 {
                    Button {
                        Task { await create() }
                    } label: {
                        Group {
                            if vm.isSubmitting {
                                ProgressView()
                                    .tint(.white)
                            } else {
                                Text("Create Reservation")
                                    .fontWeight(.semibold)
                            }
                        }
                        .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .buttonBorderShape(.capsule)
                    .controlSize(.large)
                    .tint(Color.statusText(.purple))
                    .disabled(vm.isSubmitting)
                    .padding(.horizontal, Brand.Space.md)
                    .padding(.vertical, 10)
                    .background(.bar)
                    .overlay(alignment: .top) { Divider() }
                }
            }
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
                applySelfAndLocationDefaults()
                captureInitialIfNeeded()
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
                applySelfAndLocationDefaults()
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

    private func applySelfAndLocationDefaults() {
        if let current = session.currentUser,
           vm.options?.users.contains(where: { $0.id == current.id }) == true {
            vm.selectedUserId = current.id
        }
        if vm.selectedLocationId.isEmpty, let defaultLocation = vm.primaryPickupLocations.first {
            vm.selectedLocationId = defaultLocation.id
        }
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
            if step == 2 {
                // Review lives on the cart bar in step 2; the toolbar slot
                // hosts scan so it's always reachable above the keyboard.
                Button {
                    showScanner = true
                } label: {
                    Image(systemName: "barcode.viewfinder")
                }
                .tint(Color.statusText(.purple))
                .accessibilityLabel("Scan equipment")
                .disabled(vm.isSubmitting)
            }
            // Step 3's primary action is anchored above the sheet edge so it
            // remains available while the user checks the summary.
        }
    }

    @ViewBuilder
    private var detailsForm: some View {
        ScrollView {
            VStack(spacing: 18) {
                FormCard {
                    BrandSectionHeader("Set Schedule From")
                    Picker("Schedule source", selection: setupModeBinding) {
                        ForEach(ReservationSetupMode.allCases) { mode in
                            Text(mode.rawValue).tag(mode)
                        }
                    }
                    .pickerStyle(.segmented)
                }

                if setupMode == .event {
                    EventSelectionCard(
                        events: vm.events,
                        selectedEvents: vm.linkedEventsForSetup,
                        isLoading: vm.isLoadingEvents,
                        error: vm.eventError,
                        onRetry: { Task { await vm.loadEvents() } },
                        onToggle: { vm.toggleEvent($0) },
                        onRemove: { vm.removeSelectedEvent($0) }
                    )

                    if vm.linkedEventCount > 0 {
                        reservationTitleCard
                            .transition(detailsTransition)
                        scheduleWindowCard
                            .transition(detailsTransition)
                    }
                } else {
                    reservationTitleCard
                        .transition(detailsTransition)
                    scheduleWindowCard
                        .transition(detailsTransition)
                }

                FormCard {
                    BrandSectionHeader("Pickup Location")
                    if vm.isLoadingOptions {
                        ProgressView()
                            .frame(maxWidth: .infinity, minHeight: 32)
                    } else if vm.primaryPickupLocations.isEmpty {
                        Label("Pickup locations are unavailable", systemImage: "exclamationmark.triangle")
                            .font(.subheadline)
                            .foregroundStyle(Color.statusText(.orange))
                    } else {
                        Picker(
                            "Pickup location",
                            selection: Binding(
                                get: { vm.selectedLocationId },
                                set: { vm.setLocationFromUser($0) }
                            )
                        ) {
                            ForEach(vm.primaryPickupLocations) { location in
                                Text(location.name)
                                    .tag(location.id)
                            }
                        }
                        .pickerStyle(.segmented)
                    }
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
                                .foregroundStyle(Color.statusText(.purple))
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
            .animation(reduceMotion ? nil : .snappy(duration: 0.28), value: setupMode)
            .animation(reduceMotion ? nil : .snappy(duration: 0.28), value: vm.linkedEventCount)
        }
        .background(Color(.systemGroupedBackground))
    }

    private var reservationTitleCard: some View {
        FormCard {
            VStack(alignment: .leading, spacing: 8) {
                Text("Reservation Title")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                TextField(
                    "Reservation name",
                    text: Binding(
                        get: { vm.title },
                        set: { vm.setTitleFromUser($0) }
                    )
                )
                .font(.title3.weight(.semibold))
                .submitLabel(.next)
            }
        }
    }

    private var scheduleWindowCard: some View {
        FormCard {
            BrandSectionHeader("When")
            QuarterHourDatePickerRow(
                label: "Pickup",
                selection: Binding(
                    get: { vm.startsAt },
                    set: { vm.adjustStart(to: $0) }
                )
            )
            Divider().padding(.leading, 4)
            QuarterHourDatePickerRow(
                label: "Return",
                selection: Binding(
                    get: { vm.endsAt },
                    set: { vm.adjustEnd(to: $0) }
                ),
                minimumDate: vm.startsAt
            )
            if vm.endsAt <= vm.startsAt {
                Label("Return must be after pickup", systemImage: "exclamationmark.circle.fill")
                    .font(.caption)
                    .foregroundStyle(Color.statusText(.red))
                    .padding(.top, 6)
            }
        }
    }

    private var detailsTransition: AnyTransition {
        reduceMotion ? .opacity : .opacity.combined(with: .move(edge: .top))
    }

    private var setupModeBinding: Binding<ReservationSetupMode> {
        Binding(
            get: { setupMode },
            set: { mode in
                setupMode = mode
                if mode == .manual {
                    vm.unlinkEvents()
                }
                Haptics.selection()
            }
        )
    }

    private var reviewPickupText: String {
        return vm.startsAt.formatted(.dateTime.weekday(.abbreviated).month(.abbreviated).day().hour().minute())
    }

    private var reviewReturnText: String {
        return vm.endsAt.formatted(.dateTime.weekday(.abbreviated).month(.abbreviated).day().hour().minute())
    }

    @ViewBuilder
    private var equipmentPicker: some View {
        CreateBookingEquipmentPicker(vm: vm) {
            step = 3
        }
    }

    @ViewBuilder
    private var reviewStep: some View {
        ScrollView {
            VStack(spacing: 16) {
                FormCard {
                    HStack(spacing: 12) {
                        StatusRail(tone: .purple)
                        UserAvatarView(
                            name: vm.selectedUser?.name ?? session.currentUser?.name ?? "User",
                            avatarUrl: vm.selectedUser?.avatarUrl ?? session.currentUser?.avatarUrl,
                            size: 46
                        )
                        VStack(alignment: .leading, spacing: 2) {
                            Text(vm.title.isEmpty ? "Review your reservation" : vm.title)
                                .font(.title3.weight(.bold))
                                .lineLimit(2)
                            Text(vm.selectedUser?.name ?? session.currentUser?.name ?? "")
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                        }
                        Spacer(minLength: 0)
                    }
                }

                FormCard {
                    reviewSectionHeader(title: "Schedule", editStep: 1)
                    reviewDetailRow(
                        icon: "arrow.right",
                        tone: .blue,
                        label: "Pickup",
                        value: reviewPickupText
                    )
                    Divider().padding(.leading, 50)
                    reviewDetailRow(
                        icon: "arrow.left",
                        tone: .purple,
                        label: "Return",
                        value: reviewReturnText
                    )
                    Divider().padding(.leading, 50)
                    reviewDetailRow(
                        icon: "mappin.and.ellipse",
                        tone: .gray,
                        label: "Pickup Location",
                        value: vm.selectedLocation?.name ?? ""
                    )
                    if let linked = vm.linkedEventLabel {
                        Divider().padding(.leading, 50)
                        reviewDetailRow(
                            icon: "calendar.badge.checkmark",
                            tone: .green,
                            label: vm.linkedEventCount > 1 ? "Events" : "Event",
                            value: linked
                        )
                    }
                    if !vm.notes.isEmpty {
                        Divider().padding(.leading, 50)
                        reviewDetailRow(
                            icon: "note.text",
                            tone: .gray,
                            label: "Note",
                            value: vm.notes
                        )
                    }
                }

                if !vm.conflictedAssetIds.isEmpty {
                    let count = vm.conflictedAssetIds.count
                    FormCard {
                        HStack(alignment: .top, spacing: 12) {
                            Image(systemName: "exclamationmark.triangle.fill")
                                .foregroundStyle(Color.statusText(.orange))
                                .padding(.top, 2)
                            VStack(alignment: .leading, spacing: 4) {
                                Text("Review \(count) gear conflict\(count == 1 ? "" : "s")")
                                    .font(.subheadline.weight(.semibold))
                                Text("Availability is checked again when you create the reservation.")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            Spacer(minLength: 8)
                            Button("Review Gear") { step = 2 }
                                .buttonStyle(.bordered)
                                .controlSize(.small)
                                .tint(Color.statusText(.orange))
                        }
                    }
                }

                FormCard {
                    reviewSectionHeader(title: "Gear", count: vm.selectedEquipmentCount, editStep: 2)
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
                            .padding(.vertical, 8)
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
                                    if showsBulkSubtitle(sku) {
                                        Text(bulkSubtitle(sku))
                                            .font(.caption)
                                            .foregroundStyle(.secondary)
                                    }
                                }
                                Spacer()
                                Text("×\(vm.quantity(for: sku))")
                                    .font(.subheadline.weight(.semibold))
                                    .monospacedDigit()
                                    .foregroundStyle(.secondary)
                            }
                            .padding(.horizontal, 12)
                            .padding(.vertical, 8)
                        }
                    }
                }
            }
            .padding(20)
        }
        .background(Color(.systemGroupedBackground))
    }

    @ViewBuilder
    private func reviewSectionHeader(title: String, count: Int? = nil, editStep: Int) -> some View {
        HStack {
            Text(title)
                .font(.headline)
            if let count {
                Text("\(count)")
                    .font(.caption.weight(.semibold))
                    .monospacedDigit()
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Button("Edit") { step = editStep }
                .font(.subheadline.weight(.semibold))
                .buttonStyle(.plain)
                .foregroundStyle(Color.statusText(.purple))
        }
        .padding(.bottom, 4)
    }

    @ViewBuilder
    private func reviewDetailRow(
        icon: String,
        tone: StatusTone,
        label: String,
        value: String
    ) -> some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Color.statusText(tone))
                .frame(width: 34, height: 34)
                .background(Color.statusBackground(tone), in: Circle())
            VStack(alignment: .leading, spacing: 2) {
                Text(label)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Text(value)
                    .font(.subheadline.weight(.medium))
                    .monospacedDigit()
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
        }
        .padding(.vertical, 6)
    }

    private func create() async {
        do {
            let id = try await vm.submit()
            Haptics.success()
            onCreated(id)
            dismiss()
        } catch APIError.conflict(_) {
            step = 2
            vm.scheduleConflictCheck()
            Haptics.warning()
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

    private func showsBulkSubtitle(_ sku: FormBulkSku) -> Bool {
        let productContext = [sku.categoryName, sku.category, sku.name]
            .compactMap { $0 }
            .joined(separator: " ")
        return !productContext.localizedCaseInsensitiveContains("battery")
    }
}

private struct QuarterHourDatePickerRow: View {
    let label: String
    @Binding var selection: Date
    var minimumDate: Date? = nil

    private let quarterHours = Array(0..<96)

    private var dateBinding: Binding<Date> {
        Binding(
            get: { selection },
            set: { newDate in
                let calendar = Calendar.current
                let day = calendar.dateComponents([.year, .month, .day], from: newDate)
                let time = calendar.dateComponents([.hour, .minute], from: selection)
                var merged = DateComponents()
                merged.year = day.year
                merged.month = day.month
                merged.day = day.day
                merged.hour = time.hour
                merged.minute = time.minute
                guard let value = calendar.date(from: merged) else { return }
                selection = max(value, minimumDate ?? .distantPast)
            }
        )
    }

    private var quarterBinding: Binding<Int> {
        Binding(
            get: {
                let components = Calendar.current.dateComponents([.hour, .minute], from: selection)
                let minutes = (components.hour ?? 0) * 60 + (components.minute ?? 0)
                return min(95, max(0, Int((Double(minutes) / 15).rounded())))
            },
            set: { quarter in
                let calendar = Calendar.current
                let day = calendar.dateComponents([.year, .month, .day], from: selection)
                var merged = DateComponents()
                merged.year = day.year
                merged.month = day.month
                merged.day = day.day
                merged.hour = (quarter * 15) / 60
                merged.minute = (quarter * 15) % 60
                guard let value = calendar.date(from: merged) else { return }
                selection = max(value, minimumDate ?? .distantPast)
            }
        )
    }

    var body: some View {
        HStack(spacing: 8) {
            Text(label)
                .font(.body)
            Spacer()
            DatePicker(
                "\(label) date",
                selection: dateBinding,
                in: (minimumDate ?? .distantPast)...,
                displayedComponents: .date
            )
            .labelsHidden()
            .fixedSize()

            Picker("\(label) time", selection: quarterBinding) {
                ForEach(quarterHours, id: \.self) { quarter in
                    Text(timeLabel(for: quarter)).tag(quarter)
                }
            }
            .pickerStyle(.menu)
            .fixedSize()
        }
        .frame(minHeight: 44)
        .accessibilityElement(children: .contain)
    }

    private func timeLabel(for quarter: Int) -> String {
        let calendar = Calendar.current
        let start = calendar.startOfDay(for: .now)
        let date = calendar.date(byAdding: .minute, value: quarter * 15, to: start) ?? start
        return date.formatted(date: .omitted, time: .shortened)
    }
}

private struct ReservationStepProgress: View {
    let currentStep: Int

    private let labels = ["Details", "Gear", "Review"]

    var body: some View {
        HStack(spacing: Brand.Space.sm) {
            ForEach(Array(labels.enumerated()), id: \.offset) { index, label in
                let step = index + 1
                HStack(spacing: 6) {
                    Image(systemName: step < currentStep ? "checkmark.circle.fill" : "\(step).circle.fill")
                        .foregroundStyle(step <= currentStep ? Color.statusText(.purple) : Color.secondary)
                    Text(label)
                        .font(.caption.weight(step == currentStep ? .semibold : .regular))
                        .foregroundStyle(step == currentStep ? .primary : .secondary)
                }
                if step < labels.count {
                    Rectangle()
                        .fill(step < currentStep ? Color.statusText(.purple).opacity(0.45) : Color.hairline)
                        .frame(height: 1)
                }
            }
        }
        .padding(.horizontal, Brand.Space.md)
        .padding(.vertical, 10)
        .background(.bar)
        .overlay(alignment: .bottom) { Divider() }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Step \(currentStep) of 3, \(labels[currentStep - 1])")
    }
}
