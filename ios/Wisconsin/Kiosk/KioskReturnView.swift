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
                Text("Return")
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
                VStack(spacing: 20) {
                    progressRing

                    if let detail, detail.isOverdue {
                        Label("Overdue", systemImage: "exclamationmark.triangle.fill")
                            .font(.caption.weight(.medium))
                            .foregroundStyle(Color.statusText(.orange))
                            .accessibilityLabel("This checkout is overdue")
                    }

                    Text(allReturned ? "All items returned" : "Scan items to return them")
                        .font(.subheadline)
                        .foregroundStyle(allReturned ? Color.statusText(.green) : .secondary)

                    if hasBatteryScanStep {
                        BatteryScanStatus(
                            title: "Battery Units",
                            count: returnedBatteryCount,
                            total: batteryTotal,
                            pendingCopy: "Scan each returned battery unit QR so custody closes on the exact units.",
                            scannedUnits: returnedBatteryUnits
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

            completeButton
        }
        .padding(.horizontal, 32)
        .padding(.top, 20)
        .frame(maxWidth: .infinity)
    }

    private var progressRing: some View {
        ZStack {
            Circle()
                .stroke(Color.white.opacity(0.1), lineWidth: 8)
            Circle()
                .trim(from: 0, to: totalItems > 0 ? CGFloat(returnedCount) / CGFloat(totalItems) : 0)
                .stroke(allReturned ? Color.statusText(.green) : Color.statusText(.blue),
                        style: StrokeStyle(lineWidth: 8, lineCap: .round))
                .rotationEffect(.degrees(-90))
                .animation(reduceMotion ? nil : .spring(response: 0.4), value: returnedCount)
            VStack(spacing: 2) {
                Text("\(returnedCount)")
                    .font(.system(size: 40, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
                    .contentTransition(.numericText())
                    .animation(reduceMotion ? nil : .easeInOut(duration: 0.25), value: returnedCount)
                    .monospacedDigit()
                Text("of \(totalItems)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .frame(width: 140, height: 140)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(returnedCount) of \(totalItems) items returned")
    }

    private var completeButton: some View {
        Button {
            completeReturn()
        } label: {
            HStack {
                Text(isCompleting ? "Processing..." : returnLabel)
                    .font(.headline)
                if isCompleting { ProgressView().tint(.white).scaleEffect(0.8) }
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 16)
            .background(
                (!hasReturned || isCompleting) ? Color.white.opacity(0.1) : Color.kioskRed,
                in: RoundedRectangle(cornerRadius: 14)
            )
        }
        .buttonStyle(.plain)
        .disabled(!hasReturned || isCompleting)
        .padding(.horizontal, 32)
        .padding(.bottom, 32)
        .accessibilityLabel(completeAccessibilityLabel)
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
            VStack(alignment: .leading, spacing: 4) {
                Text(detail?.title ?? "Return")
                    .font(.headline)
                    .foregroundStyle(.white)
                if let ref = detail?.refNumber {
                    Text(ref)
                        .font(.caption.monospaced())
                        .foregroundStyle(.secondary)
                }
            }
            .padding(20)

            Divider().background(Color.white.opacity(0.1))

            if let items = detail?.items {
                ScrollViewReader { proxy in
                    ScrollView {
                        LazyVStack(spacing: 0) {
                            ForEach(items) { item in
                                ReturnItemRow(item: item, returned: returnedIds.contains(item.id))
                                    .id(item.id)
                                Divider().background(Color.white.opacity(0.06))
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
                VStack(spacing: 10) {
                    Image(systemName: "wifi.exclamationmark")
                        .font(.title)
                        .foregroundStyle(Color.statusText(.red))
                    Text(loadError)
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
        case .success:        .success
        case .alreadyReturned: .warning
        case .error:          .error
        case nil:             nil
        }
    }

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
                        showFeedback(.success(item.name))
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

private struct ReturnItemRow: View {
    let item: KioskCheckoutDetail.ReturnItem
    let returned: Bool

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: returned ? "checkmark.circle.fill" : "circle")
                .foregroundStyle(returned ? Color.statusText(.green) : Color.white.opacity(0.3))
                .font(.title3)
                .frame(width: 28)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text(item.name)
                        .font(.subheadline)
                        .foregroundStyle(returned ? Color.white.opacity(0.5) : .white)
                        .strikethrough(returned, color: Color.white.opacity(0.3))
                    if item.isNumberedBulk {
                        Image(systemName: "battery.100percent")
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(Color.statusText(.orange))
                            .accessibilityLabel("Battery unit")
                    }
                }
                Text(item.tagName)
                    .font(.caption.monospaced())
                    .foregroundStyle(.secondary)
            }
            Spacer()
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 14)
        .animation(.spring(response: 0.25), value: returned)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(item.name), tag \(item.tagName), \(returned ? "returned" : "pending")")
    }
}

private struct BatteryScanStatus: View {
    let title: String
    let count: Int
    let total: Int
    let pendingCopy: String
    let scannedUnits: [KioskCheckoutDetail.ReturnItem]

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
                    Text(complete ? "All \(total) units returned" : "\(count) of \(total) units returned")
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
                    Text("Returned units")
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
    let units: [KioskCheckoutDetail.ReturnItem]

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
    let result: KioskReturnView.ScanFeedback

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
        case .success:         return "checkmark.circle.fill"
        case .error:           return "xmark.circle.fill"
        case .alreadyReturned: return "exclamationmark.triangle.fill"
        }
    }
    private var message: String { result.message }
    private var color: Color {
        switch result {
        case .success:         return Color.statusText(.green)
        case .error:           return Color.statusText(.red)
        case .alreadyReturned: return Color.statusText(.orange)
        }
    }
}

private extension KioskCheckoutDetail {
    var isOverdue: Bool { endsAt < Date() }
}
