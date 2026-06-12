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
            Divider().background(Color.white.opacity(0.1))
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
                feedbackTone: cameraTone(for: lastResult),
                onScan: { value in handleScan(value) },
                onCancel: { showCamera = false }
            )
        }
    }

    // MARK: - Scan Zone

    private var scanZone: some View {
        VStack(spacing: 24) {
            HStack {
                Button {
                    store.screen = .idle
                } label: {
                    Label("Back", systemImage: "chevron.left")
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(.secondary)
                }
                .accessibilityLabel("Back to roster")
                Spacer()
                Text("Pickup")
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
                .accessibilityLabel("Use camera to scan instead")
            }

            Spacer()

            if isLoading {
                ProgressView().tint(.white)
            } else {
                VStack(spacing: 24) {
                    progressRing
                    VStack(spacing: 6) {
                        Text(allConfirmed ? "All items confirmed" : "Scan each item to confirm pickup")
                            .font(.title3.weight(.semibold))
                            .foregroundStyle(allConfirmed ? Color.statusText(.green) : .white)
                            .multilineTextAlignment(.center)
                        if !allConfirmed {
                            Text("Use the hand scanner, or tap Camera to scan with the iPad.")
                                .font(.subheadline)
                                .foregroundStyle(Color.white.opacity(0.55))
                                .multilineTextAlignment(.center)
                        }
                    }

                    if hasBatteryScanStep {
                        BatteryScanStatus(
                            title: "Battery Units",
                            count: confirmedBatteryCount,
                            total: batteryTotal,
                            pendingCopy: "Scan each battery unit QR before confirming pickup.",
                            scannedUnits: scannedBatteryUnits
                        )
                    }

                    if let result = lastResult {
                        FeedbackBanner(result: result)
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

    private var progressRing: some View {
        ZStack {
            Circle()
                .stroke(Color.white.opacity(0.1), lineWidth: 10)
            Circle()
                .trim(from: 0, to: totalItems > 0 ? CGFloat(confirmedCount) / CGFloat(totalItems) : 0)
                .stroke(allConfirmed ? Color.statusText(.green) : Color.kioskRed, style: StrokeStyle(lineWidth: 10, lineCap: .round))
                .rotationEffect(.degrees(-90))
                .animation(reduceMotion ? nil : .spring(response: 0.4), value: confirmedCount)
            VStack(spacing: 2) {
                Text("\(confirmedCount)")
                    .font(.system(size: 52, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
                    .contentTransition(.numericText())
                    .animation(reduceMotion ? nil : .easeInOut(duration: 0.25), value: confirmedCount)
                    .monospacedDigit()
                Text("of \(totalItems)")
                    .font(.subheadline)
                    .foregroundStyle(Color.white.opacity(0.55))
            }
        }
        .frame(width: 176, height: 176)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(confirmedCount) of \(totalItems) items confirmed")
    }

    private var confirmButton: some View {
        Button {
            confirmPickup()
        } label: {
            HStack(spacing: 10) {
                if !isConfirming {
                    Image(systemName: allConfirmed ? "checkmark.circle.fill" : "barcode.viewfinder")
                        .font(.headline)
                        .accessibilityHidden(true)
                }
                Text(isConfirming ? "Confirming..." : confirmButtonTitle)
                    .font(.headline)
                if isConfirming { ProgressView().tint(.white).scaleEffect(0.8) }
            }
            .foregroundStyle(allConfirmed && !isConfirming ? .white : Color.white.opacity(0.55))
            .frame(maxWidth: .infinity)
            .padding(.vertical, 18)
            .background(
                (!allConfirmed || isConfirming) ? Color.white.opacity(0.08) : Color.statusText(.green),
                in: RoundedRectangle(cornerRadius: 14)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 14)
                    .stroke(Color.white.opacity(allConfirmed ? 0 : 0.1), lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .disabled(!allConfirmed || isConfirming)
        .padding(.horizontal, 32)
        .padding(.bottom, 32)
        .accessibilityLabel(confirmAccessibilityLabel)
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
                    .foregroundStyle(.white)
                if let ref = detail?.refNumber {
                    Text(ref)
                        .font(.caption.monospaced())
                        .foregroundStyle(.secondary)
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

            Divider().background(Color.white.opacity(0.1))

            if let items = detail?.items {
                ScrollViewReader { proxy in
                    ScrollView {
                        LazyVStack(spacing: 0) {
                            ForEach(items) { item in
                                PickupItemRow(
                                    item: item,
                                    confirmed: confirmedIds.contains(item.id),
                                    scannedItem: confirmedItemOverrides[item.id]
                                )
                                    .id(item.id)
                                Divider().background(Color.white.opacity(0.06))
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
                ProgressView().tint(.white).frame(maxWidth: .infinity)
                Spacer()
            } else if let error {
                // Detail-load error (not confirm error — confirm errors flow
                // through showFeedback so they appear next to the progress ring).
                VStack(spacing: 10) {
                    Image(systemName: "wifi.exclamationmark")
                        .font(.title)
                        .foregroundStyle(Color.statusText(.red))
                    Text(error)
                        .foregroundStyle(.white)
                        .font(.subheadline)
                        .multilineTextAlignment(.center)
                    Button("Try again") { Task { await loadDetail() } }
                        .buttonStyle(.bordered)
                        .tint(.white)
                }
                .padding()
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .background(Color.white.opacity(0.02))
    }

    // MARK: - Logic

    private func cameraTone(for feedback: ScanFeedback?) -> KioskBarcodeCameraView.Tone? {
        switch feedback {
        case .success:          .success
        case .alreadyConfirmed: .warning
        case .error:            .error
        case nil:               nil
        }
    }

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
                        showFeedback(.success(item.name))
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
                store.screen = .success("Pickup confirmed! \(confirmedCount) items checked out.")
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
            detail = try await KioskAPI.shared.kioskCheckoutDetail(id: bookingId)
        } catch {
            self.error = (error as? APIError)?.errorDescription ?? "Could not load pickup details."
        }
        isLoading = false
    }
}

// MARK: - Sub-views

/// "n of m <verb>" line + thin progress bar for the checklist panel header.
/// Internal (not private) so KioskReturnView shares the identical treatment.
struct ChecklistProgressSummary: View {
    let done: Int
    let total: Int
    let verb: String
    let complete: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("\(done) of \(total) \(verb)")
                .font(.caption.weight(.semibold).monospacedDigit())
                .foregroundStyle(complete ? Color.statusText(.green) : Color.white.opacity(0.7))
                .contentTransition(.numericText())
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule()
                        .fill(Color.white.opacity(0.1))
                    Capsule()
                        .fill(complete ? Color.statusText(.green) : Color.kioskRed)
                        .frame(width: total > 0 ? geo.size.width * CGFloat(done) / CGFloat(total) : 0)
                        .animation(.spring(response: 0.4), value: done)
                }
            }
            .frame(height: 4)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(done) of \(total) \(verb)")
    }
}

private struct PickupItemRow: View {
    let item: KioskCheckoutDetail.ReturnItem
    let confirmed: Bool
    let scannedItem: KioskScanResult.ScannedItem?

    private var displayName: String { scannedItem?.name ?? item.name }
    private var displayTag: String { scannedItem?.tagName ?? item.tagName }

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: confirmed ? "checkmark.circle.fill" : "circle")
                .foregroundStyle(confirmed ? Color.statusText(.green) : Color.white.opacity(0.3))
                .font(.title3)
                .frame(width: 28)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text(displayName)
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(confirmed ? Color.white.opacity(0.6) : .white)
                    if item.isNumberedBulk {
                        Image(systemName: "battery.100percent")
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(Color.statusText(.orange))
                            .accessibilityLabel("Battery unit")
                    }
                }
                // Tag repeats the display name for assets without a separate
                // tag — hide the duplicate line so rows stay scannable.
                if displayTag.caseInsensitiveCompare(displayName) != .orderedSame {
                    Text(displayTag)
                        .font(.caption.monospaced())
                        .foregroundStyle(.secondary)
                }
            }
            Spacer()
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 16)
        .animation(.spring(response: 0.25), value: confirmed)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(displayName), tag \(displayTag), \(confirmed ? "confirmed" : "pending")")
    }
}

private struct BatteryScanStatus: View {
    let title: String
    let count: Int
    let total: Int
    let pendingCopy: String
    let scannedUnits: [KioskScanResult.ScannedItem]

    var complete: Bool { count >= total && total > 0 }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 10) {
                Image(systemName: complete ? "battery.100percent" : "battery.25percent")
                    .font(.title3)
                    .foregroundStyle(complete ? Color.statusText(.green) : Color.statusText(.orange))
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.white)
                    Text(complete ? "All \(total) units scanned" : "\(count) of \(total) units scanned")
                        .font(.caption.monospacedDigit())
                        .foregroundStyle(.secondary)
                    if !complete {
                        Text(pendingCopy)
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                }
                Spacer()
            }
            if !scannedUnits.isEmpty {
                VStack(alignment: .leading, spacing: 6) {
                    Text("Scanned units")
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(.secondary)
                    FlexibleUnitChips(units: scannedUnits)
                }
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .background(Color.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.white.opacity(0.08), lineWidth: 1))
        .accessibilityElement(children: .combine)
    }
}

private struct FlexibleUnitChips: View {
    let units: [KioskScanResult.ScannedItem]

    var body: some View {
        ViewThatFits(in: .horizontal) {
            HStack(spacing: 6) { chipContent }
            VStack(alignment: .leading, spacing: 6) { chipContent }
        }
    }

    @ViewBuilder
    private var chipContent: some View {
        ForEach(units) { unit in
            Text(unit.tagName)
                .font(.caption2.monospaced().weight(.semibold))
                .foregroundStyle(Color.statusText(.green))
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(Color.statusText(.green).opacity(0.12), in: Capsule())
                .overlay(Capsule().stroke(Color.statusText(.green).opacity(0.25), lineWidth: 1))
        }
    }
}

private struct FeedbackBanner: View {
    let result: KioskPickupView.ScanFeedback

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: icon).accessibilityHidden(true)
            Text(message).font(.subheadline.weight(.medium))
        }
        .foregroundStyle(color)
        .padding(.horizontal, 20)
        .padding(.vertical, 12)
        .background(color.opacity(0.15), in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(color.opacity(0.4), lineWidth: 1))
        .accessibilityElement(children: .combine)
    }

    private var icon: String {
        switch result {
        case .success:          return "checkmark.circle.fill"
        case .error:            return "xmark.circle.fill"
        case .alreadyConfirmed: return "exclamationmark.triangle.fill"
        }
    }
    private var message: String { result.message }
    private var color: Color {
        switch result {
        case .success:          return Color.statusText(.green)
        case .error:            return Color.statusText(.red)
        case .alreadyConfirmed: return Color.statusText(.orange)
        }
    }
}
