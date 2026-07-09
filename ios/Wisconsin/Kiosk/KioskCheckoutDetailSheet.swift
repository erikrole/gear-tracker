import SwiftUI

// MARK: - Checkout detail drawer
//
// Read-only checkout detail with in-place active-checkout edits (title, due
// back, add/remove item). Extracted verbatim from KioskIdleView.swift
// (2026-07-02 rework Slice 5a).

/// Lightweight context captured from the tapped row so the drawer can render
/// its header (who/what/when) immediately while the item list loads.
struct KioskCheckoutDrawerContext: Identifiable {
    let checkoutId: String
    let title: String
    let requesterId: String?
    let requesterName: String
    let requesterAvatarUrl: String?
    let endsAt: Date
    let isOverdue: Bool

    var id: String { checkoutId }

    var requesterInitials: String {
        requesterName.split(separator: " ").prefix(2)
            .compactMap { $0.first }
            .map { String($0) }
            .joined()
            .uppercased()
    }
}

struct KioskCheckoutDetailSheet: View {
    @Environment(\.dismiss) private var dismiss
    let context: KioskCheckoutDrawerContext
    let onChanged: () -> Void

    @State private var detail: KioskCheckoutDetail?
    @State private var isLoading = true
    @State private var loadError: String?
    @State private var editTitle = ""
    @State private var editEndsAt = Date().addingTimeInterval(24 * 60 * 60)
    @State private var titleFocused = false
    @State private var scannerCaptureEnabled = false
    @State private var activeMutation: ActiveMutation?
    @State private var pendingRemoval: KioskCheckoutDetail.ReturnItem?
    @State private var mutationMessage: KioskMutationMessage?

    private enum ActiveMutation: Equatable {
        case savingDetails
        case addingItem
        case removingItem
    }

    private var isMutating: Bool {
        activeMutation != nil
    }

    private var shouldListenForItemScans: Bool {
        canEditActiveCheckout
            && scannerCaptureEnabled
            && !titleFocused
            && !isMutating
            && pendingRemoval == nil
    }

    private var actorId: String? {
        context.requesterId ?? detail?.requesterId
    }

    private var canEditActiveCheckout: Bool {
        detail?.status == "OPEN" && actorId != nil
    }

    private var currentTitle: String {
        detail?.title ?? context.title
    }

    private var currentEndsAt: Date {
        detail?.endsAt ?? context.endsAt
    }

    private var currentIsOverdue: Bool {
        currentEndsAt < Date()
    }

    var body: some View {
        ZStack {
            KioskSurface.base.ignoresSafeArea()
            VStack(alignment: .leading, spacing: 18) {
                header

                timingRow

                if canEditActiveCheckout {
                    editPanel
                    scanToAddPanel
                }

                if let mutationMessage {
                    KioskFeedbackBanner(tone: mutationMessage.tone, message: mutationMessage.text)
                }

                VStack(alignment: .leading, spacing: 10) {
                    HStack {
                        Text("Items")
                            .font(.title3.weight(.bold))
                            .foregroundStyle(KioskText.primary)
                        Spacer()
                        if let items = detail?.items, !items.isEmpty {
                            Text("\(items.count)")
                                .font(.caption.weight(.bold).monospacedDigit())
                                .foregroundStyle(KioskText.secondary)
                        }
                    }

                    if isLoading {
                        ProgressView().tint(KioskText.primary)
                            .frame(maxWidth: .infinity, minHeight: 80)
                    } else if let loadError {
                        KioskErrorState(title: loadError) { Task { await load() } }
                    } else if detail?.items.isEmpty != false {
                        ContentUnavailableView(
                            "No Items",
                            systemImage: "shippingbox",
                            description: Text("This checkout has no equipment.")
                        )
                        .foregroundStyle(KioskText.secondary)
                        .frame(maxWidth: .infinity, minHeight: 100)
                    } else {
                        ScrollView {
                            LazyVStack(spacing: 8) {
                                ForEach(detail?.items ?? []) { item in
                                    itemRow(item)
                                }
                            }
                        }
                        .scrollIndicators(.hidden)
                    }
                }

                Spacer(minLength: 0)
            }
            .padding(28)

            if canEditActiveCheckout {
                HIDScannerField(isEnabled: shouldListenForItemScans) { value in
                    Task { await addItem(scanValue: value) }
                }
                .frame(width: 1, height: 1)
                .opacity(0)
            }
        }
        .task {
            await load()
            armScannerCapture()
        }
        .onDisappear {
            scannerCaptureEnabled = false
        }
        .onChange(of: titleFocused) { _, isFocused in
            if !isFocused {
                armScannerCapture()
            }
        }
        .confirmationDialog(
            "Remove item from checkout?",
            isPresented: Binding(
                get: { pendingRemoval != nil },
                set: { if !$0 { pendingRemoval = nil } }
            ),
            titleVisibility: .visible,
            presenting: pendingRemoval
        ) { item in
            Button("Remove \(item.itemListPrimaryTitle)", role: .destructive) {
                pendingRemoval = nil
                Task { await removeItem(item) }
            }
            Button("Cancel", role: .cancel) {
                pendingRemoval = nil
            }
        } message: { item in
            Text("This releases \(item.name) from \(context.requesterName)'s active checkout.")
        }
    }

    private var header: some View {
        HStack(alignment: .top, spacing: 14) {
            KioskAvatar(url: context.requesterAvatarUrl, initials: context.requesterInitials, size: 48)
            VStack(alignment: .leading, spacing: 4) {
                Text(currentTitle)
                    .font(.title2.weight(.heavy))
                    .foregroundStyle(KioskText.primary)
                    .lineLimit(2)
                    .minimumScaleFactor(0.78)
                Text(context.requesterName)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(KioskText.secondary)
            }
            Spacer()
            Button("Done") { dismiss() }
                .font(.headline.weight(.semibold))
                .foregroundStyle(KioskText.primary)
                .buttonStyle(.glass)
                .controlSize(.large)
        }
    }

    private var editPanel: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Edit Checkout")
                    .font(.headline.weight(.bold))
                    .foregroundStyle(KioskText.primary)
                Spacer()
                Button(activeMutation == .savingDetails ? "Saving..." : "Save") {
                    Task { await saveDetails() }
                }
                .font(.caption.weight(.bold))
                .foregroundStyle(.white)
                .buttonStyle(.glassProminent)
                .tint(Color.kioskRed)
                .controlSize(.regular)
                .disabled(isMutating)
            }

            HStack(spacing: 10) {
                KioskNativeTextField(
                    placeholder: "Checkout title",
                    text: $editTitle,
                    isFocused: $titleFocused
                )
                .padding(.horizontal, 12)
                .frame(height: 46)
                .background(KioskSurface.sunken, in: RoundedRectangle(cornerRadius: KioskRadius.md))
                .overlay(RoundedRectangle(cornerRadius: KioskRadius.md).stroke(KioskStroke.standard, lineWidth: 1))

                DatePicker(
                    "Due back",
                    selection: $editEndsAt,
                    in: Date().addingTimeInterval(5 * 60)...,
                    displayedComponents: [.date, .hourAndMinute]
                )
                .labelsHidden()
                .datePickerStyle(.compact)
                .tint(Color.kioskRed)
                .frame(height: 46)
                .padding(.horizontal, 10)
                .background(KioskSurface.sunken, in: RoundedRectangle(cornerRadius: KioskRadius.md))
                .overlay(RoundedRectangle(cornerRadius: KioskRadius.md).stroke(KioskStroke.standard, lineWidth: 1))
            }

            KioskKeyboardHint(isFieldFocused: titleFocused)
        }
        .padding(14)
        .background(KioskSurface.card, in: RoundedRectangle(cornerRadius: KioskRadius.lg))
        .overlay(RoundedRectangle(cornerRadius: KioskRadius.lg).stroke(KioskStroke.standard, lineWidth: 1))
    }

    private var scanToAddPanel: some View {
        HStack(spacing: 18) {
            KioskScanTarget(
                tint: activeMutation == .addingItem ? Color.statusText(.blue) : Color.kioskRed,
                width: 116,
                height: 72
            )

            VStack(alignment: .leading, spacing: 5) {
                Text("Add Items")
                    .font(.headline.weight(.bold))
                    .foregroundStyle(KioskText.primary)
                Label(
                    activeMutation == .addingItem ? "Adding scanned item..." : "Scanner ready",
                    systemImage: activeMutation == .addingItem ? "arrow.triangle.2.circlepath" : "barcode.viewfinder"
                )
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(activeMutation == .addingItem ? Color.statusText(.blue) : Color.statusText(.green))
            }

            Spacer()

            if activeMutation == .addingItem {
                ProgressView()
                    .tint(KioskText.primary)
            }
        }
        .padding(.horizontal, 18)
        .padding(.vertical, 14)
        .background(KioskSurface.cardRaised, in: RoundedRectangle(cornerRadius: KioskRadius.lg))
        .overlay(
            RoundedRectangle(cornerRadius: KioskRadius.lg)
                .stroke(
                    shouldListenForItemScans ? Color.statusText(.green).opacity(0.5) : KioskStroke.standard,
                    lineWidth: 1
                )
        )
        .accessibilityElement(children: .combine)
        .accessibilityLabel(activeMutation == .addingItem ? "Adding scanned item" : "Scanner ready to add items")
    }

    private var timingRow: some View {
        HStack(spacing: 10) {
            Image(systemName: currentIsOverdue ? "exclamationmark.triangle.fill" : "clock.badge.checkmark")
                .foregroundStyle(currentIsOverdue ? Color.statusText(.red) : Color.kioskRed)
                .accessibilityHidden(true)
            Text(currentIsOverdue ? "Overdue" : "Due")
                .font(.caption.weight(.bold))
                .tracking(0.8)
                .foregroundStyle(currentIsOverdue ? Color.statusText(.red) : KioskText.tertiary)
                .textCase(.uppercase)
            Text(currentEndsAt.formatted(date: .abbreviated, time: .shortened))
                .font(.subheadline.weight(.semibold).monospacedDigit())
                .foregroundStyle(KioskText.primary)
            Text(relativeDue)
                .font(.caption.weight(.semibold))
                .foregroundStyle(currentIsOverdue ? Color.statusText(.red) : KioskText.tertiary)
                .padding(.horizontal, 8)
                .padding(.vertical, 3)
                .background(
                    (currentIsOverdue ? Color.statusText(.red) : KioskText.tertiary).opacity(0.14),
                    in: Capsule()
                )
            Spacer()
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .background(KioskSurface.cardRaised, in: RoundedRectangle(cornerRadius: KioskRadius.lg))
        .overlay(
            RoundedRectangle(cornerRadius: KioskRadius.lg)
                .stroke(KioskStroke.standard, lineWidth: 1)
        )
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(currentIsOverdue ? "Overdue, due" : "Due") \(currentEndsAt.formatted(date: .abbreviated, time: .shortened))")
    }

    private var relativeDue: String {
        let rel = Self.relativeFormatter.localizedString(for: currentEndsAt, relativeTo: Date())
        return currentIsOverdue ? "\(rel)" : rel
    }

    private static let relativeFormatter: RelativeDateTimeFormatter = {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return formatter
    }()

    @ViewBuilder
    private func itemRow(_ item: KioskCheckoutDetail.ReturnItem) -> some View {
        HStack(spacing: 12) {
            itemThumbnail(item)
                .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: 4) {
                Text(item.itemListPrimaryTitle)
                    .font(.gothamBold(size: 16))
                    .foregroundStyle(KioskText.primary)
                    .lineLimit(1)
                Text(item.itemListSecondaryTitle ?? item.bulkSkuName ?? item.name)
                    .font(.caption.weight(.medium))
                    .foregroundStyle(KioskText.secondary)
                    .lineLimit(1)
            }
            Spacer()
            if canEditActiveCheckout && isRemovable(item) {
                Button {
                    pendingRemoval = item
                } label: {
                    Label("Remove", systemImage: "minus.circle.fill")
                }
                .buttonStyle(.bordered)
                .tint(Color.statusText(.red))
                .controlSize(.regular)
                .disabled(isMutating)
            }
            if item.returned {
                Text("Returned")
                    .font(.caption2.weight(.bold))
                    .foregroundStyle(Color.statusText(.green))
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .background(KioskSurface.card, in: RoundedRectangle(cornerRadius: KioskRadius.md))
        .overlay(
            RoundedRectangle(cornerRadius: KioskRadius.md)
                .stroke(KioskStroke.hairline, lineWidth: 1)
        )
    }

    private func isRemovable(_ item: KioskCheckoutDetail.ReturnItem) -> Bool {
        !item.returned && (!item.isBulkDisplay || (item.isNumberedBulk && item.unitNumber != nil))
    }

    @ViewBuilder
    private func itemThumbnail(_ item: KioskCheckoutDetail.ReturnItem) -> some View {
        let fallbackIcon = item.isBulkDisplay ? "battery.100percent" : "camera.fill"
        Group {
            if let urlString = item.imageUrl, let url = URL(string: urlString) {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let image):
                        image.resizable().scaledToFill()
                    default:
                        thumbnailFallback(icon: fallbackIcon)
                    }
                }
            } else {
                thumbnailFallback(icon: fallbackIcon)
            }
        }
        .frame(width: 40, height: 40)
        .clipShape(RoundedRectangle(cornerRadius: KioskRadius.sm))
        .overlay(
            RoundedRectangle(cornerRadius: KioskRadius.sm)
                .stroke(KioskStroke.hairline, lineWidth: 1)
        )
    }

    private func thumbnailFallback(icon: String) -> some View {
        RoundedRectangle(cornerRadius: KioskRadius.sm)
            .fill(KioskSurface.placeholder)
            .overlay {
                Image(systemName: icon)
                    .font(.headline)
                    .foregroundStyle(KioskText.secondary)
            }
    }

    private func load() async {
        isLoading = true
        loadError = nil
        do {
            let loaded = try await KioskAPI.shared.kioskCheckoutDetail(id: context.checkoutId)
            detail = loaded
            editTitle = loaded.title
            editEndsAt = loaded.endsAt
        } catch {
            loadError = (error as? APIError)?.errorDescription ?? "Could not load checkout details."
        }
        isLoading = false
    }

    private func saveDetails() async {
        guard let actorId else { return }
        let title = editTitle.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !title.isEmpty else {
            mutationMessage = KioskMutationMessage(tone: .warning, text: "Title is required")
            return
        }
        activeMutation = .savingDetails
        do {
            let result = try await KioskAPI.shared.kioskUpdateActiveCheckout(
                id: context.checkoutId,
                actorId: actorId,
                title: title,
                endsAt: editEndsAt
            )
            mutationMessage = KioskMutationMessage(tone: result.success ? .success : .warning, text: result.message ?? result.error ?? "Checkout updated")
            await load()
            onChanged()
        } catch {
            mutationMessage = KioskMutationMessage(tone: .error, text: (error as? APIError)?.errorDescription ?? "Could not update checkout")
        }
        activeMutation = nil
    }

    private func addItem(scanValue: String) async {
        guard let actorId else { return }
        let value = scanValue.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !value.isEmpty else { return }
        guard activeMutation == nil else { return }
        activeMutation = .addingItem
        do {
            let result = try await KioskAPI.shared.kioskAddActiveCheckoutItem(id: context.checkoutId, actorId: actorId, scanValue: value)
            mutationMessage = KioskMutationMessage(tone: result.success ? .success : .warning, text: result.message ?? result.error ?? "Scan handled")
            if result.success {
                await load()
                onChanged()
            }
        } catch {
            mutationMessage = KioskMutationMessage(tone: .error, text: (error as? APIError)?.errorDescription ?? "Could not add item")
        }
        activeMutation = nil
    }

    private func removeItem(_ item: KioskCheckoutDetail.ReturnItem) async {
        guard let actorId else { return }
        activeMutation = .removingItem
        do {
            let result = try await KioskAPI.shared.kioskRemoveActiveCheckoutItem(id: context.checkoutId, actorId: actorId, item: item)
            mutationMessage = KioskMutationMessage(tone: result.success ? .success : .warning, text: result.message ?? result.error ?? "Remove handled")
            if result.success {
                await load()
                onChanged()
            }
        } catch {
            mutationMessage = KioskMutationMessage(tone: .error, text: (error as? APIError)?.errorDescription ?? "Could not remove item")
        }
        activeMutation = nil
    }

    private func armScannerCapture() {
        guard canEditActiveCheckout else { return }
        scannerCaptureEnabled = false
        DispatchQueue.main.async {
            HIDScannerFocusGate.allowScannerFocusNow()
            scannerCaptureEnabled = true
        }
    }
}

private struct KioskMutationMessage {
    let tone: KioskBannerTone
    let text: String
}
