import SwiftUI
import UIKit

struct KioskPickupView: View {
    @Environment(KioskStore.self) private var store
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    let bookingId: String
    let userId: String

    @State private var detail: KioskCheckoutDetail?
    @State private var confirmedIds: Set<String> = []
    @State private var lastResult: ScanFeedback?
    @State private var isLoading = true
    @State private var isConfirming = false
    @State private var error: String?
    @State private var showCamera = false
    @State private var lastConfirmedId: String?
    @State private var confirmedItemOverrides: [String: KioskScanResult.ScannedItem] = [:]

    enum ScanFeedback: Equatable {
        case success(String)
        case error(String)
        case alreadyConfirmed(String)

        var message: String {
            switch self {
            case .success(let s), .error(let s), .alreadyConfirmed(let s): return s
            }
        }

        var tone: KioskBannerTone {
            switch self {
            case .success:          .success
            case .error:            .error
            case .alreadyConfirmed: .warning
            }
        }
    }

    private var totalItems: Int { detail?.items.count ?? 0 }
    private var confirmedCount: Int { confirmedIds.count }
    private var allConfirmed: Bool { confirmedCount >= totalItems && totalItems > 0 }
    private var batteryTotal: Int { detail?.scanSummary?.numberedBulkTotal ?? detail?.numberedBulkItems.count ?? 0 }
    private var confirmedBatteryCount: Int {
        detail?.numberedBulkItems.filter { confirmedIds.contains($0.id) }.count ?? 0
    }
    private var hasBatteryScanStep: Bool { batteryTotal > 0 }
    private var remainingBatteryCount: Int { max(0, batteryTotal - confirmedBatteryCount) }
    private var scannedBatteryUnits: [KioskScanResult.ScannedItem] {
        detail?.numberedBulkItems.compactMap { confirmedItemOverrides[$0.id] } ?? []
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
                title: "Pickup",
                onBack: { store.screen = .idle },
                onCamera: { showCamera = true }
            )

            Spacer()

            if isLoading {
                ProgressView().tint(KioskText.primary)
            } else {
                VStack(spacing: 24) {
                    KioskProgressRing(
                        count: confirmedCount,
                        total: totalItems,
                        isComplete: allConfirmed,
                        reduceMotion: reduceMotion,
                        accessibilityText: "\(confirmedCount) of \(totalItems) items confirmed"
                    )
                    VStack(spacing: 6) {
                        Text(allConfirmed ? "All items confirmed" : "Scan each item to confirm pickup")
                            .font(.title3.weight(.semibold))
                            .foregroundStyle(allConfirmed ? Color.statusText(.green) : KioskText.primary)
                            .multilineTextAlignment(.center)
                        if !allConfirmed {
                            Text("Use the hand scanner, or tap Camera to scan with the iPad.")
                                .font(.subheadline)
                                .foregroundStyle(KioskText.tertiary)
                                .multilineTextAlignment(.center)
                        }
                    }

                    if hasBatteryScanStep {
                        KioskBatteryScanStatus(
                            title: "Battery Units",
                            count: confirmedBatteryCount,
                            total: batteryTotal,
                            pendingCopy: "Scan each battery unit QR before confirming pickup.",
                            completeCopy: "All \(batteryTotal) units scanned",
                            progressCopy: "\(confirmedBatteryCount) of \(batteryTotal) units scanned",
                            unitsHeader: "Scanned units",
                            scannedUnits: scannedBatteryUnits.map { KioskScannedUnit(id: $0.id, tag: $0.tagName) }
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

            confirmButton
        }
        .padding(.horizontal, 32)
        .padding(.top, 20)
        .frame(maxWidth: .infinity)
    }

    private var confirmButton: some View {
        KioskCompletionButton(
            title: confirmButtonTitle,
            icon: allConfirmed ? "checkmark.circle.fill" : "barcode.viewfinder",
            isEnabled: allConfirmed,
            isBusy: isConfirming,
            busyTitle: "Confirming...",
            accessibilityLabel: confirmAccessibilityLabel,
            action: confirmPickup
        )
        .padding(.horizontal, 32)
        .padding(.bottom, 32)
    }

    private var confirmAccessibilityLabel: String {
        if isConfirming { return "Confirming pickup" }
        if allConfirmed { return "Confirm Pickup, \(totalItems) item\(totalItems == 1 ? "" : "s")" }
        if remainingBatteryCount > 0 {
            return "Scan \(remainingBatteryCount) more battery unit\(remainingBatteryCount == 1 ? "" : "s") before confirming"
        }
        let remaining = totalItems - confirmedCount
        return "Scan \(remaining) more item\(remaining == 1 ? "" : "s") before confirming"
    }

    private var confirmButtonTitle: String {
        if allConfirmed { return "Confirm Pickup" }
        if remainingBatteryCount > 0 {
            return "Scan \(remainingBatteryCount) Battery Unit\(remainingBatteryCount == 1 ? "" : "s")"
        }
        let remaining = max(0, totalItems - confirmedCount)
        return "Scan \(remaining) More Item\(remaining == 1 ? "" : "s")"
    }

    // MARK: - Checklist Panel

    private var checklistPanel: some View {
        VStack(alignment: .leading, spacing: 0) {
            VStack(alignment: .leading, spacing: 8) {
                Text(detail?.title ?? "Pickup")
                    .font(.headline)
                    .foregroundStyle(KioskText.primary)
                if let ref = detail?.refNumber {
                    Text(ref)
                        .font(.caption.monospaced())
                        .foregroundStyle(KioskText.secondary)
                }
                if totalItems > 0 {
                    ChecklistProgressSummary(
                        done: confirmedCount,
                        total: totalItems,
                        verb: "confirmed",
                        complete: allConfirmed
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
                                    name: confirmedItemOverrides[item.id]?.name ?? item.name,
                                    tag: confirmedItemOverrides[item.id]?.tagName ?? item.tagName,
                                    isDone: confirmedIds.contains(item.id),
                                    isBattery: item.isNumberedBulk
                                )
                                    .id(item.id)
                                Divider().background(KioskStroke.hairline)
                            }
                        }
                    }
                    .onChange(of: lastConfirmedId) { _, newId in
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
                ProgressView().tint(KioskText.primary).frame(maxWidth: .infinity)
                Spacer()
            } else if let error {
                // Detail-load error (not confirm error — confirm errors flow
                // through showFeedback so they appear next to the progress ring).
                KioskErrorState(title: error) { Task { await loadDetail() } }
                    .padding()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .background(KioskSurface.sunken)
    }

    // MARK: - Logic

    private func handleScan(_ value: String) {
        guard !isConfirming else {
            showFeedback(.error("Hold on — confirming pickup"))
            return
        }

        store.resetInactivity()
        guard let items = detail?.items else { return }

        Task {
            do {
                let result = try await KioskAPI.shared.kioskPickupScan(bookingId: bookingId, scanValue: value)
                if result.success, let item = result.item {
                    if confirmedIds.contains(item.id) {
                        showFeedback(.alreadyConfirmed("\(item.tagName) already confirmed"))
                    } else {
                        confirmedIds.insert(item.id)
                        confirmedItemOverrides[item.id] = item
                        lastConfirmedId = item.id
                        showFeedback(.success(result.locationMessage ?? item.name))
                    }
                } else {
                    let isInBooking = items.contains { $0.tagName.lowercased() == value.lowercased() || $0.id == value }
                    showFeedback(.error(result.error ?? (isInBooking ? "Already confirmed" : "Not in this pickup")))
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
        case .success:          Haptics.success()
        case .alreadyConfirmed: Haptics.warning()
        case .error:            Haptics.error()
        }
        UIAccessibility.post(notification: .announcement, argument: feedback.message)
        Task {
            try? await Task.sleep(nanoseconds: 3_000_000_000)
            withAnimation { lastResult = nil }
        }
    }

    private func confirmPickup() {
        guard allConfirmed, !isConfirming else { return }
        isConfirming = true
        Task {
            do {
                try await KioskAPI.shared.kioskPickupConfirm(bookingId: bookingId, actorId: userId)
                Haptics.success()
                let itemWord = confirmedCount == 1 ? "item" : "items"
                store.screen = .success(KioskSuccessInfo(
                    kind: .pickup,
                    message: "Pickup confirmed! \(confirmedCount) \(itemWord) checked out."
                ))
            } catch {
                let message = (error as? APIError)?.errorDescription
                    ?? "Could not confirm pickup. Please try again."
                showFeedback(.error(message))
            }
            isConfirming = false
        }
    }

    private func loadDetail() async {
        isLoading = true
        error = nil
        do {
            let loaded = try await KioskAPI.shared.kioskCheckoutDetail(id: bookingId)
            confirmedIds = []
            confirmedItemOverrides = [:]
            for item in loaded.items where item.returned {
                confirmedIds.insert(item.id)
                confirmedItemOverrides[item.id] = KioskScanResult.ScannedItem(
                    id: item.id,
                    name: item.name,
                    tagName: item.tagName,
                    type: item.type,
                    imageUrl: item.imageUrl,
                    bulkSkuId: item.bulkSkuId,
                    unitNumber: item.unitNumber
                )
            }
            detail = loaded
        } catch {
            self.error = (error as? APIError)?.errorDescription ?? "Could not load pickup details."
        }
        isLoading = false
    }
}
