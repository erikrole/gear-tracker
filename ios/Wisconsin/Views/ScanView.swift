import SwiftUI
import VisionKit
import AVFoundation

struct ScanView: View {
    @State private var isScanning = true
    @State private var isSearching = false
    @State private var results: SearchResults?
    @State private var resultError: String?
    @State private var showManualEntry = false
    @State private var torchOn = false
    @State private var navigationPath = NavigationPath()
    @State private var lastHandledCode: String?
    @State private var lastHandledAt: Date = .distantPast
    @State private var cameraAuth: AVAuthorizationStatus = AVCaptureDevice.authorizationStatus(for: .video)
    @Environment(AppState.self) private var appState
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.accessibilityVoiceOverEnabled) private var voiceOverEnabled
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        NavigationStack(path: $navigationPath) {
            scanContent
                .navigationTitle("Scan")
                .navigationBarTitleDisplayMode(.inline)
                .animation(reduceMotion ? nil : .spring(duration: 0.3), value: results != nil)
                .navigationDestination(for: Asset.self) { asset in
                    ItemDetailView(assetId: asset.id)
                }
                .navigationDestination(for: Booking.self) { booking in
                    BookingDetailView(bookingId: booking.id)
                }
                .onChange(of: scenePhase) { _, phase in
                    // Re-read after the user toggles camera in Settings.
                    if phase == .active {
                        cameraAuth = AVCaptureDevice.authorizationStatus(for: .video)
                    }
                    // Force-off torch when leaving the foreground.
                    if phase != .active {
                        torchOn = false
                        setTorch(false)
                    }
                }
                .onDisappear {
                    torchOn = false
                    setTorch(false)
                }
                .onChange(of: appState.tabResetToken) { _, _ in
                    guard appState.resetTab == 3 else { return }
                    navigationPath = NavigationPath()
                    results = nil
                    resultError = nil
                    showManualEntry = false
                    isSearching = false
                    isScanning = true
                }
        }
    }

    @ViewBuilder
    private var scanContent: some View {
        switch cameraAuth {
        case .notDetermined:
            ScanPrePromptView { granted in
                cameraAuth = granted ? .authorized : .denied
            }
        case .denied, .restricted:
            ScanDeniedView()
        case .authorized:
            scannerSurface
        @unknown default:
            scannerSurface
        }
    }

    @ViewBuilder
    private var scannerSurface: some View {
        ZStack(alignment: .bottom) {
            if voiceOverEnabled {
                ScanManualEntryView(onScan: handleScan)
            } else if DataScannerViewController.isSupported {
                DataScannerRepresentable(isScanning: $isScanning, onScan: handleScan)
                    .ignoresSafeArea()
            } else {
                ContentUnavailableView(
                    "Scanner Not Available",
                    systemImage: "camera.slash",
                    description: Text("This device doesn't support camera scanning.")
                )
            }

            // Bottom overlay: torch + manual-entry buttons + searching indicator.
            // Skipped for VoiceOver users (the manual-entry view is the whole surface).
            if !voiceOverEnabled, cameraAuth == .authorized, DataScannerViewController.isSupported {
                bottomOverlay
            }
        }
        .sheet(isPresented: Binding(
            get: { results != nil || resultError != nil },
            set: { presented in
                if !presented {
                    results = nil
                    resultError = nil
                    isScanning = true
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
                onRetry: retryLastScan
            )
            .presentationDetents([.medium, .large])
            .presentationDragIndicator(.visible)
            .presentationBackgroundInteraction(.enabled(upThrough: .medium))
        }
        .sheet(isPresented: $showManualEntry) {
            ScanManualEntrySheet { code in
                showManualEntry = false
                handleScan(code)
            }
            .presentationDetents([.medium])
            .presentationDragIndicator(.visible)
        }
    }

    private var bottomOverlay: some View {
        HStack(spacing: 12) {
            // Torch toggle — disabled when device has no torch (front camera, sim).
            Button {
                let next = !torchOn
                torchOn = next
                setTorch(next)
                Haptics.tap()
            } label: {
                Image(systemName: torchOn ? "bolt.fill" : "bolt.slash")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(torchOn ? .yellow : .white)
                    .frame(width: 44, height: 44)
                    .background(.ultraThinMaterial, in: Circle())
            }
            .accessibilityLabel(torchOn ? "Turn flashlight off" : "Turn flashlight on")
            .disabled(!hasTorch)
            .opacity(hasTorch ? 1 : 0.4)

            Spacer()

            if isSearching {
                HStack(spacing: 8) {
                    ProgressView().tint(.white)
                    Text("Looking up…")
                        .font(.subheadline)
                        .foregroundStyle(.white)
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(.ultraThinMaterial, in: Capsule())
                .transition(.opacity)
            }

            Spacer()

            Button {
                showManualEntry = true
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: "keyboard")
                    Text("Type code")
                }
                .font(.subheadline.weight(.medium))
                .foregroundStyle(.white)
                .padding(.horizontal, 14)
                .frame(height: 44)
                .background(.ultraThinMaterial, in: Capsule())
            }
            .accessibilityLabel("Type code instead")
        }
        .padding(.horizontal, 16)
        .padding(.bottom, 32)
    }

    private var hasTorch: Bool {
        AVCaptureDevice.default(for: .video)?.hasTorch ?? false
    }

    private func setTorch(_ on: Bool) {
        guard let device = AVCaptureDevice.default(for: .video), device.hasTorch else { return }
        do {
            try device.lockForConfiguration()
            device.torchMode = on ? .on : .off
            device.unlockForConfiguration()
        } catch {
            // Best-effort: torch lock failure is non-fatal (another app may hold it).
        }
    }

    private func handleScan(_ value: String) {
        let code = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !code.isEmpty else { return }
        let now = Date()
        if code == lastHandledCode, now.timeIntervalSince(lastHandledAt) < 3 {
            return
        }
        lastHandledCode = code
        lastHandledAt = now

        isScanning = false
        isSearching = true
        resultError = nil
        results = nil

        Task {
            defer { isSearching = false }
            do {
                let outcome = try await SearchService.shared.search(query: code, rawScan: code)
                if let single = singleAssetMatch(in: outcome) {
                    // Fast path: one unambiguous asset → jump straight to detail.
                    Haptics.success()
                    navigationPath.append(single)
                    // Re-arm the scanner for the next item.
                    isScanning = true
                    return
                }
                results = outcome
                if outcome.isEmpty {
                    Haptics.warning()
                } else {
                    Haptics.success()
                }
                // Keep VisionKit stopped while the result sheet presents. Running
                // the scanner behind system material can trigger repeated
                // Liquid Glass frame updates on iOS 26.
            } catch {
                let message = (error as? APIError)?.errorDescription
                    ?? "Couldn't reach the server. Try again in a moment."
                resultError = message
                Haptics.error()
            }
        }
    }

    private func retryLastScan() {
        guard let code = lastHandledCode else { return }
        lastHandledCode = nil
        lastHandledAt = .distantPast
        handleScan(code)
    }

    /// Returns the asset if the result set is a single asset and nothing else —
    /// the canonical "scanned a sticker, got one item" case.
    private func singleAssetMatch(in results: SearchResults) -> Asset? {
        guard results.items.count == 1,
              results.reservations.isEmpty,
              results.checkouts.isEmpty,
              results.users.isEmpty
        else { return nil }
        return results.items.first
    }
}

// MARK: - VoiceOver fallback

/// Manual code-entry view shown to VoiceOver users in place of the camera
/// scanner. Camera-based barcode scanning is not accessible to blind users —
/// HIG recommends an equivalent text-input path.
private struct ScanManualEntryView: View {
    let onScan: (String) -> Void
    @State private var code = ""
    @FocusState private var focused: Bool

    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "keyboard")
                .font(.system(size: 44))
                .foregroundStyle(.secondary)
                .accessibilityHidden(true)

            Text("Enter code manually")
                .font(.title3.weight(.semibold))

            Text("VoiceOver is on, so we've swapped the camera for keyboard entry. Type the asset tag, sticker code, or booking ref number and tap Look up.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 24)

            TextField("Code", text: $code)
                .textFieldStyle(.roundedBorder)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .submitLabel(.search)
                .focused($focused)
                .onSubmit(submit)
                .padding(.horizontal, 32)

            Button("Look up") { submit() }
                .buttonStyle(.glassProminent)
                .controlSize(.large)
                .disabled(code.trimmingCharacters(in: .whitespaces).isEmpty)

            Spacer()
        }
        .padding(.top, 36)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(.systemBackground))
        .onAppear { focused = true }
    }

    private func submit() {
        let trimmed = code.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        onScan(trimmed)
        code = ""
    }
}

// MARK: - Sighted manual-entry sheet

/// Sheet variant of manual entry for sighted users — shown when they tap
/// "Type code" in the bottom overlay or "Type code instead" inside an
/// empty / error result sheet.
struct ScanManualEntrySheet: View {
    let onSubmit: (String) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var code = ""
    @FocusState private var focused: Bool

    var body: some View {
        NavigationStack {
            VStack(spacing: 16) {
                TextField("Asset tag, sticker code, or ref number", text: $code)
                    .textFieldStyle(.roundedBorder)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .submitLabel(.search)
                    .focused($focused)
                    .onSubmit(submit)

                Button("Look up") { submit() }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.large)
                    .frame(maxWidth: .infinity)
                    .disabled(code.trimmingCharacters(in: .whitespaces).isEmpty)

                Spacer()
            }
            .padding()
            .navigationTitle("Type code")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
        .onAppear {
            // Tiny delay so the focus survives the sheet animation.
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) { focused = true }
        }
    }

    private func submit() {
        let trimmed = code.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        onSubmit(trimmed)
    }
}

// MARK: - Scanner wrapper

private struct DataScannerRepresentable: UIViewControllerRepresentable {
    @Binding var isScanning: Bool
    let onScan: (String) -> Void

    func makeUIViewController(context: Context) -> DataScannerViewController {
        let vc = DataScannerViewController(
            recognizedDataTypes: [.barcode()],
            qualityLevel: .accurate,
            recognizesMultipleItems: false,
            isPinchToZoomEnabled: true,
            isGuidanceEnabled: true,
            isHighlightingEnabled: true
        )
        vc.delegate = context.coordinator
        return vc
    }

    func updateUIViewController(_ vc: DataScannerViewController, context: Context) {
        context.coordinator.onScan = onScan
        if isScanning && !vc.isScanning {
            context.coordinator.lastScanned = nil
            try? vc.startScanning()
        } else if !isScanning && vc.isScanning {
            vc.stopScanning()
        }
    }

    func makeCoordinator() -> Coordinator { Coordinator(onScan: onScan) }

    final class Coordinator: NSObject, DataScannerViewControllerDelegate {
        var onScan: (String) -> Void
        var lastScanned: String?

        init(onScan: @escaping (String) -> Void) { self.onScan = onScan }

        func dataScanner(_ dataScanner: DataScannerViewController, didAdd addedItems: [RecognizedItem], allItems: [RecognizedItem]) {
            guard let item = addedItems.first, case .barcode(let barcode) = item,
                  let value = barcode.payloadStringValue, value != lastScanned else { return }
            lastScanned = value
            DispatchQueue.main.async { self.onScan(value) }
        }
    }
}

// MARK: - Results sheet

/// Native sheet presentation for scan results. Replaces the prior hand-rolled
/// floating overlay — the sheet handles its own grabber, drag-to-resize,
/// swipe-to-dismiss, and Liquid Glass material via the system.
/// Background interaction is enabled up through .medium so the camera feed
/// stays live and the next scan can happen without dismissing manually.
private struct ScanResultSheet: View {
    let results: SearchResults
    let error: String?
    @Binding var navigationPath: NavigationPath
    var onTypeCode: () -> Void
    var onRetry: () -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        Group {
            if let error {
                errorState(message: error)
            } else if results.isEmpty {
                emptyState
            } else {
                ScrollView { resultRows }
            }
        }
        .presentationCornerRadius(24)
    }

    private var emptyState: some View {
        ContentUnavailableView {
            Label("Nothing found", systemImage: "qrcode.viewfinder")
        } description: {
            Text("This code isn't linked to any item yet.")
        } actions: {
            Button {
                onTypeCode()
            } label: {
                Label("Type code instead", systemImage: "keyboard")
            }
            .buttonStyle(.bordered)
        }
    }

    private func errorState(message: String) -> some View {
        ContentUnavailableView {
            Label("Couldn't look that up", systemImage: "wifi.exclamationmark")
        } description: {
            Text(message)
        } actions: {
            Button {
                onRetry()
            } label: {
                Label("Try again", systemImage: "arrow.clockwise")
            }
            .buttonStyle(.borderedProminent)

            Button {
                onTypeCode()
            } label: {
                Label("Type code instead", systemImage: "keyboard")
            }
            .buttonStyle(.bordered)
        }
    }

    private var resultRows: some View {
        VStack(alignment: .leading, spacing: 0) {
            ForEach(Array(results.items.enumerated()), id: \.element.id) { index, asset in
                Button {
                    navigationPath.append(asset)
                    dismiss()
                } label: {
                    HStack {
                        AssetResultRow(asset: asset)
                        Image(systemName: "chevron.right")
                            .font(.caption)
                            .foregroundStyle(.tertiary)
                            .padding(.trailing, 4)
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 6)
                }
                .buttonStyle(.plain)
                if index < results.items.count - 1 || !results.reservations.isEmpty || !results.checkouts.isEmpty || !results.users.isEmpty {
                    Divider().padding(.leading, 72)
                }
            }

            let bookings = results.reservations + results.checkouts
            ForEach(Array(bookings.enumerated()), id: \.element.id) { index, booking in
                Button {
                    navigationPath.append(booking)
                    dismiss()
                } label: {
                    BookingResultRow(booking: booking)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 6)
                }
                .buttonStyle(.plain)
                if index < bookings.count - 1 || !results.users.isEmpty {
                    Divider().padding(.leading, 68)
                }
            }

            ForEach(Array(results.users.enumerated()), id: \.element.id) { index, user in
                UserResultRow(user: user)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 6)
                if index < results.users.count - 1 {
                    Divider().padding(.leading, 68)
                }
            }
        }
        .padding(.top, 8)
    }
}
