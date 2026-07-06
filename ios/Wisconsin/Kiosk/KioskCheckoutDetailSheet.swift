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
    @State private var addScanValue = ""
    @State private var titleFocused = false
    @State private var scanFocused = false
    @State private var isMutating = false
    @State private var mutationMessage: KioskMutationMessage?

    private struct ItemGroup: Identifiable {
        let id: String
        var items: [KioskCheckoutDetail.ReturnItem]
        var first: KioskCheckoutDetail.ReturnItem { items[0] }
        var isBulkGroup: Bool { first.isBulkDisplay }
        var count: Int { items.count }
        var primaryTitle: String {
            guard isBulkGroup else { return first.itemListPrimaryTitle }
            let tags = unitNumbers.map { "#\($0)" }.joined(separator: " ")
            return tags.nonBlankText ?? first.itemListPrimaryTitle
        }
        var subtitle: String {
            guard isBulkGroup else { return first.itemListSecondaryTitle ?? first.tagName }
            return (first.bulkSkuName ?? first.name)
                .replacingOccurrences(of: #" #\d+$"#, with: "", options: .regularExpression)
                + " · \(count) unit\(count == 1 ? "" : "s")"
        }
        var unitNumbers: [Int] { items.compactMap(\.unitNumber).sorted() }
        var returnedCount: Int { items.filter(\.returned).count }
    }

    private var groups: [ItemGroup] {
        guard let items = detail?.items else { return [] }
        var groups: [ItemGroup] = []
        var bulkIndex: [String: Int] = [:]
        for item in items {
            if item.isNumberedBulk, let bulkSkuId = item.bulkSkuId {
                if let index = bulkIndex[bulkSkuId] {
                    groups[index].items.append(item)
                } else {
                    bulkIndex[bulkSkuId] = groups.count
                    groups.append(ItemGroup(id: "bulk-\(bulkSkuId)", items: [item]))
                }
            } else {
                groups.append(ItemGroup(id: item.id, items: [item]))
            }
        }
        return groups
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
                }

                VStack(alignment: .leading, spacing: 10) {
                    Text("Items")
                        .font(.title3.weight(.bold))
                        .foregroundStyle(KioskText.primary)

                    if isLoading {
                        ProgressView().tint(KioskText.primary)
                            .frame(maxWidth: .infinity, minHeight: 80)
                    } else if let loadError {
                        KioskErrorState(title: loadError) { Task { await load() } }
                    } else {
                        ScrollView {
                            LazyVStack(spacing: 8) {
                                ForEach(groups) { group in
                                    itemRow(group)
                                }
                            }
                        }
                        .scrollIndicators(.hidden)
                    }
                }

                Spacer(minLength: 0)
            }
            .padding(28)
        }
        .task { await load() }
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
                .padding(.horizontal, 16)
                .padding(.vertical, 10)
                .background(KioskSurface.cardSelected, in: Capsule())
        }
    }

    private var editPanel: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Edit Checkout")
                    .font(.headline.weight(.bold))
                    .foregroundStyle(KioskText.primary)
                Spacer()
                Button(isMutating ? "Saving..." : "Save") {
                    Task { await saveDetails() }
                }
                .font(.caption.weight(.bold))
                .foregroundStyle(.white)
                .padding(.horizontal, 14)
                .padding(.vertical, 8)
                .background(Color.kioskRed.opacity(isMutating ? 0.45 : 0.9), in: Capsule())
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

            HStack(spacing: 10) {
                KioskNativeTextField(
                    placeholder: "Scan or type item",
                    text: $addScanValue,
                    isFocused: $scanFocused
                )
                .padding(.horizontal, 12)
                .frame(height: 46)
                .background(KioskSurface.sunken, in: RoundedRectangle(cornerRadius: KioskRadius.md))
                .overlay(RoundedRectangle(cornerRadius: KioskRadius.md).stroke(KioskStroke.standard, lineWidth: 1))

                Button(isMutating ? "Adding..." : "Add") {
                    Task { await addItem() }
                }
                .font(.caption.weight(.bold))
                .foregroundStyle(KioskText.primary)
                .frame(width: 76, height: 46)
                .background(KioskSurface.cardSelected, in: RoundedRectangle(cornerRadius: KioskRadius.md))
                .disabled(isMutating || addScanValue.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }

            KioskKeyboardHint(isFieldFocused: titleFocused || scanFocused)

            if let mutationMessage {
                KioskFeedbackBanner(tone: mutationMessage.tone, message: mutationMessage.text)
            }
        }
        .padding(14)
        .background(KioskSurface.card, in: RoundedRectangle(cornerRadius: KioskRadius.lg))
        .overlay(RoundedRectangle(cornerRadius: KioskRadius.lg).stroke(KioskStroke.standard, lineWidth: 1))
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
    private func itemRow(_ group: ItemGroup) -> some View {
        HStack(spacing: 12) {
            itemThumbnail(group)
                .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 6) {
                    Text(group.primaryTitle)
                        .font(.gothamBold(size: 16))
                        .foregroundStyle(KioskText.primary)
                        .lineLimit(1)
                    if group.count > 1 {
                        Text("x\(group.count)")
                            .font(.caption2.weight(.bold))
                            .foregroundStyle(Color.kioskRed)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Color.kioskRed.opacity(0.16), in: Capsule())
                    }
                }
                Text(group.subtitle)
                    .font(.caption.weight(.medium))
                    .foregroundStyle(KioskText.secondary)
                    .lineLimit(1)
            }
            Spacer()
            if canEditActiveCheckout, let removable = removableItem(in: group) {
                Button(group.count > 1 ? "Remove one" : "Remove") {
                    Task { await removeItem(removable) }
                }
                .font(.caption2.weight(.bold))
                .foregroundStyle(Color.statusText(.red))
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(Color.statusText(.red).opacity(0.14), in: Capsule())
                .disabled(isMutating)
            }
            if group.returnedCount > 0 {
                Text(group.returnedCount == group.count ? "Returned" : "\(group.returnedCount)/\(group.count) back")
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

    private func removableItem(in group: ItemGroup) -> KioskCheckoutDetail.ReturnItem? {
        group.items.first { !$0.returned && (!$0.isBulkDisplay || $0.unitNumber != nil) }
    }

    @ViewBuilder
    private func itemThumbnail(_ group: ItemGroup) -> some View {
        let fallbackIcon = group.isBulkGroup ? "battery.100percent" : "camera.fill"
        Group {
            if let urlString = group.first.imageUrl, let url = URL(string: urlString) {
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
        isMutating = true
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
        isMutating = false
    }

    private func addItem() async {
        guard let actorId else { return }
        let value = addScanValue.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !value.isEmpty else { return }
        isMutating = true
        do {
            let result = try await KioskAPI.shared.kioskAddActiveCheckoutItem(id: context.checkoutId, actorId: actorId, scanValue: value)
            mutationMessage = KioskMutationMessage(tone: result.success ? .success : .warning, text: result.message ?? result.error ?? "Scan handled")
            if result.success {
                addScanValue = ""
                await load()
                onChanged()
            }
        } catch {
            mutationMessage = KioskMutationMessage(tone: .error, text: (error as? APIError)?.errorDescription ?? "Could not add item")
        }
        isMutating = false
    }

    private func removeItem(_ item: KioskCheckoutDetail.ReturnItem) async {
        guard let actorId else { return }
        isMutating = true
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
        isMutating = false
    }
}

private struct KioskMutationMessage {
    let tone: KioskBannerTone
    let text: String
}
