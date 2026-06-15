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
            itemsList.frame(width: 380)
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
                isEnabled: !scannedItems.isEmpty,
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
                Text("No items scanned yet")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .center)
                Spacer()
            } else {
                ScrollViewReader { proxy in
                    ScrollView {
                        LazyVStack(spacing: 0) {
                            ForEach(scannedItems) { item in
                                ItemRow(item: item, onRemove: { removeItem(item) })
                                    .id(item.id)
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
                        updated.append(KioskCartItem(id: item.id, name: item.name, tagName: item.tagName, type: item.type))
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
        guard !cart.isEmpty, let locationId = store.info?.locationId else { return }
        isCompleting = true
        Task {
            do {
                try await KioskAPI.shared.kioskCheckoutComplete(
                    actorId: userId,
                    locationId: locationId,
                    assetIds: cart.map(\.id)
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

private struct ItemRow: View {
    let item: KioskCartItem
    let onRemove: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "checkmark.circle.fill")
                .foregroundStyle(Color.statusText(.green))
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                Text(item.name)
                    .font(.subheadline)
                    .foregroundStyle(.white)
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
            }
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
        .padding(.vertical, 14)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(item.name), tag \(item.tagName)")
        .accessibilityAction(named: "Remove") { onRemove() }
    }
}
