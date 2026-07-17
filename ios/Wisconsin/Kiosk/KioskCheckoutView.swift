import SwiftUI
import UIKit

private enum KioskCheckoutFocusedField: Hashable {
    case customPurpose
}

private enum KioskCheckoutDefaults {
    static func defaultDueBackDate(now: Date = Date(), calendar: Calendar = .current) -> Date {
        guard let tomorrow = calendar.date(byAdding: .day, value: 1, to: now) else {
            return now.addingTimeInterval(24 * 60 * 60)
        }
        return calendar.date(bySettingHour: 9, minute: 0, second: 0, of: tomorrow)
            ?? now.addingTimeInterval(24 * 60 * 60)
    }
}

private enum KioskCheckoutSetupLayout {
    /// Keep the setup bounded on the managed M2 iPad Air fleet so Context and
    /// Return remain a stable two-column task instead of sprawling edge to edge.
    static let maxWidth: CGFloat = 1048
    static let contextColumnWidth: CGFloat = 376
    static let returnColumnWidth: CGFloat = 648
    static let returnDateWidth: CGFloat = 390
    static let returnTimeWidth: CGFloat = 176
}

struct KioskCheckoutView: View {
    @Environment(KioskStore.self) private var store
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    let user: KioskUser

    @State private var lastResult: ScanFeedback?
    @State private var isCompleting = false
    @State private var showBackConfirm = false
    @State private var showCamera = false
    @State private var eventOptions: [KioskCheckoutEvent] = []
    @State private var isLoadingEvents = false
    @State private var eventLoadError: String?
    @State private var isLinkedToEvent = false
    @State private var selectedEventId: String?
    @State private var customPurpose = ""
    @State private var checkoutContextReady = true
    @State private var scannerCaptureEnabled = true
    @State private var showDetailsSheet = false
    @State private var scannerHasFocus = false
    @State private var showScannerHelp = false
    @State private var showEditContextConfirm = false
    @State private var lastScanAt: Date?
    @State private var pendingScanIdentities: Set<String> = []
    @State private var dueBackAt = KioskCheckoutDefaults.defaultDueBackDate()
    @State private var availabilityResult = KioskCheckoutAvailabilityResult()
    @State private var isCheckingAvailability = false
    @State private var availabilityError: String?
    @State private var hasVerifiedAvailability = false
    @State private var availabilityRequests = LatestRequestGeneration()
    // Plain @State on purpose — NOT @FocusState. The booking-name field is a
    // UIKit-backed KioskNativeTextField, invisible to SwiftUI's focus system,
    // so no view ever claims a @FocusState value for it. SwiftUI then resets
    // the value to nil on its next focus pass, and the stale binding makes
    // KioskNativeTextField force-resign the field the instant it is tapped —
    // the keyboard dies before a single character can be typed. Plain @State
    // is the source of truth the UIKit delegate writes into (same pattern as
    // KioskCheckoutDetailSheet's titleFocused/scanFocused).
    @State private var focusedCheckoutField: KioskCheckoutFocusedField? = nil

    enum ScanFeedback: Equatable {
        case success(String)
        case error(String)
        case duplicate(String)
        case warning(String)

        var message: String {
            switch self {
            case .success(let s), .error(let s), .duplicate(let s), .warning(let s): return s }
        }

        var tone: KioskBannerTone {
            switch self {
            case .success:   .success
            case .error:     .error
            case .duplicate, .warning: .warning
            }
        }
    }

    /// Cart lives in KioskStore so a brief inactivity reset doesn't discard it.
    private var userId: String { user.id }
    private var scannedItems: [KioskCartItem] { store.cart(for: userId) }
    private var groupedScannedItems: [KioskCartDisplayGroup] {
        KioskCartDisplayGroup.groups(from: scannedItems)
    }
    private var shouldListenForHIDScans: Bool {
        scannerCaptureEnabled && focusedCheckoutField == nil && !showCamera && !showScannerHelp && !showEditContextConfirm && !showDetailsSheet
    }

    var body: some View {
        checkoutLayout
        .overlay(alignment: .bottom) {
            if scannerCaptureEnabled {
                // Hidden HID scanner field stays mounted in scan mode, but yields
                // first responder whenever visible checkout inputs need the keyboard.
                HIDScannerField(
                    isEnabled: shouldListenForHIDScans,
                    onScan: { store.scanner.receive($0) },
                    onFocusChange: { scannerHasFocus = $0 }
                )
                .frame(width: 1, height: 1)
                .opacity(0)
            }
        }
        .confirmationDialog(
            "Discard \(scannedItems.count) scanned item\(scannedItems.count == 1 ? "" : "s")?",
            isPresented: $showBackConfirm,
            titleVisibility: .visible
        ) {
            Button("Discard", role: .destructive) {
                store.clearCart(for: userId)
                store.clearCheckoutDraft(for: userId)
                Haptics.warning()
                store.screen = .studentHub(user)
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Going back will clear your scans.")
        }
        .confirmationDialog(
            "Edit checkout details?",
            isPresented: $showEditContextConfirm,
            titleVisibility: .visible
        ) {
            Button("Edit Details") {
                checkoutContextReady = false
                DispatchQueue.main.async {
                    focusedCheckoutField = .customPurpose
                }
                Haptics.warning()
            }
            Button("Keep Scanning", role: .cancel) {}
        } message: {
            Text("Your scanned items will stay in the cart.")
        }
        .sheet(isPresented: $showCamera) {
            KioskBarcodeCameraView(
                feedbackMessage: lastResult?.message,
                feedbackTone: lastResult?.tone,
                onScan: { value in
                    handleScan(value)
                },
                onCancel: { showCamera = false }
            )
        }
        .sheet(isPresented: $showScannerHelp) {
            KioskScannerTroubleshootingSheet(
                lastScanAt: lastScanAt,
                locationName: store.info?.locationName,
                onCamera: {
                    showScannerHelp = false
                    showCamera = true
                }
            )
        }
        .sheet(isPresented: $showDetailsSheet) {
            VStack(spacing: 16) {
                HStack {
                    Text("Checkout Details").font(.title2.bold()).foregroundStyle(KioskText.primary)
                    Spacer()
                    Button("Done") { startScanning() }
                }
                checkoutSetupPanel
                KioskCompletionButton(
                    title: "Save Details",
                    isEnabled: hasCheckoutContext && hasValidReturnTime,
                    isBusy: false,
                    accessibilityLabel: startScanningAccessibilityLabel,
                    action: startScanning
                )
            }
            .padding(28)
            .background(KioskSurface.base)
            .presentationDetents([.large])
        }
        .task {
            restoreDraftIfNeeded()
            applyRetainedIntent()
            store.scanner.claim(.checkout) { handleScan($0) }
            await loadCheckoutEvents()
            applySelectedEventDueTime()
        }
        .onChange(of: selectedEventId) { _, _ in
            applySelectedEventDueTime()
            persistDraft()
        }
        .onChange(of: isLinkedToEvent) { _, linked in
            if linked {
                customPurpose = ""
                applySelectedEventDueTime()
            } else {
                selectedEventId = nil
                DispatchQueue.main.async {
                    focusedCheckoutField = .customPurpose
                }
            }
            persistDraft()
        }
        .onChange(of: customPurpose) { _, _ in persistDraft() }
        .onChange(of: dueBackAt) { _, _ in
            persistDraft()
            guard checkoutContextReady, !scannedItems.isEmpty else { return }
            Task { await refreshAvailability(for: scannedItems) }
        }
        .onChange(of: focusedCheckoutField) { _, field in
            store.scanner.setEditing(field != nil)
        }
        .onChange(of: checkoutContextReady) { _, isReady in
            if !isReady {
                scannerCaptureEnabled = false
            }
            persistDraft()
        }
        .onDisappear {
            availabilityRequests.invalidate()
            isCheckingAvailability = false
            scannerCaptureEnabled = false
            store.scanner.setEditing(false)
            store.scanner.release(.checkout)
        }
    }

    // MARK: - Scan Zone

    private var checkoutLayout: some View {
        KioskAdaptiveSplit { _ in
            activeScanZone
        } secondary: { isCompact in
            itemsList(isCompact: isCompact)
        }
    }

    /// Setup stays focused before scan mode: a pinned flow header, one centered
    /// details panel, and a pinned Start Scanning CTA.
    private var checkoutContextSetupZone: some View {
        VStack(spacing: 0) {
            KioskFlowHeader(
                title: "Checkout Details",
                backAccessibilityLabel: "Back to roster",
                onBack: {
                    if scannedItems.isEmpty {
                        store.screen = .studentHub(user)
                    } else {
                        showBackConfirm = true
                    }
                },
                onCamera: nil
            )

            Group {
                if focusedCheckoutField == nil {
                    ViewThatFits(in: .vertical) {
                        checkoutSetupPanel

                        ScrollView {
                            checkoutSetupPanel
                        }
                        .scrollBounceBehavior(.basedOnSize)
                    }
                } else {
                    ScrollView {
                        checkoutSetupPanel
                    }
                    .scrollBounceBehavior(.basedOnSize)
                    .scrollDismissesKeyboard(.interactively)
                }
            }
            .frame(maxHeight: .infinity, alignment: .top)

            KioskCompletionButton(
                title: "Start Scanning",
                isEnabled: hasCheckoutContext && hasValidReturnTime,
                isBusy: false,
                accessibilityLabel: startScanningAccessibilityLabel,
                action: startScanning
            )
            .frame(maxWidth: KioskCheckoutSetupLayout.maxWidth)
            .frame(maxWidth: .infinity)
            .padding(.top, KioskSpacing.md)
        }
        .kioskScreenPadding()
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var checkoutSetupPanel: some View {
        KioskCheckoutSetupPanel(
            user: user,
            locationName: store.info?.locationName,
            events: eventOptions,
            isLoadingEvents: isLoadingEvents,
            eventLoadError: eventLoadError,
            isLinkedToEvent: $isLinkedToEvent,
            selectedEventId: $selectedEventId,
            customPurpose: $customPurpose,
            dueBackAt: $dueBackAt,
            selectedEvent: selectedEvent,
            focusedField: $focusedCheckoutField,
            onScannerBurstRejected: {
                store.scanner.rejectEditingBurst()
                showFeedback(.warning("Finish editing before scanning"))
            }
        )
        .frame(maxWidth: KioskCheckoutSetupLayout.maxWidth)
        .frame(maxWidth: .infinity)
        .padding(.vertical, KioskSpacing.lg)
    }

    private var activeScanZone: some View {
        KioskScanZoneColumn {
            KioskFlowHeader(
                title: "Scan Items",
                backAccessibilityLabel: scannedItems.isEmpty
                    ? "Back to roster"
                    : "Back to roster, will prompt to discard \(scannedItems.count) items",
                onBack: {
                    if scannedItems.isEmpty {
                        store.screen = .studentHub(user)
                    } else {
                        showBackConfirm = true
                    }
                },
                onCamera: { showCamera = true }
            )

            KioskCheckoutContextSummary(
                title: hasCheckoutContext ? checkoutContextTitle : "Details needed",
                detail: hasCheckoutContext ? checkoutContextDetail : "Keep scanning, then review before checkout.",
                dueBackAt: dueBackAt,
                onEdit: {
                    showDetailsSheet = true
                }
            )

            KioskCheckoutAvailabilityBanner(
                result: availabilityResult,
                isChecking: isCheckingAvailability,
                errorMessage: availabilityError
            )

            Spacer()

            // Scanner indicator
            VStack(spacing: 16) {
                KioskScanTarget(tint: scannerBorderColor)

                Text("Scan items to add")
                    .font(.subheadline)
                    .foregroundStyle(KioskText.secondary)
                Text("Or tap Camera if no scanner is connected")
                    .font(.caption)
                    .foregroundStyle(KioskText.muted)

                KioskScannerReadinessBadge(
                    isReady: scannerHasFocus,
                    lastScanAt: lastScanAt,
                    onTap: { showScannerHelp = true }
                )
            }

            // Feedback banner
            if let result = lastResult {
                KioskFeedbackBanner(tone: result.tone, message: result.message)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                    .animation(reduceMotion ? nil : .spring(response: 0.3), value: lastResult)
            }

            Spacer()

            KioskCompletionButton(
                title: hasCheckoutContext && hasValidReturnTime ? completeButtonTitle : "Review Details",
                isEnabled: !scannedItems.isEmpty && pendingScanIdentities.isEmpty && (!hasCheckoutContext || !hasValidReturnTime || (hasVerifiedAvailability && !isCheckingAvailability && availabilityError == nil && !availabilityResult.hasBlockingIssue)),
                isBusy: isCompleting,
                accessibilityLabel: completeAccessibilityLabel,
                action: {
                    if hasCheckoutContext && hasValidReturnTime { completeCheckout() }
                    else { showDetailsSheet = true }
                }
            )
        }
    }

    private var completeAccessibilityLabel: String {
        if isCompleting { return "Processing checkout" }
        if !pendingScanIdentities.isEmpty {
            return "Complete Checkout unavailable, waiting for \(pendingScanIdentities.count) scan\(pendingScanIdentities.count == 1 ? "" : "s")"
        }
        let count = scannedItems.count
        if !hasCheckoutContext {
            return "Complete Checkout unavailable, choose an event or enter what this checkout is for"
        }
        if availabilityResult.hasBlockingIssue {
            return "Complete Checkout unavailable, resolve item conflicts first"
        }
        return "Checkout \(count) item\(count == 1 ? "" : "s")"
    }

    private var completeButtonTitle: String {
        let count = scannedItems.count
        guard count > 0 else { return "Complete Checkout" }
        return "Checkout \(count) Item\(count == 1 ? "" : "s")"
    }

    // MARK: - Items List

    private func itemsList(isCompact: Bool) -> some View {
        KioskSideRail(isCompact: isCompact) {
            KioskCheckoutSideSummary(
                user: user,
                locationName: store.info?.locationName,
                contextTitle: hasCheckoutContext ? checkoutContextTitle : nil,
                contextDetail: checkoutContextDetail
            )

            Divider().background(KioskStroke.divider)

            HStack {
                Text("Scanned Items")
                    .font(.headline)
                    .foregroundStyle(KioskText.primary)
                Spacer()
                Text("\(scannedItems.count)")
                    .font(.title3.bold())
                    .foregroundStyle(scannedItems.isEmpty ? .secondary : Color.kioskRed)
                    .contentTransition(.numericText())
                    .animation(reduceMotion ? nil : .easeInOut(duration: 0.25), value: scannedItems.count)
                    .monospacedDigit()
            }
            .padding(20)

            Divider().background(KioskStroke.divider)

            if scannedItems.isEmpty {
                Spacer()
                VStack(spacing: 10) {
                    Image(systemName: "photo.on.rectangle.angled")
                        .font(.title3)
                        .foregroundStyle(KioskText.muted)
                        .accessibilityHidden(true)
                    Text("No items scanned yet")
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(KioskText.secondary)
                }
                .frame(maxWidth: .infinity, alignment: .center)
                Spacer()
            } else {
                ScrollViewReader { proxy in
                    ScrollView {
                        LazyVStack(spacing: 0) {
                            ForEach(Array(groupedScannedItems.enumerated()), id: \.element.id) { index, group in
                                KioskCartGroupRow(
                                    group: group,
                                    availabilityIssue: availabilityIssue(for: group),
                                    onRemove: { removeGroup(group) }
                                )
                                .id(group.id)
                                .background(group.contains(scannedItems.last) ? KioskSurface.sunken : Color.clear)
                                Divider().background(KioskStroke.hairline)
                            }
                        }
                    }
                    .onChange(of: scannedItems.last?.id) { _, newId in
                        guard let newId else { return }
                        if reduceMotion {
                            proxy.scrollTo(newId, anchor: .bottom)
                        } else {
                            withAnimation(.easeOut(duration: 0.25)) {
                                proxy.scrollTo(newId, anchor: .bottom)
                            }
                        }
                    }
                }
            }
        }
    }

    // MARK: - Logic

    private var scannerBorderColor: Color {
        switch lastResult {
        case .success: return Color.statusText(.green)
        case .error: return Color.statusText(.red)
        case .duplicate, .warning: return Color.statusText(.orange)
        // Readiness is already explicit in the badge below the target. Keep
        // the target neutral during the brief first-responder handoff so the
        // scan screen does not enter with a false orange warning flash.
        case nil: return Color.white.opacity(0.3)
        }
    }

    private var trimmedCustomPurpose: String {
        customPurpose.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var hasCheckoutContext: Bool {
        isLinkedToEvent ? selectedEvent != nil : !trimmedCustomPurpose.isEmpty
    }

    private var hasValidReturnTime: Bool {
        dueBackAt > Date().addingTimeInterval(60)
    }

    private var startScanningAccessibilityLabel: String {
        if isLinkedToEvent, selectedEvent == nil {
            return "Start Scanning unavailable, select an event"
        }
        if !isLinkedToEvent, trimmedCustomPurpose.isEmpty {
            return "Start Scanning unavailable, enter checkout details"
        }
        if !hasValidReturnTime {
            return "Start Scanning unavailable, choose a return time later than pickup"
        }
        return "Start scanning items"
    }

    private var selectedEvent: KioskCheckoutEvent? {
        guard let selectedEventId else { return nil }
        return eventOptions.first { $0.id == selectedEventId }
    }

    private var checkoutContextTitle: String {
        isLinkedToEvent ? (selectedEvent?.title ?? "") : trimmedCustomPurpose
    }

    private var checkoutContextDetail: String? {
        if isLinkedToEvent, let selectedEvent {
            return KioskCheckoutEventFormat.subtitle(selectedEvent)
        }
        return nil
    }

    private var successMessage: String {
        let count = scannedItems.count
        let itemWord = count == 1 ? "item" : "items"
        let location = store.info?.locationName ?? "this kiosk"
        return "Checked out \(count) \(itemWord) for \(checkoutContextTitle) from \(location)."
    }

    @MainActor
    private func loadCheckoutEvents() async {
        guard eventOptions.isEmpty, !isLoadingEvents else { return }
        isLoadingEvents = true
        eventLoadError = nil
        do {
            eventOptions = try await KioskAPI.shared.kioskCheckoutEvents()
        } catch {
            eventLoadError = (error as? APIError)?.errorDescription ?? "Events unavailable"
        }
        isLoadingEvents = false
    }

    private func handleScan(_ value: String) {
        // Ignore scans during the complete-API window — a late scan would
        // land in the cart but miss the assetIds payload, then get wiped on
        // success. Phantom checkouts are worse than a "hold on" feedback.
        guard !isCompleting else {
            showFeedback(.error("Hold on — finishing checkout"))
            return
        }

        store.resetInactivity()
        lastScanAt = Date()

        let normalizedScan = value.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !normalizedScan.isEmpty else {
            showFeedback(.error("Could not read barcode"))
            return
        }

        let cart = store.cart(for: userId)

        // Treat a scan as owned from intake through response so a rapid repeat
        // cannot start a second request before the first item reaches the cart.
        if pendingScanIdentities.contains(normalizedScan)
            || cart.contains(where: { $0.tagName.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() == normalizedScan }) {
            showFeedback(.duplicate("Already scanned"))
            return
        }
        pendingScanIdentities.insert(normalizedScan)

        Task {
            defer { pendingScanIdentities.remove(normalizedScan) }
            do {
                let result = try await KioskAPI.shared.kioskCheckoutScan(actorId: userId, scanValue: value)
                if result.success, let item = result.item {
                    // Merge into current MainActor state, not the cart snapshot
                    // captured before this request. Parallel scans may complete
                    // in either order and must never overwrite one another.
                    var updated = store.cart(for: userId)
                    if !updated.contains(where: { $0.id == item.id }) {
                        updated.append(KioskCartItem(
                            id: item.id,
                            name: item.name,
                            tagName: item.tagName,
                            type: item.type,
                            imageUrl: item.imageUrl,
                            bulkSkuId: item.bulkSkuId,
                            unitNumber: item.unitNumber
                        ))
                        store.setCart(updated, for: userId)
                        await refreshAvailability(for: updated)
                        if result.locationMismatch == true {
                            showFeedback(.warning(result.locationMessage ?? "\(item.name) added, location checked"))
                        } else {
                            showFeedback(.success(result.locationMessage ?? item.name))
                        }
                    } else {
                        showFeedback(.duplicate("Already scanned"))
                    }
                } else {
                    showFeedback(.error(result.error ?? "Could not add item"))
                }
            } catch {
                let message = (error as? APIError)?.errorDescription ?? "Scan failed"
                showFeedback(.error(message))
            }
        }
    }

    private func removeItem(_ item: KioskCartItem) {
        var cart = store.cart(for: userId)
        cart.removeAll { $0.id == item.id }
        store.setCart(cart, for: userId)
        Task { await refreshAvailability(for: cart) }
        Haptics.warning()
        store.resetInactivity()
        UIAccessibility.post(notification: .announcement, argument: "Removed \(item.itemListPrimaryTitle)")
    }

    private func removeGroup(_ group: KioskCartDisplayGroup) {
        var cart = store.cart(for: userId)
        let groupIds = Set(group.items.map(\.id))
        cart.removeAll { groupIds.contains($0.id) }
        store.setCart(cart, for: userId)
        Task { await refreshAvailability(for: cart) }
        Haptics.warning()
        store.resetInactivity()
        UIAccessibility.post(notification: .announcement, argument: "Removed \(group.primaryTitle)")
    }

    private func showFeedback(_ feedback: ScanFeedback) {
        withAnimation { lastResult = feedback }
        // Tactile + spoken signal so the staffer doesn't need to read the
        // banner — ankle-deep in a noisy floor environment.
        switch feedback {
        case .success: Haptics.success()
        case .duplicate, .warning: Haptics.warning()
        case .error: Haptics.error()
        }
        UIAccessibility.post(notification: .announcement, argument: feedback.message)
        Task {
            try? await Task.sleep(nanoseconds: 3_000_000_000)
            withAnimation { lastResult = nil }
        }
    }

    private func startScanning() {
        guard hasCheckoutContext, hasValidReturnTime else { return }
        focusedCheckoutField = nil
        scannerCaptureEnabled = false
        HIDScannerFocusGate.allowScannerFocusNow()
        UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
        checkoutContextReady = true
        showDetailsSheet = false
        store.resetInactivity()
        Haptics.success()
        DispatchQueue.main.async {
            HIDScannerFocusGate.allowScannerFocusNow()
            scannerCaptureEnabled = true
        }
    }

    private func requestEditContext() {
        scannerCaptureEnabled = false
        if scannedItems.isEmpty {
            checkoutContextReady = false
            DispatchQueue.main.async {
                focusedCheckoutField = .customPurpose
            }
        } else {
            showEditContextConfirm = true
        }
    }

    /// The scan flow already confirms each item as it's added, so checkout
    /// completes directly here — no redundant review modal. A final
    /// availability check still guards against conflicts that appeared while
    /// the cart was open.
    private func completeCheckout() {
        let cart = store.cart(for: userId)
        guard !cart.isEmpty, hasCheckoutContext, hasValidReturnTime, let locationId = store.info?.locationId else { return }
        guard !isCompleting, pendingScanIdentities.isEmpty else { return }
        let message = successMessage
        let endsAt = dueBackAt
        let eventId = isLinkedToEvent ? selectedEvent?.id : nil
        let purpose = !isLinkedToEvent && !trimmedCustomPurpose.isEmpty ? trimmedCustomPurpose : nil
        isCompleting = true
        Task {
            guard let preflight = await refreshAvailability(for: cart, endsAt: endsAt) else {
                isCompleting = false
                showFeedback(.error(availabilityError ?? "Verify item availability before checkout"))
                return
            }
            guard !preflight.hasBlockingIssue else {
                isCompleting = false
                showFeedback(.error("Resolve item conflicts before checkout"))
                return
            }
            do {
                try await KioskAPI.shared.kioskCheckoutComplete(
                    actorId: userId,
                    locationId: locationId,
                    items: cart,
                    eventId: eventId,
                    customPurpose: purpose,
                    endsAt: endsAt
                )
                Haptics.success()
                store.clearCart(for: userId)
                store.clearCheckoutDraft(for: userId)
                store.clearIntent(reason: .success)
                scannerCaptureEnabled = false
                store.screen = .success(KioskSuccessInfo(kind: .checkout, message: message))
            } catch {
                let message = (error as? APIError)?.errorDescription
                    ?? "Checkout failed. Please try again."
                showFeedback(.error(message))
            }
            isCompleting = false
        }
    }

    private func applySelectedEventDueTime() {
        guard isLinkedToEvent else { return }
        guard let selectedEvent, let eventEnd = selectedEvent.endsAt else { return }
        if eventEnd > Date().addingTimeInterval(60) {
            dueBackAt = eventEnd
        }
    }

    private func restoreDraftIfNeeded() {
        guard let draft = store.checkoutDraft(for: userId) else { return }
        isLinkedToEvent = draft.isLinkedToEvent
        selectedEventId = draft.selectedEventId
        customPurpose = draft.customPurpose
        dueBackAt = max(draft.dueBackAt, Date().addingTimeInterval(5 * 60))
        checkoutContextReady = true
        armScannerCaptureAfterRestore()
    }

    private func applyRetainedIntent() {
        guard var intent = store.pendingIntent, intent.identifiedUser?.id == user.id else { return }
        if let event = intent.selectedEvent {
            isLinkedToEvent = true
            selectedEventId = event.id
            if let end = event.endsAt, end > Date().addingTimeInterval(60) { dueBackAt = end }
        }
        let consumed = KioskFlowIntentReducer.consumePendingScans(in: intent)
        intent = consumed.intent
        store.setIntent(intent)
        for scan in consumed.scans { handleScan(scan) }
    }

    private func persistDraft() {
        store.setCheckoutDraft(
            KioskCheckoutDraft(
                isLinkedToEvent: isLinkedToEvent,
                selectedEventId: selectedEventId,
                customPurpose: customPurpose,
                dueBackAt: dueBackAt,
                contextReady: checkoutContextReady
            ),
            for: userId
        )
    }

    private func armScannerCaptureAfterRestore() {
        DispatchQueue.main.async {
            HIDScannerFocusGate.allowScannerFocusNow()
            scannerCaptureEnabled = true
        }
    }

    @MainActor
    @discardableResult
    private func refreshAvailability(
        for cart: [KioskCartItem],
        endsAt requestedEndsAt: Date? = nil
    ) async -> KioskCheckoutAvailabilityResult? {
        let requestToken = availabilityRequests.begin()
        guard let locationId = store.info?.locationId, !cart.isEmpty else {
            availabilityResult = KioskCheckoutAvailabilityResult()
            availabilityError = nil
            hasVerifiedAvailability = false
            isCheckingAvailability = false
            return nil
        }
        let endsAt = requestedEndsAt ?? dueBackAt
        guard endsAt > Date().addingTimeInterval(60) else {
            availabilityResult = KioskCheckoutAvailabilityResult()
            availabilityError = "Choose a return time later than pickup"
            hasVerifiedAvailability = false
            isCheckingAvailability = false
            return nil
        }

        isCheckingAvailability = true
        hasVerifiedAvailability = false
        availabilityError = nil
        defer {
            if availabilityRequests.owns(requestToken) { isCheckingAvailability = false }
        }
        do {
            let result = try await KioskAPI.shared.kioskCheckoutAvailability(
                locationId: locationId,
                items: cart,
                startsAt: Date(),
                endsAt: endsAt
            )
            guard availabilityRequests.owns(requestToken) else { return nil }
            availabilityResult = result
            hasVerifiedAvailability = true
            return result
        } catch {
            guard availabilityRequests.owns(requestToken) else { return nil }
            availabilityError = (error as? APIError)?.errorDescription ?? "Conflict check unavailable"
            availabilityResult = KioskCheckoutAvailabilityResult()
            hasVerifiedAvailability = false
            return nil
        }
    }

    private func availabilityIssue(for group: KioskCartDisplayGroup) -> KioskCartAvailabilityIssue? {
        let ids = Set(group.items.map(\.id))
        let bulkSkuIds = Set(group.items.compactMap(\.bulkSkuId))

        if availabilityResult.unavailableAssets.contains(where: { ids.contains($0.assetId) }) {
            return KioskCartAvailabilityIssue(tone: .error, message: "Unavailable")
        }
        if availabilityResult.conflicts.contains(where: { ids.contains($0.assetId) }) {
            return KioskCartAvailabilityIssue(tone: .error, message: "Conflict")
        }
        if availabilityResult.shortages.contains(where: { bulkSkuIds.contains($0.bulkSkuId) }) {
            return KioskCartAvailabilityIssue(tone: .error, message: "Short")
        }
        if availabilityResult.turnaroundRisks.contains(where: { ids.contains($0.assetId) }) ||
            availabilityResult.bulkTurnaroundRisks.contains(where: { bulkSkuIds.contains($0.bulkSkuId) }) {
            return KioskCartAvailabilityIssue(tone: .warning, message: "Tight turn")
        }
        return nil
    }
}

// MARK: - Sub-views

private struct KioskCartDisplayGroup: Identifiable, Equatable {
    let id: String
    var items: [KioskCartItem]

    var first: KioskCartItem { items[0] }
    var isBulkGroup: Bool { first.isNumberedBulk }
    var count: Int { items.count }
    var primaryTitle: String {
        guard isBulkGroup else { return first.itemListPrimaryTitle }
        let tags = unitNumbers.map { "#\($0)" }.joined(separator: " ")
        return tags.nonBlankText ?? first.itemListPrimaryTitle
    }
    var subtitle: String {
        if isBulkGroup {
            let name = first.name.replacingOccurrences(of: #" #\d+$"#, with: "", options: .regularExpression)
            return "\(name) · \(count) unit\(count == 1 ? "" : "s")"
        }
        return [first.itemListSecondaryTitle, first.type].compactMap { value in
            guard let value, !value.isEmpty else { return nil }
            return value
        }.joined(separator: " · ")
    }
    var unitNumbers: [Int] {
        items.compactMap(\.unitNumber).sorted()
    }

    func contains(_ item: KioskCartItem?) -> Bool {
        guard let item else { return false }
        return items.contains { $0.id == item.id }
    }

    static func groups(from items: [KioskCartItem]) -> [KioskCartDisplayGroup] {
        var groups: [KioskCartDisplayGroup] = []
        var bulkIndex: [String: Int] = [:]

        for item in items {
            if let bulkSkuId = item.bulkSkuId {
                if let index = bulkIndex[bulkSkuId] {
                    groups[index].items.append(item)
                } else {
                    bulkIndex[bulkSkuId] = groups.count
                    groups.append(KioskCartDisplayGroup(id: "bulk-\(bulkSkuId)", items: [item]))
                }
            } else {
                groups.append(KioskCartDisplayGroup(id: item.id, items: [item]))
            }
        }

        return groups
    }
}

private struct KioskCartAvailabilityIssue: Equatable {
    enum Tone {
        case warning
        case error
    }

    let tone: Tone
    let message: String

    var color: Color {
        switch tone {
        case .warning: Color.statusText(.orange)
        case .error: Color.statusText(.red)
        }
    }
}

private struct KioskCheckoutSetupPanel: View {
    let user: KioskUser
    let locationName: String?
    let events: [KioskCheckoutEvent]
    let isLoadingEvents: Bool
    let eventLoadError: String?
    @Binding var isLinkedToEvent: Bool
    @Binding var selectedEventId: String?
    @Binding var customPurpose: String
    @Binding var dueBackAt: Date
    let selectedEvent: KioskCheckoutEvent?
    let focusedField: Binding<KioskCheckoutFocusedField?>
    let onScannerBurstRejected: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: KioskSpacing.lg) {
            KioskCheckoutSetupHero(user: user, locationName: locationName)

            ViewThatFits(in: .horizontal) {
                HStack(alignment: .top, spacing: KioskSpacing.lg) {
                    contextWindow
                        .frame(width: KioskCheckoutSetupLayout.contextColumnWidth, alignment: .top)
                    returnWindow
                        .frame(width: KioskCheckoutSetupLayout.returnColumnWidth, alignment: .top)
                }

                VStack(alignment: .leading, spacing: KioskSpacing.lg) {
                    contextWindow
                    returnWindow
                }
            }
        }
        .accessibilityElement(children: .contain)
    }

    private var contextWindow: some View {
        KioskCheckoutContextWindow(
            events: events,
            isLoading: isLoadingEvents,
            errorMessage: eventLoadError,
            isLinkedToEvent: $isLinkedToEvent,
            selectedEventId: $selectedEventId,
            selectedEvent: selectedEvent,
            customPurpose: $customPurpose,
            focusedField: focusedField,
            onScannerBurstRejected: onScannerBurstRejected
        )
    }

    private var returnWindow: some View {
        KioskCheckoutReturnWindow(dueBackAt: $dueBackAt)
    }
}

private struct KioskCheckoutSetupHero: View {
    let user: KioskUser
    let locationName: String?

    var body: some View {
        HStack(spacing: 18) {
            KioskAvatar(url: user.avatarUrl, initials: user.initials, size: 64)

            VStack(alignment: .leading, spacing: 4) {
                Text("CHECKOUT SETUP")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(KioskText.muted)
                Text(user.name)
                    .font(.kioskScreenTitle(size: 28))
                    .foregroundStyle(KioskText.primary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
                Text(locationName ?? "Kiosk location")
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(KioskText.secondary)
                    .lineLimit(1)
            }

            Spacer()
        }
        .padding(24)
        .kioskCard(KioskSurface.card, radius: KioskRadius.lg, stroke: KioskStroke.standard)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(user.name), \(locationName ?? "kiosk location")")
    }
}

private struct KioskCheckoutWindow<Content: View, Trailing: View>: View {
    let title: String
    let badgeTitle: String?
    let badgeColor: Color
    private let trailing: Trailing
    private let content: Content

    init(
        title: String,
        badgeTitle: String? = nil,
        badgeColor: Color = KioskText.muted,
        @ViewBuilder trailing: () -> Trailing,
        @ViewBuilder content: () -> Content
    ) {
        self.title = title
        self.badgeTitle = badgeTitle
        self.badgeColor = badgeColor
        self.trailing = trailing()
        self.content = content()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(alignment: .center, spacing: 10) {
                Text(title)
                    .font(.title3.weight(.bold))
                    .foregroundStyle(KioskText.primary)

                if let badgeTitle {
                    KioskCheckoutModeBadge(title: badgeTitle, color: badgeColor)
                }

                Spacer(minLength: 12)
                trailing
            }

            content
        }
        .padding(20)
        .kioskCard(KioskSurface.card, radius: KioskRadius.lg, stroke: KioskStroke.standard)
        .accessibilityElement(children: .contain)
    }
}

private extension KioskCheckoutWindow where Trailing == EmptyView {
    init(
        title: String,
        badgeTitle: String? = nil,
        badgeColor: Color = KioskText.muted,
        @ViewBuilder content: () -> Content
    ) {
        self.init(
            title: title,
            badgeTitle: badgeTitle,
            badgeColor: badgeColor,
            trailing: { EmptyView() },
            content: content
        )
    }
}

private struct KioskCheckoutModeBadge: View {
    let title: String
    let color: Color

    var body: some View {
        Text(title)
            .font(.caption2.weight(.bold))
            .foregroundStyle(color)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(color.opacity(0.16), in: Capsule())
    }
}

private struct KioskCheckoutContextWindow: View {
    let events: [KioskCheckoutEvent]
    let isLoading: Bool
    let errorMessage: String?
    @Binding var isLinkedToEvent: Bool
    @Binding var selectedEventId: String?
    let selectedEvent: KioskCheckoutEvent?
    @Binding var customPurpose: String
    let focusedField: Binding<KioskCheckoutFocusedField?>
    let onScannerBurstRejected: () -> Void

    var body: some View {
        KioskCheckoutWindow(
            title: "Context",
            trailing: {
                Toggle("Link to event", isOn: $isLinkedToEvent)
                    .toggleStyle(.switch)
                    .tint(Color.kioskRed)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(KioskText.secondary)
                    .fixedSize()
            }
        ) {
            if isLinkedToEvent {
                VStack(alignment: .leading, spacing: 12) {
                    HStack {
                        Text("Upcoming events")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(KioskText.secondary)
                        Spacer()
                        if !events.isEmpty {
                            eventMenu
                        }
                    }

                    if isLoading {
                        KioskCheckoutEventLoadingRow()
                    } else if events.isEmpty {
                        KioskCheckoutEmptyEventRow()
                    } else {
                        VStack(spacing: 0) {
                            ForEach(featuredEvents) { event in
                                KioskCheckoutEventRow(
                                    event: event,
                                    isSelected: selectedEventId == event.id,
                                    subtitle: KioskCheckoutEventFormat.subtitle(event)
                                ) {
                                    selectedEventId = event.id
                                }

                                if event.id != featuredEvents.last?.id {
                                    Divider().background(KioskStroke.divider)
                                }
                            }
                        }
                        .background(KioskSurface.sunken, in: RoundedRectangle(cornerRadius: KioskRadius.md))
                        .overlay(
                            RoundedRectangle(cornerRadius: KioskRadius.md)
                                .stroke(KioskStroke.hairline, lineWidth: 1)
                        )
                    }

                    if let errorMessage {
                        Label(errorMessage, systemImage: "exclamationmark.triangle.fill")
                            .font(.caption.weight(.medium))
                            .foregroundStyle(Color.statusText(.orange))
                    }
                }
            } else {
                bookingNameControl
            }
        }
    }

    private var bookingNameControl: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 4) {
                Text("Booking name")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(KioskText.secondary)
                Text("*")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(Color.kioskRed)
            }

            KioskNativeTextField(
                placeholder: "Event, practice, shoot, or purpose",
                text: $customPurpose,
                isFocused: Binding(
                    get: { focusedField.wrappedValue == .customPurpose },
                    set: { focusedField.wrappedValue = $0 ? .customPurpose : nil }
                ),
                onScannerBurstRejected: onScannerBurstRejected
            )
            .padding(.horizontal, 16)
            .frame(height: 68)
            .background(KioskSurface.sunken, in: RoundedRectangle(cornerRadius: KioskRadius.md))
            .overlay(
                RoundedRectangle(cornerRadius: KioskRadius.md)
                    .stroke(customPurpose.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? KioskStroke.standard : Color.kioskRed.opacity(0.7), lineWidth: 1)
            )

            KioskKeyboardHint(isFieldFocused: focusedField.wrappedValue == .customPurpose)
        }
    }

    private var eventMenu: some View {
        Menu {
            Button {
                selectedEventId = nil
            } label: {
                Label("No event", systemImage: selectedEventId == nil ? "checkmark" : "calendar")
            }

            Divider()

            ForEach(events) { event in
                Button {
                    selectedEventId = event.id
                } label: {
                    Label(event.title, systemImage: selectedEventId == event.id ? "checkmark" : "calendar")
                }
            }
        } label: {
            Label("All Events", systemImage: "chevron.up.chevron.down")
                .labelStyle(.titleAndIcon)
                .font(.subheadline.weight(.semibold))
        }
        .buttonStyle(.bordered)
        .buttonBorderShape(.capsule)
        .controlSize(.regular)
        .tint(KioskText.secondary)
    }

    private var featuredEvents: [KioskCheckoutEvent] {
        var result = Array(events.prefix(3))
        if let selectedEvent,
           !result.contains(where: { $0.id == selectedEvent.id }),
           !result.isEmpty {
            result[result.count - 1] = selectedEvent
        }
        return result
    }
}

private struct KioskCheckoutEventRow: View {
    let event: KioskCheckoutEvent
    let isSelected: Bool
    let subtitle: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 12) {
                ZStack {
                    RoundedRectangle(cornerRadius: 5)
                        .stroke(isSelected ? Color.kioskRed : KioskStroke.standard, lineWidth: isSelected ? 2 : 1)
                        .frame(width: 20, height: 20)
                    if isSelected {
                        Image(systemName: "checkmark")
                            .font(.caption2.weight(.bold))
                            .foregroundStyle(Color.kioskRed)
                            .accessibilityHidden(true)
                    }
                }

                VStack(alignment: .leading, spacing: 6) {
                    Text(event.title)
                        .font(.subheadline.weight(.bold))
                        .foregroundStyle(KioskText.primary)
                        .lineLimit(1)
                        .minimumScaleFactor(0.78)
                    Text(subtitle)
                        .font(.caption.weight(.medium))
                        .foregroundStyle(KioskText.secondary)
                        .lineLimit(1)
                        .minimumScaleFactor(0.82)
                }

                Spacer(minLength: 0)

                Image(systemName: "chevron.right")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(KioskText.muted)
                    .accessibilityHidden(true)
            }
            .padding(.horizontal, 14)
            .frame(maxWidth: .infinity, minHeight: 64, alignment: .leading)
            .background(isSelected ? Color.kioskRed.opacity(0.12) : Color.clear)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(event.title), \(subtitle)\(isSelected ? ", selected" : "")")
    }
}

private struct KioskCheckoutEventLoadingRow: View {
    var body: some View {
        HStack(spacing: 10) {
            ProgressView()
                .tint(Color.kioskRed)
            Text("Loading upcoming events")
                .font(.caption.weight(.semibold))
                .foregroundStyle(KioskText.secondary)
            Spacer()
        }
        .padding(.horizontal, 14)
        .frame(height: 56)
        .background(KioskSurface.sunken, in: RoundedRectangle(cornerRadius: KioskRadius.md))
    }
}

private struct KioskCheckoutEmptyEventRow: View {
    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: "calendar")
                .foregroundStyle(KioskText.muted)
                .accessibilityHidden(true)
            Text("No events in the next 7 days")
                .font(.caption.weight(.semibold))
                .foregroundStyle(KioskText.secondary)
            Spacer()
        }
        .padding(.horizontal, 14)
        .frame(height: 56)
        .background(KioskSurface.sunken, in: RoundedRectangle(cornerRadius: KioskRadius.md))
    }
}

private struct KioskCheckoutReturnWindow: View {
    @Binding var dueBackAt: Date

    var body: some View {
        KioskCheckoutWindow(title: "Return") {
            KioskCheckoutReturnDatePicker(dueBackAt: $dueBackAt)
        }
    }
}

private struct KioskCheckoutReturnDatePicker: View {
    @Binding var dueBackAt: Date

    private var minimumDueBack: Date {
        Date().addingTimeInterval(5 * 60)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .firstTextBaseline) {
                HStack(spacing: 4) {
                    Text("Return time")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(KioskText.secondary)
                    Text("*")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(Color.kioskRed)
                }

                Spacer()

                Text(dueBackAt.formatted(date: .abbreviated, time: .shortened))
                    .font(.subheadline.weight(.bold).monospacedDigit())
                    .foregroundStyle(KioskText.primary)
                    .contentTransition(.numericText())
            }

            ViewThatFits(in: .horizontal) {
                HStack(alignment: .center, spacing: 10) {
                    returnDatePicker
                    returnTimePicker
                }
                VStack(spacing: 12) {
                    returnDatePicker
                    returnTimePicker
                }
            }
            .frame(maxWidth: .infinity)
            .padding(12)
            .background(KioskSurface.sunken, in: RoundedRectangle(cornerRadius: KioskRadius.md))
            .overlay(
                RoundedRectangle(cornerRadius: KioskRadius.md)
                    .stroke(KioskStroke.hairline, lineWidth: 1)
            )
        }
    }

    private var returnDatePicker: some View {
        KioskUICalendarPicker(
            selection: clampedDueBack,
            minimumDate: minimumDueBack
        )
        .frame(width: KioskCheckoutSetupLayout.returnDateWidth, height: 300)
        .clipped()
    }

    private var returnTimePicker: some View {
        KioskUIDatePicker(
            selection: clampedDueBack,
            displayedComponent: .time,
            preferredStyle: .wheels,
            minimumDate: nil
        )
        .frame(width: KioskCheckoutSetupLayout.returnTimeWidth, height: 180)
        .clipped()
    }

    private var clampedDueBack: Binding<Date> {
        Binding(
            get: { max(dueBackAt, minimumDueBack) },
            set: { dueBackAt = max($0, minimumDueBack) }
        )
    }
}

private struct KioskUICalendarPicker: UIViewRepresentable {
    @Binding var selection: Date
    let minimumDate: Date

    func makeUIView(context: Context) -> UICalendarView {
        let calendarView = UICalendarView()
        calendarView.calendar = .current
        calendarView.locale = .current
        calendarView.tintColor = UIColor(Color.kioskRed)
        calendarView.selectionBehavior = UICalendarSelectionSingleDate(delegate: context.coordinator)
        calendarView.setContentCompressionResistancePriority(.required, for: .horizontal)
        calendarView.setContentHuggingPriority(.required, for: .horizontal)
        return calendarView
    }

    func updateUIView(_ calendarView: UICalendarView, context: Context) {
        context.coordinator.parent = self
        calendarView.calendar = .current
        calendarView.locale = .current
        calendarView.tintColor = UIColor(Color.kioskRed)
        calendarView.availableDateRange = DateInterval(
            start: Calendar.current.startOfDay(for: minimumDate),
            end: Date.distantFuture
        )

        if let selectionBehavior = calendarView.selectionBehavior as? UICalendarSelectionSingleDate {
            selectionBehavior.setSelected(selectedDateComponents, animated: false)
        } else {
            calendarView.selectionBehavior = UICalendarSelectionSingleDate(delegate: context.coordinator)
        }
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(parent: self)
    }

    private var selectedDateComponents: DateComponents {
        var components = Calendar.current.dateComponents([.era, .year, .month, .day], from: selection)
        components.calendar = Calendar.current
        return components
    }

    fileprivate func canSelect(_ dateComponents: DateComponents?) -> Bool {
        guard let date = date(from: dateComponents) else { return false }
        return Calendar.current.startOfDay(for: date) >= Calendar.current.startOfDay(for: minimumDate)
    }

    fileprivate func mergedSelection(from dateComponents: DateComponents?) -> Date? {
        guard let selectedDay = date(from: dateComponents) else { return nil }
        let calendar = Calendar.current
        let dayParts = calendar.dateComponents([.era, .year, .month, .day], from: selectedDay)
        let timeParts = calendar.dateComponents([.hour, .minute, .second], from: selection)
        var components = DateComponents()
        components.calendar = calendar
        components.era = dayParts.era
        components.year = dayParts.year
        components.month = dayParts.month
        components.day = dayParts.day
        components.hour = timeParts.hour
        components.minute = timeParts.minute
        components.second = timeParts.second
        guard let merged = calendar.date(from: components) else { return nil }
        return max(merged, minimumDate)
    }

    private func date(from dateComponents: DateComponents?) -> Date? {
        guard var dateComponents else { return nil }
        dateComponents.calendar = Calendar.current
        return Calendar.current.date(from: dateComponents)
    }

    final class Coordinator: NSObject, UICalendarSelectionSingleDateDelegate {
        var parent: KioskUICalendarPicker

        init(parent: KioskUICalendarPicker) {
            self.parent = parent
        }

        func dateSelection(
            _ selection: UICalendarSelectionSingleDate,
            canSelectDate dateComponents: DateComponents?
        ) -> Bool {
            parent.canSelect(dateComponents)
        }

        func dateSelection(
            _ selection: UICalendarSelectionSingleDate,
            didSelectDate dateComponents: DateComponents?
        ) {
            guard let merged = parent.mergedSelection(from: dateComponents) else { return }
            parent.selection = merged
        }
    }
}

private struct KioskUIDatePicker: UIViewRepresentable {
    enum DisplayedComponent {
        case date
        case time

        var mode: UIDatePicker.Mode {
            switch self {
            case .date: .date
            case .time: .time
            }
        }
    }

    @Binding var selection: Date
    let displayedComponent: DisplayedComponent
    let preferredStyle: UIDatePickerStyle
    let minimumDate: Date?

    func makeUIView(context: Context) -> UIDatePicker {
        let picker = UIDatePicker()
        picker.datePickerMode = displayedComponent.mode
        picker.preferredDatePickerStyle = preferredStyle
        picker.tintColor = UIColor(Color.kioskRed)
        picker.calendar = .current
        picker.locale = .current
        picker.minimumDate = minimumDate
        picker.addTarget(context.coordinator, action: #selector(Coordinator.valueChanged(_:)), for: .valueChanged)
        picker.setContentCompressionResistancePriority(.required, for: .horizontal)
        picker.setContentHuggingPriority(.required, for: .horizontal)
        return picker
    }

    func updateUIView(_ picker: UIDatePicker, context: Context) {
        context.coordinator.parent = self
        picker.datePickerMode = displayedComponent.mode
        picker.preferredDatePickerStyle = preferredStyle
        picker.minimumDate = minimumDate
        picker.tintColor = UIColor(Color.kioskRed)

        let clampedSelection = clamped(selection)
        if abs(picker.date.timeIntervalSince(clampedSelection)) > 0.5 {
            picker.setDate(clampedSelection, animated: false)
        }
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(parent: self)
    }

    private func clamped(_ date: Date) -> Date {
        guard let minimumDate else { return date }
        return max(date, minimumDate)
    }

    fileprivate func mergedSelection(from pickerDate: Date) -> Date {
        let calendar = Calendar.current
        var merged: Date?

        switch displayedComponent {
        case .date:
            let dateParts = calendar.dateComponents([.era, .year, .month, .day], from: pickerDate)
            let timeParts = calendar.dateComponents([.hour, .minute, .second], from: selection)
            var components = DateComponents()
            components.calendar = calendar
            components.era = dateParts.era
            components.year = dateParts.year
            components.month = dateParts.month
            components.day = dateParts.day
            components.hour = timeParts.hour
            components.minute = timeParts.minute
            components.second = timeParts.second
            merged = calendar.date(from: components)
        case .time:
            let dateParts = calendar.dateComponents([.era, .year, .month, .day], from: selection)
            let timeParts = calendar.dateComponents([.hour, .minute, .second], from: pickerDate)
            var components = DateComponents()
            components.calendar = calendar
            components.era = dateParts.era
            components.year = dateParts.year
            components.month = dateParts.month
            components.day = dateParts.day
            components.hour = timeParts.hour
            components.minute = timeParts.minute
            components.second = timeParts.second
            merged = calendar.date(from: components)
        }

        return clamped(merged ?? selection)
    }

    final class Coordinator: NSObject {
        var parent: KioskUIDatePicker

        init(parent: KioskUIDatePicker) {
            self.parent = parent
        }

        @MainActor @objc func valueChanged(_ picker: UIDatePicker) {
            parent.selection = parent.mergedSelection(from: picker.date)
        }
    }
}

private enum KioskCheckoutEventFormat {
    static func subtitle(_ event: KioskCheckoutEvent) -> String {
        var parts = [eventDateFormatter.string(from: event.startsAt)]
        if let locationName = event.locationName, !locationName.isEmpty {
            parts.append(locationName)
        } else if let sportCode = event.sportCode, !sportCode.isEmpty {
            parts.append(sportCode)
        }
        return parts.joined(separator: " · ")
    }

    private static let eventDateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "EEE h:mm a"
        return formatter
    }()
}

private struct KioskCheckoutSideSummary: View {
    let user: KioskUser
    let locationName: String?
    let contextTitle: String?
    let contextDetail: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 12) {
                KioskAvatar(url: user.avatarUrl, initials: user.initials, size: 40)
                VStack(alignment: .leading, spacing: 2) {
                    Text(user.name)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(KioskText.primary)
                        .lineLimit(1)
                    Text(locationName ?? "Kiosk location")
                        .font(.caption)
                        .foregroundStyle(KioskText.muted)
                        .lineLimit(1)
                }
            }

            if let contextTitle, !contextTitle.isEmpty {
                HStack(alignment: .top, spacing: 10) {
                    Image(systemName: "calendar.badge.clock")
                        .foregroundStyle(Color.kioskRed)
                        .accessibilityHidden(true)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(contextTitle)
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(KioskText.primary)
                            .lineLimit(2)
                        if let contextDetail, !contextDetail.isEmpty {
                            Text(contextDetail)
                                .font(.caption2)
                                .foregroundStyle(KioskText.muted)
                                .lineLimit(2)
                        }
                    }
                }
            }
        }
        .padding(20)
    }
}

private struct KioskScannerTroubleshootingSheet: View {
    let lastScanAt: Date?
    let locationName: String?
    let onCamera: () -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                Section("Status") {
                    Label(lastScanText, systemImage: "barcode.viewfinder")
                    if let locationName {
                        Label(locationName, systemImage: "mappin.and.ellipse")
                    }
                }
                Section("Try This") {
                    Label("Make sure the scanner sends Return after each scan.", systemImage: "return")
                    Label("Keep the checkout screen open while scanning item labels.", systemImage: "ipad")
                    Label("If a label is damaged, use the camera fallback.", systemImage: "camera")
                }
                Section {
                    Button {
                        dismiss()
                        onCamera()
                    } label: {
                        Label("Use Camera", systemImage: "camera.fill")
                    }
                }
            }
            .navigationTitle("Scanner Health")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }

    private var lastScanText: String {
        guard let lastScanAt else { return "No scanner input received in this checkout yet" }
        return "Last scanner input: \(lastScanAt.formatted(date: .omitted, time: .shortened))"
    }
}

private struct KioskCheckoutContextSummary: View {
    let title: String
    let detail: String?
    let dueBackAt: Date
    var showsEdit: Bool = true
    let onEdit: () -> Void

    var body: some View {
        HStack(spacing: 14) {
            Image(systemName: "calendar.badge.clock")
                .font(.headline)
                .foregroundStyle(Color.kioskRed)
                .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(KioskText.primary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.82)
                if let detail, !detail.isEmpty {
                    Text(detail)
                        .font(.caption)
                        .foregroundStyle(KioskText.muted)
                        .lineLimit(1)
                        .minimumScaleFactor(0.82)
                }
                Text("Due back \(dueBackAt.formatted(date: .abbreviated, time: .shortened))")
                    .font(.caption)
                    .foregroundStyle(KioskText.secondary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.82)
            }

            Spacer()

            if showsEdit {
                Button("Edit", action: onEdit)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(KioskText.secondary)
                    .buttonStyle(.plain)
                    .frame(minWidth: 44, minHeight: 44)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .kioskCard(KioskSurface.card, radius: KioskRadius.lg, stroke: KioskStroke.standard)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(title), due back \(dueBackAt.formatted(date: .abbreviated, time: .shortened))")
    }
}

private struct KioskCheckoutAvailabilityBanner: View {
    let result: KioskCheckoutAvailabilityResult
    let isChecking: Bool
    let errorMessage: String?

    var body: some View {
        if isChecking || result.hasBlockingIssue || result.hasWarning || errorMessage != nil {
            HStack(spacing: 10) {
                Image(systemName: iconName)
                    .foregroundStyle(color)
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(KioskText.primary)
                    Text(detail)
                        .font(.caption2)
                        .foregroundStyle(KioskText.muted)
                        .lineLimit(2)
                }
                Spacer()
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .kioskCard(KioskSurface.card, radius: KioskRadius.md, stroke: KioskStroke.hairline)
        }
    }

    private var color: Color {
        if result.hasBlockingIssue { return Color.statusText(.red) }
        if result.hasWarning || errorMessage != nil { return Color.statusText(.orange) }
        return Color.statusText(.blue)
    }

    private var iconName: String {
        if isChecking { return "arrow.triangle.2.circlepath" }
        if result.hasBlockingIssue { return "exclamationmark.triangle.fill" }
        if result.hasWarning || errorMessage != nil { return "clock.badge.exclamationmark" }
        return "checkmark.shield.fill"
    }

    private var title: String {
        if isChecking { return "Checking conflicts" }
        if result.hasBlockingIssue { return "Conflict found" }
        if result.hasWarning { return "Tight turnaround" }
        if errorMessage != nil { return "Conflict check unavailable" }
        return "Conflict check clear"
    }

    private var detail: String {
        if let errorMessage { return errorMessage }
        if result.hasBlockingIssue {
            let count = result.conflicts.count + result.shortages.count + result.unavailableAssets.count
            return "\(count) issue\(count == 1 ? "" : "s") must be resolved before checkout."
        }
        if let risk = result.turnaroundRisks.first {
            return risk.message
        }
        if let risk = result.bulkTurnaroundRisks.first {
            return risk.message
        }
        return "Scanning can continue."
    }
}

private struct KioskCartGroupRow: View {
    let group: KioskCartDisplayGroup
    let availabilityIssue: KioskCartAvailabilityIssue?
    let onRemove: (() -> Void)?

    var body: some View {
        HStack(spacing: 14) {
            KioskCheckoutThumbnail(item: group.first)

            VStack(alignment: .leading, spacing: 5) {
                HStack(spacing: 6) {
                    Text(group.primaryTitle)
                        .font(.gothamBold(size: 16))
                        .foregroundStyle(KioskText.primary)
                        .lineLimit(1)
                        .minimumScaleFactor(0.82)
                    if group.count > 1 {
                        Text("x\(group.count)")
                            .font(.caption.weight(.bold))
                            .foregroundStyle(Color.kioskRed)
                            .padding(.horizontal, 7)
                            .padding(.vertical, 3)
                            .background(Color.kioskRed.opacity(0.16), in: Capsule())
                    }
                    if let availabilityIssue {
                        Text(availabilityIssue.message)
                            .font(.caption2.weight(.bold))
                            .foregroundStyle(availabilityIssue.color)
                            .padding(.horizontal, 7)
                            .padding(.vertical, 3)
                            .background(availabilityIssue.color.opacity(0.16), in: Capsule())
                    }
                }

                Text(group.subtitle)
                    .font(.caption.weight(.medium))
                    .foregroundStyle(KioskText.secondary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.82)
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            Spacer()
            if let onRemove {
                Button(action: onRemove) {
                    Image(systemName: "xmark.circle.fill")
                        .font(.title3)
                        .foregroundStyle(KioskText.muted)
                        .frame(width: 44, height: 44)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Remove \(group.primaryTitle)")
            }
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 12)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(accessibilityLabel)
        .accessibilityAction(named: "Remove") { onRemove?() }
    }

    private var accessibilityLabel: String {
        if group.isBulkGroup {
            return "\(group.primaryTitle), \(group.subtitle)"
        }
        return "\(group.primaryTitle), \(group.subtitle)"
    }
}

private struct KioskCheckoutThumbnail: View {
    let item: KioskCartItem

    var body: some View {
        ZStack(alignment: .bottomTrailing) {
            Group {
                if let urlString = item.imageUrl, let url = URL(string: urlString) {
                    AsyncImage(url: url) { phase in
                        switch phase {
                        case .success(let image):
                            image
                                .resizable()
                                .scaledToFill()
                        default:
                            placeholder
                        }
                    }
                } else {
                    placeholder
                }
            }
            .frame(width: 56, height: 56)
            .clipShape(RoundedRectangle(cornerRadius: KioskRadius.sm))
            .overlay(
                RoundedRectangle(cornerRadius: KioskRadius.sm)
                    .stroke(KioskStroke.standard, lineWidth: 1)
            )

            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(Color.statusText(.green))
                .background(Color.black.opacity(0.78), in: Circle())
                .offset(x: 4, y: 4)
                .accessibilityHidden(true)
        }
        .accessibilityHidden(true)
    }

    private var placeholder: some View {
        RoundedRectangle(cornerRadius: KioskRadius.sm)
            .fill(KioskSurface.placeholder)
            .overlay {
                Image(systemName: item.isNumberedBulk ? "battery.100percent" : "camera.fill")
                    .font(.title3)
                    .foregroundStyle(KioskText.secondary)
            }
    }
}
