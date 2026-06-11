import SwiftUI
import VisionKit
import AVFoundation

enum QRScannerMatch {
    case asset(String)
    case itemFamily(AssetFamilySearchResult)
}

struct QRScannerSheet: View {
    let onMatch: (QRScannerMatch) -> Void

    @Environment(\.dismiss) private var dismiss
    @Environment(\.accessibilityVoiceOverEnabled) private var voiceOverEnabled
    @Environment(\.scenePhase) private var scenePhase
    @State private var cameraAuth: AVAuthorizationStatus = AVCaptureDevice.authorizationStatus(for: .video)
    @State private var scanError: String?
    @State private var isLookingUp = false
    @State private var showManualEntry = false
    @State private var lastScanTime: Date = .distantPast
    @State private var torchOn = false

    var body: some View {
        ZStack {
            scannerContent
        }
        .safeAreaInset(edge: .top, spacing: 0) {
            topControls
        }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            if cameraAuth == .authorized && DataScannerViewController.isSupported && DataScannerViewController.isAvailable && !voiceOverEnabled {
                bottomControls
            }
        }
        .sheet(isPresented: $showManualEntry) {
            ScanManualEntrySheet { code in
                showManualEntry = false
                Task { await lookUp(rawScan: code) }
            }
            .presentationDetents([.medium])
            .presentationDragIndicator(.visible)
        }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active {
                cameraAuth = AVCaptureDevice.authorizationStatus(for: .video)
            } else {
                torchOn = false
                setTorch(false)
            }
        }
        .onDisappear {
            torchOn = false
            setTorch(false)
        }
    }

    // MARK: - Scanner

    @ViewBuilder
    private var scannerContent: some View {
        switch cameraAuth {
        case .notDetermined:
            ScanPrePromptView { granted in
                cameraAuth = granted ? .authorized : .denied
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Color(.systemBackground))
        case .denied, .restricted:
            ScanDeniedView()
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(Color(.systemBackground))
        case .authorized:
            if voiceOverEnabled {
                voiceOverManualFallback
            } else if DataScannerViewController.isSupported && DataScannerViewController.isAvailable {
                ZStack(alignment: .bottom) {
                    Color.black.ignoresSafeArea()
                    scannerView
                    if let scanError {
                        errorBanner(scanError)
                            .padding(.horizontal, 24)
                            .padding(.bottom, 108)
                    }
                }
            } else {
                unavailableView
                    .background(Color.black.ignoresSafeArea())
            }
        @unknown default:
            unavailableView
                .background(Color.black.ignoresSafeArea())
        }
    }

    private var scannerView: some View {
        DataScannerRepresentable(
            torchOn: torchOn,
            onScan: { value in
                Task { await handleScan(rawScan: value) }
            }
        )
        .ignoresSafeArea()
    }

    // MARK: - Overlay

    private var topControls: some View {
        HStack {
            Button { dismiss() } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(cameraAuth == .authorized ? .white : .primary)
                    .frame(width: 44, height: 44)
                    .background(.ultraThinMaterial, in: Circle())
            }
            .accessibilityLabel("Close scanner")
            Spacer()
            if cameraAuth == .authorized && !voiceOverEnabled && DataScannerViewController.isSupported && DataScannerViewController.isAvailable {
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
            }
        }
        .padding(.horizontal, 16)
        .padding(.top, 8)
    }

    private var bottomControls: some View {
        VStack {
            VStack(spacing: 16) {
                if isLookingUp {
                    HStack(spacing: 8) {
                        ProgressView()
                        Text("Looking up…")
                            .foregroundStyle(.white)
                            .font(.subheadline)
                    }
                    .padding(.horizontal, 20)
                    .padding(.vertical, 10)
                    .background(.ultraThinMaterial, in: Capsule())
                }

                Button {
                    showManualEntry = true
                } label: {
                    Label("Type code", systemImage: "keyboard")
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 18)
                        .frame(height: 44)
                        .background(.ultraThinMaterial, in: Capsule())
                }
                .accessibilityLabel("Type code instead")
            }
            .padding(.bottom, 32)
        }
    }

    private func errorBanner(_ message: String) -> some View {
        VStack(spacing: 10) {
            Text(message)
                .font(.subheadline)
                .foregroundStyle(.white)
                .multilineTextAlignment(.center)

            HStack(spacing: 12) {
                Button {
                    showManualEntry = true
                } label: {
                    Label("Type code", systemImage: "keyboard")
                }
                .buttonStyle(.bordered)
                .tint(.white)

                Button("Dismiss") {
                    scanError = nil
                }
                .buttonStyle(.bordered)
                .tint(.white)
            }
            .controlSize(.small)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(Color.statusText(.red).opacity(0.88), in: RoundedRectangle(cornerRadius: 14))
        .accessibilityElement(children: .combine)
    }

    private var voiceOverManualFallback: some View {
        VStack(spacing: 18) {
            Image(systemName: "keyboard")
                .font(.system(size: 44))
                .foregroundStyle(.secondary)
                .accessibilityHidden(true)

            Text("Type code instead")
                .font(.title3.weight(.semibold))

            Text("VoiceOver is on, so use keyboard entry instead of the camera scanner.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)

            Button {
                showManualEntry = true
            } label: {
                Label("Type code", systemImage: "keyboard")
            }
            .buttonStyle(.glassProminent)
            .controlSize(.large)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(.systemBackground))
    }

    // MARK: - Permission views

    private var unavailableView: some View {
        VStack(spacing: 16) {
            Image(systemName: "qrcode.viewfinder")
                .font(.system(size: 48))
                .foregroundStyle(.white.opacity(0.6))
            Text("Scanner Unavailable")
                .font(.title3.weight(.semibold))
                .foregroundStyle(.white)
            Button("Type Code Instead") { showManualEntry = true }
                .buttonStyle(.glassProminent)
                .controlSize(.large)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - Logic

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
            // Torch is best-effort. A lock failure should not block lookup.
        }
    }

    private func handleScan(rawScan: String) async {
        let now = Date()
        guard now.timeIntervalSince(lastScanTime) > 2.0 else { return }
        lastScanTime = now
        await lookUp(rawScan: rawScan)
    }

    private func lookUp(rawScan: String) async {
        guard !rawScan.trimmingCharacters(in: .whitespaces).isEmpty else { return }
        scanError = nil
        isLookingUp = true
        defer { isLookingUp = false }
        do {
            let response = try await APIClient.shared.scannedAssets(rawScan: rawScan)
            if let assetId = response.data.first?.id {
                Haptics.success()
                onMatch(.asset(assetId))
            } else if let family = response.bulkItems.first {
                Haptics.success()
                onMatch(.itemFamily(family))
            } else {
                Haptics.warning()
                scanError = "No item matches this code."
            }
        } catch {
            Haptics.error()
            scanError = error.localizedDescription
        }
    }
}

// MARK: - DataScannerViewController wrapper

private struct DataScannerRepresentable: UIViewControllerRepresentable {
    let torchOn: Bool
    let onScan: (String) -> Void

    func makeUIViewController(context: Context) -> DataScannerViewController {
        let vc = DataScannerViewController(
            recognizedDataTypes: [.barcode()],
            qualityLevel: .balanced,
            recognizesMultipleItems: false,
            isHighFrameRateTrackingEnabled: false,
            isGuidanceEnabled: true,
            isHighlightingEnabled: true
        )
        vc.delegate = context.coordinator
        try? vc.startScanning()
        return vc
    }

    func updateUIViewController(_ vc: DataScannerViewController, context: Context) {
        // Toggle torch via AVCaptureDevice
        if let device = AVCaptureDevice.default(for: .video), device.hasTorch {
            try? device.lockForConfiguration()
            device.torchMode = torchOn ? .on : .off
            device.unlockForConfiguration()
        }
    }

    func makeCoordinator() -> Coordinator { Coordinator(onScan: onScan) }

    final class Coordinator: NSObject, DataScannerViewControllerDelegate {
        let onScan: (String) -> Void
        private var lastScanned: String?
        private var lastScannedAt: Date = .distantPast

        init(onScan: @escaping (String) -> Void) { self.onScan = onScan }

        func dataScanner(_ dataScanner: DataScannerViewController, didTapOn item: RecognizedItem) {
            if case .barcode(let barcode) = item, let value = barcode.payloadStringValue {
                handle(value)
            }
        }

        func dataScanner(_ dataScanner: DataScannerViewController, didAdd addedItems: [RecognizedItem], allItems: [RecognizedItem]) {
            guard let item = addedItems.first, case .barcode(let barcode) = item,
                  let value = barcode.payloadStringValue else { return }
            handle(value)
        }

        private func handle(_ value: String) {
            let now = Date()
            guard value != lastScanned || now.timeIntervalSince(lastScannedAt) > 2 else { return }
            lastScanned = value
            lastScannedAt = now
            onScan(value)
        }
    }
}
