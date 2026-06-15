import SwiftUI
import UIKit

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
    @State private var selectedEventId: String?
    @State private var customPurpose = ""
    @State private var checkoutContextReady = false
    @State private var showReview = false
    @State private var showScannerHelp = false
    @State private var showEditContextConfirm = false
    @State private var lastScanAt: Date?
    @State private var dueBackAt = Date().addingTimeInterval(24 * 60 * 60)
    @State private var availabilityResult = KioskCheckoutAvailabilityResult()
    @State private var isCheckingAvailability = false
    @State private var availabilityError: String?

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

    var body: some View {
        HStack(spacing: 0) {
            scanZone
            Divider().background(KioskStroke.divider)
            itemsList.frame(width: 430)
        }
        .overlay(alignment: .bottom) {
            if checkoutContextReady {
                // Hidden HID scanner field only mounts after checkout context is set.
                KioskScannerField { value in
                    handleScan(value)
                }
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
                Haptics.warning()
                store.screen = .idle
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
        .sheet(isPresented: $showReview) {
            KioskCheckoutReviewSheet(
                user: user,
                locationName: store.info?.locationName,
                contextTitle: checkoutContextTitle,
                contextDetail: checkoutContextDetail,
                dueBackAt: dueBackAt,
                itemCount: scannedItems.count,
                groups: groupedScannedItems,
                availabilityResult: availabilityResult,
                isCheckingAvailability: isCheckingAvailability,
                isCompleting: isCompleting,
                onCancel: { showReview = false },
                onConfirm: performCheckout
            )
        }
        .task {
            await loadCheckoutEvents()
        }
        .onChange(of: selectedEventId) { _, _ in
            applySelectedEventDueTime()
        }
        .onChange(of: dueBackAt) { _, _ in
            guard checkoutContextReady, !scannedItems.isEmpty else { return }
            Task { await refreshAvailability(for: scannedItems) }
        }
    }

    // MARK: - Scan Zone

    private var scanZone: some View {
        Group {
            if checkoutContextReady {
                activeScanZone
            } else {
                checkoutContextSetupZone
            }
        }
    }

    private var checkoutContextSetupZone: some View {
        VStack(spacing: 24) {
            KioskFlowHeader(
                title: "Checkout Details",
                backAccessibilityLabel: "Back to roster",
                onBack: {
                    if scannedItems.isEmpty {
                        store.screen = .idle
                    } else {
                        showBackConfirm = true
                    }
                },
                onCamera: nil
            )

            Spacer(minLength: 10)

            VStack(spacing: 18) {
                KioskCheckoutIdentityCard(
                    user: user,
                    locationName: store.info?.locationName
                )
                .frame(maxWidth: 760)

                KioskCheckoutContextCard(
                    events: eventOptions,
                    isLoading: isLoadingEvents,
                    errorMessage: eventLoadError,
                    selectedEventId: $selectedEventId,
                    customPurpose: $customPurpose,
                    selectedEvent: selectedEvent
                )
                .frame(maxWidth: 760)

                KioskCheckoutTimeCard(
                    dueBackAt: $dueBackAt,
                    selectedEvent: selectedEvent
                )
                .frame(maxWidth: 760)

                KioskCompletionButton(
                    title: "Start Scanning",
                    isEnabled: hasCheckoutContext && hasValidReturnTime,
                    isBusy: false,
                    accessibilityLabel: startScanningAccessibilityLabel,
                    action: startScanning
                )
                .frame(maxWidth: 760)
            }

            Spacer()
        }
        .padding(.horizontal, 32)
        .padding(.top, 20)
        .padding(.bottom, 32)
        .frame(maxWidth: .infinity)
    }

    private var activeScanZone: some View {
        VStack(spacing: 24) {
            KioskFlowHeader(
                title: "Scan Items",
                backAccessibilityLabel: scannedItems.isEmpty
                    ? "Back to roster"
                    : "Back to roster, will prompt to discard \(scannedItems.count) items",
                onBack: {
                    if scannedItems.isEmpty {
                        store.screen = .idle
                    } else {
                        showBackConfirm = true
                    }
                },
                onCamera: { showCamera = true }
            )

            KioskCheckoutContextSummary(
                title: checkoutContextTitle,
                detail: checkoutContextDetail,
                dueBackAt: dueBackAt,
                onEdit: {
                    requestEditContext()
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
                ZStack {
                    RoundedRectangle(cornerRadius: 24)
                        .stroke(scannerBorderColor, lineWidth: 3)
                        .frame(width: 220, height: 140)

                    Image(systemName: "barcode.viewfinder")
                        .font(.system(size: 56))
                        .foregroundStyle(scannerBorderColor)
                        .accessibilityHidden(true)
                }

                Text("Scan items to add")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                Text("Or tap Camera if no scanner is connected")
                    .font(.caption)
                    .foregroundStyle(.secondary.opacity(0.6))

                KioskScannerHealthBadge(
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
                title: completeButtonTitle,
                isEnabled: !scannedItems.isEmpty && hasCheckoutContext && hasValidReturnTime && !availabilityResult.hasBlockingIssue,
                isBusy: isCompleting,
                accessibilityLabel: completeAccessibilityLabel,
                action: completeCheckout
            )
            .padding(.horizontal, 32)
            .padding(.bottom, 32)
        }
        .padding(.horizontal, 32)
        .padding(.top, 20)
        .frame(maxWidth: .infinity)
    }

    private var completeAccessibilityLabel: String {
        if isCompleting { return "Processing checkout" }
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

    private var itemsList: some View {
        VStack(alignment: .leading, spacing: 0) {
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
                    .foregroundStyle(.white)
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
                        .foregroundStyle(.secondary)
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
                                .background(group.contains(scannedItems.last) ? Color.white.opacity(0.025) : Color.clear)
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
        .background(KioskSurface.sunken)
    }

    // MARK: - Logic

    private var scannerBorderColor: Color {
        switch lastResult {
        case .success: return Color.statusText(.green)
        case .error: return Color.statusText(.red)
        case .duplicate, .warning: return Color.statusText(.orange)
        case nil: return Color.white.opacity(0.3)
        }
    }

    private var trimmedCustomPurpose: String {
        customPurpose.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var hasCheckoutContext: Bool {
        selectedEvent != nil || !trimmedCustomPurpose.isEmpty
    }

    private var hasValidReturnTime: Bool {
        dueBackAt > Date().addingTimeInterval(60)
    }

    private var startScanningAccessibilityLabel: String {
        if !hasCheckoutContext {
            return "Start Scanning unavailable, choose an event or enter what this checkout is for"
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
        selectedEvent?.title ?? trimmedCustomPurpose
    }

    private var checkoutContextDetail: String? {
        if let selectedEvent {
            var parts = [KioskCheckoutContextCard.eventSubtitle(selectedEvent)]
            if !trimmedCustomPurpose.isEmpty {
                parts.append(trimmedCustomPurpose)
            }
            return parts.joined(separator: " · ")
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
        guard checkoutContextReady else { return }

        // Ignore scans during the complete-API window — a late scan would
        // land in the cart but miss the assetIds payload, then get wiped on
        // success. Phantom checkouts are worse than a "hold on" feedback.
        guard !isCompleting else {
            showFeedback(.error("Hold on — finishing checkout"))
            return
        }

        store.resetInactivity()
        lastScanAt = Date()

        var cart = store.cart(for: userId)

        // Deduplicate by tag string
        if cart.contains(where: { $0.tagName.lowercased() == value.lowercased() }) {
            showFeedback(.duplicate("Already scanned"))
            return
        }

        Task {
            do {
                let result = try await KioskAPI.shared.kioskCheckoutScan(actorId: userId, scanValue: value)
                if result.success, let item = result.item {
                    var updated = cart
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
                        cart = updated
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
        UIAccessibility.post(notification: .announcement, argument: "Removed \(item.name)")
    }

    private func removeGroup(_ group: KioskCartDisplayGroup) {
        var cart = store.cart(for: userId)
        let groupIds = Set(group.items.map(\.id))
        cart.removeAll { groupIds.contains($0.id) }
        store.setCart(cart, for: userId)
        Task { await refreshAvailability(for: cart) }
        Haptics.warning()
        store.resetInactivity()
        UIAccessibility.post(notification: .announcement, argument: "Removed \(group.title)")
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
        checkoutContextReady = true
        store.resetInactivity()
        Haptics.success()
    }

    private func requestEditContext() {
        if scannedItems.isEmpty {
            checkoutContextReady = false
        } else {
            showEditContextConfirm = true
        }
    }

    private func completeCheckout() {
        let cart = store.cart(for: userId)
        guard !cart.isEmpty, hasCheckoutContext, hasValidReturnTime, store.info?.locationId != nil else { return }
        guard !isCompleting else { return }
        Task {
            await refreshAvailability(for: cart)
            guard !availabilityResult.hasBlockingIssue else {
                showFeedback(.error("Resolve item conflicts before checkout"))
                return
            }
            showReview = true
            store.resetInactivity()
        }
    }

    private func performCheckout() {
        let cart = store.cart(for: userId)
        guard !cart.isEmpty, hasCheckoutContext, hasValidReturnTime, let locationId = store.info?.locationId else { return }
        guard !availabilityResult.hasBlockingIssue else { return }
        guard !isCompleting else { return }
        let message = successMessage
        isCompleting = true
        Task {
            do {
                try await KioskAPI.shared.kioskCheckoutComplete(
                    actorId: userId,
                    locationId: locationId,
                    items: cart,
                    eventId: selectedEvent?.id,
                    customPurpose: trimmedCustomPurpose.isEmpty ? nil : trimmedCustomPurpose,
                    endsAt: dueBackAt
                )
                Haptics.success()
                store.clearCart(for: userId)
                showReview = false
                store.screen = .success(message)
            } catch {
                let message = (error as? APIError)?.errorDescription
                    ?? "Checkout failed. Please try again."
                showReview = false
                showFeedback(.error(message))
            }
            isCompleting = false
        }
    }

    private func applySelectedEventDueTime() {
        guard let selectedEvent, let eventEnd = selectedEvent.endsAt else { return }
        if eventEnd > Date().addingTimeInterval(60) {
            dueBackAt = eventEnd
        }
    }

    @MainActor
    private func refreshAvailability(for cart: [KioskCartItem]) async {
        guard let locationId = store.info?.locationId, !cart.isEmpty else {
            availabilityResult = KioskCheckoutAvailabilityResult()
            availabilityError = nil
            return
        }
        guard hasValidReturnTime else {
            availabilityResult = KioskCheckoutAvailabilityResult()
            availabilityError = "Choose a return time later than pickup"
            return
        }

        isCheckingAvailability = true
        availabilityError = nil
        do {
            availabilityResult = try await KioskAPI.shared.kioskCheckoutAvailability(
                locationId: locationId,
                items: cart,
                startsAt: Date(),
                endsAt: dueBackAt
            )
        } catch {
            availabilityError = (error as? APIError)?.errorDescription ?? "Conflict check unavailable"
            availabilityResult = KioskCheckoutAvailabilityResult()
        }
        isCheckingAvailability = false
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
    var title: String {
        guard isBulkGroup else { return first.name }
        return first.name.replacingOccurrences(of: #" #\d+$"#, with: "", options: .regularExpression)
    }
    var subtitle: String {
        if isBulkGroup {
            return "\(count) unit\(count == 1 ? "" : "s")"
        }
        return [first.tagName, first.type].compactMap { value in
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

private struct KioskCheckoutIdentityCard: View {
    let user: KioskUser
    let locationName: String?

    var body: some View {
        HStack(spacing: 14) {
            KioskAvatar(url: user.avatarUrl, initials: user.initials, size: 46)

            VStack(alignment: .leading, spacing: 2) {
                Text(user.name)
                    .font(.headline)
                    .foregroundStyle(.white)
                    .lineLimit(1)
                Text(locationName ?? "Kiosk location")
                    .font(.caption)
                    .foregroundStyle(KioskText.muted)
                    .lineLimit(1)
            }

            Spacer()

            Label("Selected", systemImage: "checkmark.circle.fill")
                .font(.caption.weight(.semibold))
                .foregroundStyle(Color.statusText(.green))
        }
        .padding(16)
        .kioskCard(KioskSurface.card, radius: KioskRadius.lg, stroke: KioskStroke.standard)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(user.name), \(locationName ?? "kiosk location"), selected")
    }
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
                        .foregroundStyle(.white)
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
                            .foregroundStyle(.white)
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

private struct KioskScannerHealthBadge: View {
    let lastScanAt: Date?
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 8) {
                Circle()
                    .fill(statusColor)
                    .frame(width: 8, height: 8)
                    .accessibilityHidden(true)
                Text(label)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(KioskText.secondary)
                Image(systemName: "info.circle")
                    .font(.caption)
                    .foregroundStyle(KioskText.muted)
                    .accessibilityHidden(true)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .kioskCard(KioskSurface.card, radius: KioskRadius.md, stroke: KioskStroke.hairline)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Scanner status, \(label)")
    }

    private var statusColor: Color {
        lastScanAt == nil ? Color.statusText(.blue) : Color.statusText(.green)
    }

    private var label: String {
        guard let lastScanAt else { return "Scanner listening" }
        let seconds = max(0, Int(Date().timeIntervalSince(lastScanAt)))
        if seconds < 5 { return "Scan received" }
        if seconds < 60 { return "Last scan \(seconds)s ago" }
        return "Last scan \(seconds / 60)m ago"
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

private struct KioskCheckoutReviewSheet: View {
    let user: KioskUser
    let locationName: String?
    let contextTitle: String
    let contextDetail: String?
    let dueBackAt: Date
    let itemCount: Int
    let groups: [KioskCartDisplayGroup]
    let availabilityResult: KioskCheckoutAvailabilityResult
    let isCheckingAvailability: Bool
    let isCompleting: Bool
    let onCancel: () -> Void
    let onConfirm: () -> Void

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 20) {
                VStack(alignment: .leading, spacing: 12) {
                    KioskCheckoutIdentityCard(user: user, locationName: locationName)
                    KioskCheckoutContextSummary(
                        title: contextTitle,
                        detail: contextDetail,
                        dueBackAt: dueBackAt,
                        showsEdit: false,
                        onEdit: {}
                    )
                    KioskCheckoutAvailabilityBanner(
                        result: availabilityResult,
                        isChecking: isCheckingAvailability,
                        errorMessage: nil
                    )
                }

                VStack(alignment: .leading, spacing: 10) {
                    Text("\(itemCount) Item\(itemCount == 1 ? "" : "s")")
                        .font(.headline)
                        .foregroundStyle(.white)
                    ScrollView {
                        LazyVStack(spacing: 8) {
                            ForEach(groups) { group in
                                KioskCartGroupRow(
                                    group: group,
                                    availabilityIssue: nil,
                                    onRemove: nil
                                )
                                    .kioskCard(KioskSurface.sunken, radius: KioskRadius.md, stroke: KioskStroke.hairline)
                            }
                        }
                    }
                }

                Spacer(minLength: 0)

                KioskCompletionButton(
                    title: "Confirm Checkout",
                    isEnabled: itemCount > 0 && !availabilityResult.hasBlockingIssue,
                    isBusy: isCompleting,
                    accessibilityLabel: "Confirm checkout for \(itemCount) item\(itemCount == 1 ? "" : "s")",
                    action: onConfirm
                )
            }
            .padding(24)
            .background(KioskSurface.base.ignoresSafeArea())
            .navigationTitle("Review Checkout")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel", action: onCancel)
                        .disabled(isCompleting)
                }
            }
        }
        .presentationDetents([.large])
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
                    .foregroundStyle(.white)
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

private struct KioskCheckoutTimeCard: View {
    @Binding var dueBackAt: Date
    let selectedEvent: KioskCheckoutEvent?

    private var minimumDueBack: Date {
        Date().addingTimeInterval(5 * 60)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 12) {
                Image(systemName: "clock.badge.checkmark")
                    .font(.headline)
                    .foregroundStyle(Color.kioskRed)
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Return Time")
                        .font(.headline)
                        .foregroundStyle(.white)
                    Text("Pickup starts when checkout is confirmed")
                        .font(.caption)
                        .foregroundStyle(KioskText.muted)
                }
                Spacer()
            }

            DatePicker(
                "Due back",
                selection: $dueBackAt,
                in: minimumDueBack...,
                displayedComponents: [.date, .hourAndMinute]
            )
            .datePickerStyle(.compact)
            .labelsHidden()
            .tint(Color.kioskRed)
            .padding(.horizontal, 14)
            .frame(height: 56)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(KioskSurface.sunken, in: RoundedRectangle(cornerRadius: KioskRadius.md))
            .overlay(
                RoundedRectangle(cornerRadius: KioskRadius.md)
                    .stroke(KioskStroke.standard, lineWidth: 1)
            )

            HStack(spacing: 8) {
                quickButton("Tonight", date: Calendar.current.date(bySettingHour: 22, minute: 0, second: 0, of: Date()))
                quickButton("Tomorrow", date: Calendar.current.date(byAdding: .day, value: 1, to: Date()))
                if let eventEnd = selectedEvent?.endsAt, eventEnd > minimumDueBack {
                    quickButton("Event End", date: eventEnd)
                }
            }

            Text("The system will conflict-check from the actual checkout time through this return time.")
                .font(.caption.weight(.medium))
                .foregroundStyle(KioskText.muted)
        }
        .padding(18)
        .background(KioskSurface.card, in: RoundedRectangle(cornerRadius: KioskRadius.lg))
        .overlay(
            RoundedRectangle(cornerRadius: KioskRadius.lg)
                .stroke(KioskStroke.standard, lineWidth: 1)
        )
    }

    @ViewBuilder
    private func quickButton(_ title: String, date: Date?) -> some View {
        if let date, date > minimumDueBack {
            Button(title) {
                dueBackAt = date
            }
            .font(.caption.weight(.semibold))
            .foregroundStyle(KioskText.secondary)
            .padding(.horizontal, 10)
            .padding(.vertical, 7)
            .background(KioskSurface.cardRaised, in: Capsule())
            .buttonStyle(.plain)
        }
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
                        .foregroundStyle(.white)
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

private struct KioskCheckoutContextCard: View {
    let events: [KioskCheckoutEvent]
    let isLoading: Bool
    let errorMessage: String?
    @Binding var selectedEventId: String?
    @Binding var customPurpose: String
    let selectedEvent: KioskCheckoutEvent?

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 12) {
                Image(systemName: "calendar.badge.clock")
                    .font(.headline)
                    .foregroundStyle(Color.kioskRed)
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Event or Purpose")
                        .font(.headline)
                        .foregroundStyle(.white)
                    Text("Required for checkout")
                        .font(.caption)
                        .foregroundStyle(KioskText.muted)
                }
                Spacer()
                if selectedEvent != nil {
                    Button("Clear") {
                        selectedEventId = nil
                    }
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(KioskText.secondary)
                    .buttonStyle(.plain)
                }
            }

            HStack(spacing: 12) {
                Menu {
                    Button("No event selected") {
                        selectedEventId = nil
                    }
                    ForEach(events) { event in
                        Button {
                            selectedEventId = event.id
                        } label: {
                            Label(event.title, systemImage: selectedEventId == event.id ? "checkmark" : "calendar")
                        }
                    }
                } label: {
                    HStack(spacing: 10) {
                        Image(systemName: "calendar")
                            .accessibilityHidden(true)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(selectedEvent?.title ?? eventMenuTitle)
                                .font(.subheadline.weight(.semibold))
                                .lineLimit(1)
                            if let selectedEvent {
                                Text(Self.eventSubtitle(selectedEvent))
                                    .font(.caption)
                                    .foregroundStyle(KioskText.muted)
                                    .lineLimit(1)
                            }
                        }
                        Spacer()
                        Image(systemName: "chevron.up.chevron.down")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(KioskText.muted)
                            .accessibilityHidden(true)
                    }
                    .foregroundStyle(.white)
                    .padding(.horizontal, 14)
                    .frame(height: 56)
                    .background(KioskSurface.sunken, in: RoundedRectangle(cornerRadius: KioskRadius.md))
                    .overlay(
                        RoundedRectangle(cornerRadius: KioskRadius.md)
                            .stroke(KioskStroke.standard, lineWidth: 1)
                    )
                }
                .frame(maxWidth: .infinity)
                .disabled(isLoading || events.isEmpty)

                TextField(selectedEvent == nil ? "Custom event or purpose" : "Optional details", text: $customPurpose)
                    .textInputAutocapitalization(.words)
                    .disableAutocorrection(true)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 14)
                    .frame(height: 56)
                    .background(KioskSurface.sunken, in: RoundedRectangle(cornerRadius: KioskRadius.md))
                    .overlay(
                        RoundedRectangle(cornerRadius: KioskRadius.md)
                            .stroke(KioskStroke.standard, lineWidth: 1)
                    )
            }

            if !isLoading && events.isEmpty {
                Text("No events in the next 7 days. Type a purpose or tap a quick option.")
                    .font(.caption.weight(.medium))
                    .foregroundStyle(KioskText.muted)
            }

            HStack(spacing: 8) {
                ForEach(Self.quickPurposes, id: \.self) { purpose in
                    Button(purpose) {
                        customPurpose = purpose
                    }
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(customPurpose == purpose ? .white : KioskText.secondary)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 7)
                    .background(
                        customPurpose == purpose ? Color.kioskRed.opacity(0.85) : KioskSurface.cardRaised,
                        in: Capsule()
                    )
                    .buttonStyle(.plain)
                }
            }

            if let errorMessage {
                Text(errorMessage)
                    .font(.caption.weight(.medium))
                    .foregroundStyle(Color.statusText(.orange))
            }
        }
        .padding(18)
        .background(KioskSurface.card, in: RoundedRectangle(cornerRadius: KioskRadius.lg))
        .overlay(
            RoundedRectangle(cornerRadius: KioskRadius.lg)
                .stroke(KioskStroke.standard, lineWidth: 1)
        )
        .accessibilityElement(children: .contain)
    }

    private var eventMenuTitle: String {
        if isLoading { return "Loading events" }
        if events.isEmpty { return "No events next 7 days" }
        return "Choose upcoming event"
    }

    private static let quickPurposes = ["Practice", "Shoot", "Media Day", "Repair/Test"]

    static func eventSubtitle(_ event: KioskCheckoutEvent) -> String {
        var parts = [Self.eventDateFormatter.string(from: event.startsAt)]
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

private struct KioskCartGroupRow: View {
    let group: KioskCartDisplayGroup
    let availabilityIssue: KioskCartAvailabilityIssue?
    let onRemove: (() -> Void)?

    var body: some View {
        HStack(spacing: 14) {
            KioskCheckoutThumbnail(item: group.first)

            VStack(alignment: .leading, spacing: 5) {
                HStack(spacing: 6) {
                    Text(group.title)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.white)
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

                if group.isBulkGroup, !group.unitNumbers.isEmpty {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 5) {
                            ForEach(group.unitNumbers, id: \.self) { unitNumber in
                                Text("#\(unitNumber)")
                                    .font(.caption2.monospacedDigit().weight(.semibold))
                                    .foregroundStyle(KioskText.secondary)
                                    .padding(.horizontal, 7)
                                    .padding(.vertical, 4)
                                    .background(KioskSurface.cardRaised, in: Capsule())
                            }
                        }
                    }
                } else {
                    Text(group.subtitle)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                        .minimumScaleFactor(0.82)
                }
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
                .accessibilityLabel("Remove \(group.title)")
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
            return "\(group.title), \(group.count) units, \(group.unitNumbers.map { "#\($0)" }.joined(separator: ", "))"
        }
        return "\(group.title), \(group.subtitle)"
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
            .fill(Color.white.opacity(0.10))
            .overlay {
                Image(systemName: item.isNumberedBulk ? "battery.100percent" : "camera.fill")
                    .font(.title3)
                    .foregroundStyle(Color.white.opacity(0.62))
            }
    }
}
