import SwiftUI
import UIKit

struct KioskReturnView: View {
    @Environment(KioskStore.self) private var store
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    let bookingId: String
    let userId: String

    @State private var detail: KioskCheckoutDetail?
    @State private var returnedIds: Set<String> = []
    @State private var lastResult: ScanFeedback?
    @State private var isLoading = true
    @State private var isCompleting = false
    @State private var loadError: String?
    @State private var showCamera = false
    @State private var lastReturnedId: String?

    enum ScanFeedback: Equatable {
        case success(String)
        case error(String)
        case alreadyReturned(String)

        var message: String {
            switch self {
            case .success(let s), .error(let s), .alreadyReturned(let s): return s
            }
        }

        var tone: KioskBannerTone {
            switch self {
            case .success:         .success
            case .error:           .error
            case .alreadyReturned: .warning
            }
        }
    }

    private var totalItems: Int { detail?.items.count ?? 0 }
    private var returnedCount: Int { returnedIds.count }
    private var hasReturned: Bool { returnedCount > 0 }
    private var allReturned: Bool { returnedCount == totalItems && totalItems > 0 }
    private var batteryTotal: Int { detail?.scanSummary?.numberedBulkTotal ?? detail?.numberedBulkItems.count ?? 0 }
    private var returnedBatteryCount: Int {
        detail?.numberedBulkItems.filter { returnedIds.contains($0.id) }.count ?? 0
    }
    private var hasBatteryScanStep: Bool { batteryTotal > 0 }
    private var returnedBatteryUnits: [KioskCheckoutDetail.ReturnItem] {
        detail?.numberedBulkItems.filter { returnedIds.contains($0.id) } ?? []
    }

    var body: some View {
        HStack(spacing: 0) {
            scanZone
            Divider().background(KioskStroke.divider)
            checklistPanel
                .frame(width: 400)
        }
        .overlay(alignment: .bottom) {
            KioskScannerField { value in handleScan(value) }
                .frame(width: 1, height: 1)
                .opacity(0)
        }
        .task { await loadDetail() }
        .sheet(isPresented: $showCamera) {
            KioskBarcodeCameraView(
                feedbackMessage: lastResult?.message,
                feedbackTone: lastResult?.tone,
                onScan: { value in handleScan(value) },
                onCancel: { showCamera = false }
            )
        }
    }

    // MARK: - Scan Zone

    private var scanZone: some View {
        VStack(spacing: 24) {
            KioskFlowHeader(
                title: "Return",
                onBack: { store.screen = .idle },
                onCamera: { showCamera = true }
            )

            Spacer()

            if isLoading {
                ProgressView().tint(.white)
            } else {
                VStack(spacing: 20) {
                    KioskProgressRing(
                        count: returnedCount,
                        total: totalItems,
                        isComplete: allReturned,
                        reduceMotion: reduceMotion,
                        accessibilityText: "\(returnedCount) of \(totalItems) items returned"
                    )

                    if let detail, detail.isOverdue {
                        Label("Overdue", systemImage: "exclamationmark.triangle.fill")
                            .font(.caption.weight(.medium))
                            .foregroundStyle(Color.statusText(.red))
                            .accessibilityLabel("This checkout is overdue")
                    }

                    VStack(spacing: 6) {
                        Text(allReturned ? "All items returned" : "Scan items to return them")
                            .font(.title3.weight(.semibold))
                            .foregroundStyle(allReturned ? Color.statusText(.green) : KioskText.primary)
                            .multilineTextAlignment(.center)
                        if !allReturned {
                            Text("Use the hand scanner, or tap Camera to scan with the iPad.")
                                .font(.subheadline)
                                .foregroundStyle(KioskText.tertiary)
                                .multilineTextAlignment(.center)
                        }
                    }

                    if hasBatteryScanStep {
                        KioskBatteryScanStatus(
                            title: "Battery Units",
                            count: returnedBatteryCount,
                            total: batteryTotal,
                            pendingCopy: "Scan each returned battery unit QR so custody closes on the exact units.",
                            completeCopy: "All \(batteryTotal) units returned",
                            progressCopy: "\(returnedBatteryCount) of \(batteryTotal) units returned",
                            unitsHeader: "Returned units",
                            scannedUnits: returnedBatteryUnits.map { KioskScannedUnit(id: $0.id, tag: $0.tagName) }
                        )
                    }

                    if let result = lastResult {
                        KioskFeedbackBanner(tone: result.tone, message: result.message)
                            .transition(.move(edge: .bottom).combined(with: .opacity))
                            .animation(reduceMotion ? nil : .spring(response: 0.3), value: lastResult)
                    }
                }
            }

            Spacer()

            completeButton
        }
        .padding(.horizontal, 32)
        .padding(.top, 20)
        .frame(maxWidth: .infinity)
    }

    private var completeButton: some View {
        KioskCompletionButton(
            title: returnLabel,
            icon: hasReturned ? "checkmark.circle.fill" : "barcode.viewfinder",
            isEnabled: hasReturned,
            isBusy: isCompleting,
            accessibilityLabel: completeAccessibilityLabel,
            action: completeReturn
        )
        .padding(.horizontal, 32)
        .padding(.bottom, 32)
    }

    private var returnLabel: String {
        if allReturned { return "Complete Return" }
        if !hasReturned, hasBatteryScanStep { return "Scan Battery Units" }
        return "Return \(returnedCount) of \(totalItems) Items"
    }

    private var completeAccessibilityLabel: String {
        if isCompleting { return "Processing return" }
        if !hasReturned, hasBatteryScanStep { return "Scan returned battery units before completing" }
        if !hasReturned { return "Scan at least one item before returning" }
        if allReturned { return "Complete Return, all \(totalItems) items" }
        return "Return \(returnedCount) of \(totalItems) items"
    }

    // MARK: - Checklist Panel

    private var checklistPanel: some View {
        VStack(alignment: .leading, spacing: 0) {
            VStack(alignment: .leading, spacing: 8) {
                Text(detail?.title ?? "Return")
                    .font(.headline)
                    .foregroundStyle(.white)
                if let ref = detail?.refNumber {
                    Text(ref)
                        .font(.caption.monospaced())
                        .foregroundStyle(.secondary)
                }
                if totalItems > 0 {
                    ChecklistProgressSummary(
                        done: returnedCount,
                        total: totalItems,
                        verb: "returned",
                        complete: allReturned
                    )
                }
            }
            .padding(20)

            Divider().background(KioskStroke.divider)

            if let items = detail?.items {
                ScrollViewReader { proxy in
                    ScrollView {
                        LazyVStack(spacing: 0) {
                            ForEach(items) { item in
                                KioskChecklistRow(
                                    name: item.name,
                                    tag: item.tagName,
                                    isDone: returnedIds.contains(item.id),
                                    isBattery: item.isNumberedBulk,
                                    strikethroughWhenDone: true
                                )
                                    .id(item.id)
                                Divider().background(KioskStroke.hairline)
                            }
                        }
                    }
                    .onChange(of: lastReturnedId) { _, newId in
                        guard let newId else { return }
                        if reduceMotion {
                            proxy.scrollTo(newId, anchor: .center)
                        } else {
                            withAnimation(.easeOut(duration: 0.25)) {
                                proxy.scrollTo(newId, anchor: .center)
                            }
                        }
                    }
                }
            } else if isLoading {
                Spacer()
                ProgressView().tint(.white).frame(maxWidth: .infinity)
                Spacer()
            } else if let loadError {
                // Detail-load error — distinct recovery surface from
                // complete-failure (which now flows through showFeedback to
                // the in-flow banner near the progress ring).
                KioskErrorState(title: loadError) { Task { await loadDetail() } }
                    .padding()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .background(KioskSurface.sunken)
    }

    // MARK: - Logic

    private func handleScan(_ value: String) {
        guard !isCompleting else {
            showFeedback(.error("Hold on — completing return"))
            return
        }

        store.resetInactivity()

        Task {
            do {
                let result = try await KioskAPI.shared.kioskCheckinScan(bookingId: bookingId, scanValue: value)
                if result.success, let item = result.item {
                    if returnedIds.contains(item.id) {
                        showFeedback(.alreadyReturned("\(item.tagName) already returned"))
                    } else {
                        returnedIds.insert(item.id)
                        lastReturnedId = item.id
                        showFeedback(.success(result.locationMessage ?? item.name))
                    }
                } else {
                    showFeedback(.error(result.error ?? "Item not in this checkout"))
                }
            } catch {
                let message = (error as? APIError)?.errorDescription ?? "Scan failed"
                showFeedback(.error(message))
            }
        }
    }

    private func showFeedback(_ feedback: ScanFeedback) {
        withAnimation { lastResult = feedback }
        switch feedback {
        case .success:        Haptics.success()
        case .alreadyReturned: Haptics.warning()
        case .error:          Haptics.error()
        }
        UIAccessibility.post(notification: .announcement, argument: feedback.message)
        Task {
            try? await Task.sleep(nanoseconds: 3_000_000_000)
            withAnimation { lastResult = nil }
        }
    }

    private func completeReturn() {
        guard hasReturned, !isCompleting else { return }
        isCompleting = true
        Task {
            do {
                let result = try await KioskAPI.shared.kioskCheckinComplete(bookingId: bookingId, actorId: userId)
                Haptics.success()
                store.screen = .success(successMessage(for: result))
            } catch {
                let message = (error as? APIError)?.errorDescription
                    ?? "Return failed. Please try again."
                showFeedback(.error(message))
            }
            isCompleting = false
        }
    }

    /// Use the SERVER-authoritative counts in the success message — local
    /// counts can drift if a sister kiosk checked items in mid-session.
    private func successMessage(for result: KioskCheckinCompleteResult) -> String {
        if result.completed {
            return "All \(result.totalItems) items returned. Thanks!"
        }
        return "\(result.returnedItems) of \(result.totalItems) items returned."
    }

    private func loadDetail() async {
        isLoading = true
        loadError = nil
        do {
            let loaded = try await KioskAPI.shared.kioskCheckoutDetail(id: bookingId)
            detail = loaded
            // Pre-populate already-returned items (mid-session resume).
            for item in loaded.items where item.returned {
                returnedIds.insert(item.id)
            }
        } catch {
            self.loadError = (error as? APIError)?.errorDescription ?? "Could not load return details."
        }
        isLoading = false
    }
}

// MARK: - Sub-views

private extension KioskCheckoutDetail {
    var isOverdue: Bool { endsAt < Date() }
}
