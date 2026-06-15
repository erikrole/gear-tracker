import SwiftUI
import UIKit

struct KioskCheckoutView: View {
    @Environment(KioskStore.self) private var store
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    let userId: String

    @State private var lastResult: ScanFeedback?
    @State private var isCompleting = false
    @State private var showBackConfirm = false
    @State private var showCamera = false
    @State private var eventOptions: [KioskCheckoutEvent] = []
    @State private var isLoadingEvents = false
    @State private var eventLoadError: String?
    @State private var selectedEventId: String?
    @State private var customPurpose = ""

    enum ScanFeedback: Equatable {
        case success(String)
        case error(String)
        case duplicate(String)

        var message: String {
            switch self {
            case .success(let s), .error(let s), .duplicate(let s): return s
            }
        }

        var tone: KioskBannerTone {
            switch self {
            case .success:   .success
            case .error:     .error
            case .duplicate: .warning
            }
        }
    }

    /// Cart lives in KioskStore so a brief inactivity reset doesn't discard it.
    private var scannedItems: [KioskCartItem] { store.cart(for: userId) }

    var body: some View {
        HStack(spacing: 0) {
            scanZone
            Divider().background(KioskStroke.divider)
            itemsList.frame(width: 430)
        }
        .overlay(alignment: .bottom) {
            // Hidden HID scanner field — always first responder
            KioskScannerField { value in
                handleScan(value)
            }
            .frame(width: 1, height: 1)
            .opacity(0)
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
        .task {
            await loadCheckoutEvents()
        }
    }

    // MARK: - Scan Zone

    private var scanZone: some View {
        VStack(spacing: 24) {
            KioskFlowHeader(
                title: "Checkout",
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

            KioskCheckoutContextCard(
                events: eventOptions,
                isLoading: isLoadingEvents,
                errorMessage: eventLoadError,
                selectedEventId: $selectedEventId,
                customPurpose: $customPurpose,
                selectedEvent: selectedEvent
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
            }

            // Feedback banner
            if let result = lastResult {
                KioskFeedbackBanner(tone: result.tone, message: result.message)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                    .animation(reduceMotion ? nil : .spring(response: 0.3), value: lastResult)
            }

            Spacer()

            KioskCompletionButton(
                title: "Complete Checkout",
                isEnabled: !scannedItems.isEmpty && hasCheckoutContext,
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
        return "Complete Checkout, \(count) item\(count == 1 ? "" : "s")"
    }

    // MARK: - Items List

    private var itemsList: some View {
        VStack(alignment: .leading, spacing: 0) {
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
                            ForEach(Array(scannedItems.enumerated()), id: \.element.id) { index, item in
                                ItemRow(item: item, onRemove: { removeItem(item) })
                                    .id(item.id)
                                    .background(index == scannedItems.count - 1 ? Color.white.opacity(0.025) : Color.clear)
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
        case .duplicate: return Color.statusText(.orange)
        case nil: return Color.white.opacity(0.3)
        }
    }

    private var trimmedCustomPurpose: String {
        customPurpose.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var hasCheckoutContext: Bool {
        selectedEvent != nil || !trimmedCustomPurpose.isEmpty
    }

    private var selectedEvent: KioskCheckoutEvent? {
        guard let selectedEventId else { return nil }
        return eventOptions.first { $0.id == selectedEventId }
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
                        showFeedback(.success(result.locationMessage ?? item.name))
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
        Haptics.warning()
        store.resetInactivity()
        UIAccessibility.post(notification: .announcement, argument: "Removed \(item.name)")
    }

    private func showFeedback(_ feedback: ScanFeedback) {
        withAnimation { lastResult = feedback }
        // Tactile + spoken signal so the staffer doesn't need to read the
        // banner — ankle-deep in a noisy floor environment.
        switch feedback {
        case .success: Haptics.success()
        case .duplicate: Haptics.warning()
        case .error: Haptics.error()
        }
        UIAccessibility.post(notification: .announcement, argument: feedback.message)
        Task {
            try? await Task.sleep(nanoseconds: 3_000_000_000)
            withAnimation { lastResult = nil }
        }
    }

    private func completeCheckout() {
        let cart = store.cart(for: userId)
        guard !cart.isEmpty, hasCheckoutContext, let locationId = store.info?.locationId else { return }
        isCompleting = true
        Task {
            do {
                try await KioskAPI.shared.kioskCheckoutComplete(
                    actorId: userId,
                    locationId: locationId,
                    items: cart,
                    eventId: selectedEvent?.id,
                    customPurpose: trimmedCustomPurpose.isEmpty ? nil : trimmedCustomPurpose
                )
                Haptics.success()
                store.clearCart(for: userId)
                store.screen = .success("Checkout complete! \(cart.count) items checked out.")
            } catch {
                let message = (error as? APIError)?.errorDescription
                    ?? "Checkout failed. Please try again."
                showFeedback(.error(message))
            }
            isCompleting = false
        }
    }
}

// MARK: - Sub-views

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
                                Text(eventSubtitle(selectedEvent))
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
        if events.isEmpty { return "No upcoming events" }
        return "Choose upcoming event"
    }

    private func eventSubtitle(_ event: KioskCheckoutEvent) -> String {
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

private struct ItemRow: View {
    let item: KioskCartItem
    let onRemove: () -> Void

    var body: some View {
        HStack(spacing: 14) {
            KioskCheckoutThumbnail(item: item)

            VStack(alignment: .leading, spacing: 2) {
                Text(item.name)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.white)
                    .lineLimit(1)
                    .minimumScaleFactor(0.82)
                HStack(spacing: 6) {
                    Text(item.tagName)
                        .font(.caption.monospaced())
                        .foregroundStyle(.secondary)
                    if let type = item.type {
                        Text("·")
                            .foregroundStyle(.secondary)
                        Text(type)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
                .lineLimit(1)
                .minimumScaleFactor(0.82)
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            Spacer()
            Button(action: onRemove) {
                Image(systemName: "xmark.circle.fill")
                    .font(.title3)
                    .foregroundStyle(KioskText.muted)
                    .frame(width: 44, height: 44)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Remove \(item.name)")
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 12)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(item.name), tag \(item.tagName)")
        .accessibilityAction(named: "Remove") { onRemove() }
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
