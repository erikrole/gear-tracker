import SwiftUI

struct KioskCheckoutView: View {
    @Environment(KioskStore.self) private var store
    let userId: String

    @State private var scanInput = ""
    @State private var lastResult: ScanFeedback?
    @State private var isCompleting = false
    @State private var showBackConfirm = false
    @State private var showCamera = false

    enum ScanFeedback: Equatable {
        case success(String)
        case error(String)
        case duplicate(String)
    }

    /// Cart lives in KioskStore so a brief inactivity reset doesn't discard it.
    private var scannedItems: [KioskCartItem] { store.cart(for: userId) }

    var body: some View {
        HStack(spacing: 0) {
            scanZone
            Divider().background(Color.white.opacity(0.1))
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
        .alert("Discard \(scannedItems.count) scanned item\(scannedItems.count == 1 ? "" : "s")?",
               isPresented: $showBackConfirm) {
            Button("Cancel", role: .cancel) {}
            Button("Discard", role: .destructive) {
                store.clearCart(for: userId)
                store.screen = .idle
            }
        } message: {
            Text("Going back will clear your scans.")
        }
        .sheet(isPresented: $showCamera) {
            KioskBarcodeCameraView(
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
            HStack {
                Button {
                    if scannedItems.isEmpty {
                        store.screen = .idle
                    } else {
                        showBackConfirm = true
                    }
                } label: {
                    Label("Back", systemImage: "chevron.left")
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Text("Checkout")
                    .font(.title3.bold())
                    .foregroundStyle(.white)
                Spacer()
                Button {
                    showCamera = true
                } label: {
                    Label("Camera", systemImage: "camera.fill")
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(.secondary)
                }
            }

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
                FeedbackBanner(result: result)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                    .animation(.spring(response: 0.3), value: lastResult != nil)
            }

            Spacer()

            // Complete button
            Button {
                completeCheckout()
            } label: {
                HStack {
                    Text(isCompleting ? "Processing..." : "Complete Checkout")
                        .font(.headline)
                    if isCompleting {
                        ProgressView().tint(.white).scaleEffect(0.8)
                    }
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 16)
                .background(scannedItems.isEmpty ? Color.white.opacity(0.1) : Color.kioskRed,
                            in: RoundedRectangle(cornerRadius: 14))
            }
            .buttonStyle(.plain)
            .disabled(scannedItems.isEmpty || isCompleting)
            .padding(.horizontal, 32)
            .padding(.bottom, 32)
        }
        .padding(.horizontal, 32)
        .padding(.top, 20)
        .frame(maxWidth: .infinity)
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
            }
            .padding(20)

            Divider().background(Color.white.opacity(0.1))

            if scannedItems.isEmpty {
                Spacer()
                Text("No items scanned yet")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .center)
                Spacer()
            } else {
                ScrollView {
                    LazyVStack(spacing: 0) {
                        ForEach(scannedItems) { item in
                            ItemRow(item: item)
                            Divider().background(Color.white.opacity(0.06))
                        }
                    }
                }
            }
        }
        .background(Color.white.opacity(0.02))
    }

    // MARK: - Logic

    private var scannerBorderColor: Color {
        switch lastResult {
        case .success: return .green
        case .error: return .red
        case .duplicate: return .orange
        case nil: return Color.white.opacity(0.3)
        }
    }

    private func handleScan(_ value: String) {
        store.resetInactivity()

        var cart = store.cart(for: userId)

        // Deduplicate by tag string
        if cart.contains(where: { $0.tagName.lowercased() == value.lowercased() }) {
            showFeedback(.duplicate("Already scanned"))
            return
        }

        Task {
            do {
                let result = try await KioskAPI.shared.kioskCheckoutScan(scanValue: value)
                if result.success, let item = result.item {
                    var updated = cart
                    if !updated.contains(where: { $0.id == item.id }) {
                        updated.append(KioskCartItem(id: item.id, name: item.name, tagName: item.tagName, type: item.type))
                        store.setCart(updated, for: userId)
                        cart = updated
                        showFeedback(.success(item.name))
                    } else {
                        showFeedback(.duplicate("Already scanned"))
                    }
                } else {
                    showFeedback(.error(result.error ?? "Could not add item"))
                }
            } catch {
                showFeedback(.error("Scan failed"))
            }
        }
    }

    private func showFeedback(_ feedback: ScanFeedback) {
        withAnimation { lastResult = feedback }
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
                store.clearCart(for: userId)
                store.screen = .success("Checkout complete! \(cart.count) items checked out.")
            } catch {
                showFeedback(.error("Checkout failed. Please try again."))
            }
            isCompleting = false
        }
    }
}

// MARK: - Sub-views

private struct ItemRow: View {
    let item: KioskCartItem

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "checkmark.circle.fill")
                .foregroundStyle(.green)
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
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 14)
    }
}

private struct FeedbackBanner: View {
    let result: KioskCheckoutView.ScanFeedback

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: icon)
            Text(message)
                .font(.subheadline.weight(.medium))
        }
        .foregroundStyle(color)
        .padding(.horizontal, 20)
        .padding(.vertical, 12)
        .background(color.opacity(0.15), in: RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(color.opacity(0.4), lineWidth: 1)
        )
    }

    private var icon: String {
        switch result {
        case .success: return "checkmark.circle.fill"
        case .error: return "xmark.circle.fill"
        case .duplicate: return "exclamationmark.triangle.fill"
        }
    }

    private var message: String {
        switch result {
        case .success(let name): return name
        case .error(let msg): return msg
        case .duplicate(let msg): return msg
        }
    }

    private var color: Color {
        switch result {
        case .success: return .green
        case .error: return .red
        case .duplicate: return .orange
        }
    }
}
