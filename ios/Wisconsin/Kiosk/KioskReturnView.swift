import SwiftUI

private let kioskRed = Color(red: 197/255, green: 5/255, blue: 12/255)

struct KioskReturnView: View {
    @Environment(KioskStore.self) private var store
    let bookingId: String
    let userId: String

    @State private var detail: KioskCheckoutDetail?
    @State private var returnedIds: Set<String> = []
    @State private var lastResult: ScanFeedback?
    @State private var isLoading = true
    @State private var isCompleting = false
    @State private var error: String?

    enum ScanFeedback {
        case success(String)
        case error(String)
        case alreadyReturned(String)
    }

    private var totalItems: Int { detail?.items.count ?? 0 }
    private var returnedCount: Int { returnedIds.count }
    private var hasReturned: Bool { returnedCount > 0 }

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
                Spacer()
                Text("Return")
                    .font(.title3.bold())
                    .foregroundStyle(.white)
                Spacer()
                Spacer().frame(width: 60)
            }

            Spacer()

            if isLoading {
                ProgressView().tint(.white)
            } else {
                VStack(spacing: 20) {
                    ZStack {
                        Circle()
                            .stroke(Color.white.opacity(0.1), lineWidth: 8)
                        Circle()
                            .trim(from: 0, to: totalItems > 0 ? CGFloat(returnedCount) / CGFloat(totalItems) : 0)
                            .stroke(returnedCount == totalItems ? Color.green : .blue,
                                    style: StrokeStyle(lineWidth: 8, lineCap: .round))
                            .rotationEffect(.degrees(-90))
                            .animation(.spring(response: 0.4), value: returnedCount)
                        VStack(spacing: 2) {
                            Text("\(returnedCount)")
                                .font(.system(size: 40, weight: .bold, design: .rounded))
                                .foregroundStyle(.white)
                            Text("of \(totalItems)")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                    .frame(width: 140, height: 140)

                    if let detail, detail.isOverdue {
                        Label("Overdue", systemImage: "exclamationmark.triangle.fill")
                            .font(.caption.weight(.medium))
                            .foregroundStyle(.orange)
                    }

                    Text(returnedCount == totalItems ? "All items returned" : "Scan items to return them")
                        .font(.subheadline)
                        .foregroundStyle(returnedCount == totalItems ? .green : .secondary)

                    if let result = lastResult {
                        FeedbackBanner(result: result)
                            .transition(.move(edge: .bottom).combined(with: .opacity))
                            .animation(.spring(response: 0.3), value: lastResult != nil)
                    }
                }
            }

            Spacer()

            // Partial returns are allowed — button enabled as soon as anything is scanned
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
                    (!hasReturned || isCompleting) ? Color.white.opacity(0.1) : kioskRed,
                    in: RoundedRectangle(cornerRadius: 14)
                )
            }
            .buttonStyle(.plain)
            .disabled(!hasReturned || isCompleting)
            .padding(.horizontal, 32)
            .padding(.bottom, 32)
        }
        .padding(.horizontal, 32)
        .padding(.top, 20)
        .frame(maxWidth: .infinity)
    }

    private var returnLabel: String {
        if returnedCount == totalItems { return "Complete Return" }
        return "Return \(returnedCount) of \(totalItems) Items"
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
                ScrollView {
                    LazyVStack(spacing: 0) {
                        ForEach(items) { item in
                            ReturnItemRow(item: item, returned: returnedIds.contains(item.id))
                            Divider().background(Color.white.opacity(0.06))
                        }
                    }
                }
            } else if isLoading {
                Spacer()
                ProgressView().tint(.white).frame(maxWidth: .infinity)
                Spacer()
            }

            if let error {
                Text(error).foregroundStyle(.red).font(.caption).padding()
            }
        }
        .background(Color.white.opacity(0.02))
    }

    // MARK: - Logic

    private func handleScan(_ value: String) {
        store.resetInactivity()

        Task {
            do {
                let result = try await KioskAPI.shared.kioskCheckinScan(bookingId: bookingId, scanValue: value)
                if result.success, let item = result.item {
                    if returnedIds.contains(item.id) {
                        showFeedback(.alreadyReturned("\(item.tagName) already returned"))
                    } else {
                        returnedIds.insert(item.id)
                        showFeedback(.success(item.name))
                    }
                } else {
                    showFeedback(.error(result.error ?? "Item not in this checkout"))
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

    private func completeReturn() {
        guard hasReturned, !isCompleting else { return }
        isCompleting = true
        Task {
            do {
                try await KioskAPI.shared.kioskCheckinComplete(bookingId: bookingId, actorId: userId)
                let allBack = returnedCount == totalItems
                store.screen = .success(allBack
                    ? "All \(returnedCount) items returned. Thanks!"
                    : "\(returnedCount) of \(totalItems) items returned.")
            } catch {
                self.error = "Return failed. Please try again."
            }
            isCompleting = false
        }
    }

    private func loadDetail() async {
        isLoading = true
        do {
            let loaded = try await KioskAPI.shared.kioskCheckoutDetail(id: bookingId)
            detail = loaded
            // Pre-populate already-returned items (in case returning mid-session)
            for item in loaded.items where item.returned {
                returnedIds.insert(item.id)
            }
        } catch {
            self.error = "Could not load return details."
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
                .foregroundStyle(returned ? .green : Color.white.opacity(0.3))
                .font(.title3)
                .frame(width: 28)
            VStack(alignment: .leading, spacing: 2) {
                Text(item.name)
                    .font(.subheadline)
                    .foregroundStyle(returned ? Color.white.opacity(0.5) : .white)
                    .strikethrough(returned, color: Color.white.opacity(0.3))
                Text(item.tagName)
                    .font(.caption.monospaced())
                    .foregroundStyle(.secondary)
            }
            Spacer()
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 14)
        .animation(.spring(response: 0.25), value: returned)
    }
}

private struct FeedbackBanner: View {
    let result: KioskReturnView.ScanFeedback

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: icon)
            Text(message).font(.subheadline.weight(.medium))
        }
        .foregroundStyle(color)
        .padding(.horizontal, 20)
        .padding(.vertical, 12)
        .background(color.opacity(0.15), in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(color.opacity(0.4), lineWidth: 1))
    }

    private var icon: String {
        switch result {
        case .success: return "checkmark.circle.fill"
        case .error: return "xmark.circle.fill"
        case .alreadyReturned: return "exclamationmark.triangle.fill"
        }
    }
    private var message: String {
        switch result {
        case .success(let s), .error(let s), .alreadyReturned(let s): return s
        }
    }
    private var color: Color {
        switch result {
        case .success: return .green
        case .error: return .red
        case .alreadyReturned: return .orange
        }
    }
}

private extension KioskCheckoutDetail {
    var isOverdue: Bool { endsAt < Date() }
}
