import SwiftUI

struct ScannerDebuggerView: View {
    @State private var isSearching = false
    @State private var results: SearchResults?
    @State private var resultError: String?
    @State private var showManualEntry = false
    @State private var navigationPath = NavigationPath()
    @State private var lastRawScan: String?
    @State private var lastHandledCode: String?
    @State private var lastHandledAt: Date = .distantPast
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack(path: $navigationPath) {
            List {
                Section {
                    statusCard
                        .listRowInsets(EdgeInsets())
                        .listRowBackground(Color.clear)
                }

                Section("Last scan") {
                    LabeledContent("Raw value") {
                        Text(lastRawScan ?? "Waiting")
                            .font(.system(.body, design: .monospaced))
                            .foregroundStyle(lastRawScan == nil ? .secondary : .primary)
                            .textSelection(.enabled)
                    }
                    LabeledContent("Trimmed value") {
                        Text(lastHandledCode ?? "Waiting")
                            .font(.system(.body, design: .monospaced))
                            .foregroundStyle(lastHandledCode == nil ? .secondary : .primary)
                            .textSelection(.enabled)
                    }
                    LabeledContent("Lookup") {
                        if isSearching {
                            ProgressView()
                                .controlSize(.small)
                        } else if resultError != nil {
                            Text("Error")
                                .foregroundStyle(Color.statusText(.red))
                        } else if let results, !results.isEmpty {
                            Text("Matched")
                                .foregroundStyle(Color.statusText(.green))
                        } else if results != nil {
                            Text("No match")
                                .foregroundStyle(Color.statusText(.orange))
                        } else {
                            Text("Ready")
                                .foregroundStyle(.secondary)
                        }
                    }
                }

                Section {
                    Button {
                        showManualEntry = true
                    } label: {
                        Label("Type code instead", systemImage: "keyboard")
                    }

                    if let code = lastHandledCode {
                        Button {
                            retry(code)
                        } label: {
                            Label("Run last scan again", systemImage: "arrow.clockwise")
                        }
                        .disabled(isSearching)
                    }
                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle("Scanner Debugger")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }
                }
            }
            .overlay(alignment: .bottom) {
                HIDScannerField { value in
                    handleScan(value)
                }
                .frame(width: 1, height: 1)
                .opacity(0)
            }
            .navigationDestination(for: Asset.self) { asset in
                ItemDetailView(assetId: asset.id)
            }
            .navigationDestination(for: Booking.self) { booking in
                BookingDetailView(bookingId: booking.id)
            }
            .navigationDestination(for: BookingRouteId.self) { route in
                BookingDetailView(bookingId: route.id)
            }
            .sheet(isPresented: Binding(
                get: { results != nil || resultError != nil },
                set: { presented in
                    if !presented {
                        results = nil
                        resultError = nil
                    }
                }
            )) {
                ScanResultSheet(
                    results: results ?? SearchResults(),
                    error: resultError,
                    navigationPath: $navigationPath,
                    onTypeCode: {
                        results = nil
                        resultError = nil
                        showManualEntry = true
                    },
                    onRetry: retryLastScan,
                    onRefresh: refreshLookup
                )
                .presentationDetents(resultSheetDetents)
                .presentationDragIndicator(.visible)
            }
            .sheet(isPresented: $showManualEntry) {
                ScanManualEntrySheet { code in
                    showManualEntry = false
                    handleScan(code)
                }
                .presentationDetents([.medium])
                .presentationDragIndicator(.visible)
            }
            .animation(reduceMotion ? nil : .spring(duration: 0.25), value: isSearching)
        }
    }

    private var statusCard: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(spacing: 14) {
                ZStack {
                    Circle()
                        .fill(Color.statusBackground(isSearching ? .blue : .green))
                    Image(systemName: isSearching ? "magnifyingglass" : "barcode.viewfinder")
                        .font(.title3.weight(.semibold))
                        .foregroundStyle(Color.statusText(isSearching ? .blue : .green))
                }
                .frame(width: 48, height: 48)

                VStack(alignment: .leading, spacing: 4) {
                    Text(isSearching ? "Looking up scan" : "Ready for scanner")
                        .font(.headline)
                    Text(statusSubtitle)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
            }

            Text("Keep this screen open, scan a real gear label with the hand scanner, and the normal scan hero card will open from the lookup result.")
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .accessibilityElement(children: .combine)
    }

    private var statusSubtitle: String {
        if let lastHandledCode {
            return "Last scan: \(lastHandledCode)"
        }
        return "Scanner must be in HID keyboard mode with Return after scan."
    }

    private var resultSheetDetents: Set<PresentationDetent> {
        guard resultError == nil, let results, !results.isEmpty else {
            return [.medium]
        }
        return [.medium, .large]
    }

    private func handleScan(_ value: String) {
        lastRawScan = value
        let code = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !code.isEmpty else { return }

        let now = Date()
        if code == lastHandledCode, now.timeIntervalSince(lastHandledAt) < 1.5 {
            return
        }
        lastHandledCode = code
        lastHandledAt = now

        isSearching = true
        resultError = nil
        results = nil

        Task {
            defer { isSearching = false }
            do {
                let outcome = try await SearchService.shared.search(query: code, rawScan: code)
                results = outcome
                if outcome.isEmpty {
                    Haptics.warning()
                } else {
                    Haptics.success()
                }
            } catch {
                resultError = (error as? APIError)?.errorDescription
                    ?? "Couldn't reach the server. Try again in a moment."
                Haptics.error()
            }
        }
    }

    private func retry(_ code: String) {
        lastHandledCode = nil
        lastHandledAt = .distantPast
        handleScan(code)
    }

    private func retryLastScan() {
        guard let code = lastHandledCode else { return }
        retry(code)
    }

    private func refreshLookup() async {
        guard let code = lastHandledCode else { return }
        if let fresh = try? await SearchService.shared.search(query: code, rawScan: code),
           !fresh.isEmpty {
            results = fresh
        }
    }
}
