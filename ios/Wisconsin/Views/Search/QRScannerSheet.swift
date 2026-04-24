import SwiftUI
import VisionKit
import AVFoundation

struct QRScannerSheet: View {
    let onMatch: (String) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var cameraAuthorized: Bool? = nil
    @State private var scanError: String?
    @State private var isLookingUp = false
    @State private var showManualEntry = false
    @State private var manualCode = ""
    @State private var lastScanTime: Date = .distantPast
    @State private var torchOn = false

    var body: some View {
        ZStack(alignment: .top) {
            Color.black.ignoresSafeArea()

            if let authorized = cameraAuthorized {
                if authorized && DataScannerViewController.isSupported && DataScannerViewController.isAvailable {
                    scannerView
                } else if !authorized {
                    permissionDeniedView
                } else {
                    unavailableView
                }
            }

            overlayControls
        }
        .task { await checkCameraPermission() }
        .alert("Enter Code Manually", isPresented: $showManualEntry) {
            TextField("Asset tag or QR code", text: $manualCode)
                .autocorrectionDisabled()
                .textInputAutocapitalization(.never)
            Button("Look Up") { Task { await lookUp(rawScan: manualCode) } }
            Button("Cancel", role: .cancel) {}
        }
    }

    // MARK: - Scanner

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

    private var overlayControls: some View {
        VStack {
            HStack {
                Button { dismiss() } label: {
                    Image(systemName: "xmark")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(.white)
                        .frame(width: 36, height: 36)
                        .background(.ultraThinMaterial, in: Circle())
                }
                Spacer()
                if cameraAuthorized == true {
                    Button {
                        torchOn.toggle()
                    } label: {
                        Image(systemName: torchOn ? "bolt.fill" : "bolt.slash")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundStyle(torchOn ? .yellow : .white)
                            .frame(width: 36, height: 36)
                            .background(.ultraThinMaterial, in: Circle())
                    }
                }
            }
            .padding(.horizontal, 20)
            .padding(.top, 16)

            Spacer()

            VStack(spacing: 16) {
                if isLookingUp {
                    HStack(spacing: 8) {
                        ProgressView()
                            .tint(.white)
                        Text("Looking up…")
                            .foregroundStyle(.white)
                            .font(.subheadline)
                    }
                    .padding(.horizontal, 20)
                    .padding(.vertical, 10)
                    .background(.ultraThinMaterial, in: Capsule())
                }
                if let error = scanError {
                    Text(error)
                        .font(.subheadline)
                        .foregroundStyle(.white)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 20)
                        .padding(.vertical, 10)
                        .background(.red.opacity(0.7), in: RoundedRectangle(cornerRadius: 12))
                        .padding(.horizontal, 32)
                }
                Button("Type Code Instead") {
                    showManualEntry = true
                }
                .font(.subheadline.weight(.medium))
                .foregroundStyle(.white)
                .padding(.horizontal, 20)
                .padding(.vertical, 10)
                .background(.ultraThinMaterial, in: Capsule())
            }
            .padding(.bottom, 48)
        }
    }

    // MARK: - Permission views

    private var permissionDeniedView: some View {
        VStack(spacing: 16) {
            Image(systemName: "camera.slash.fill")
                .font(.system(size: 48))
                .foregroundStyle(.white.opacity(0.6))
            Text("Camera Access Required")
                .font(.title3.weight(.semibold))
                .foregroundStyle(.white)
            Text("Allow camera access in Settings to scan gear QR codes.")
                .font(.subheadline)
                .foregroundStyle(.white.opacity(0.7))
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)
            Button("Open Settings") {
                if let url = URL(string: UIApplication.openSettingsURLString) {
                    UIApplication.shared.open(url)
                }
            }
            .buttonStyle(.borderedProminent)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var unavailableView: some View {
        VStack(spacing: 16) {
            Image(systemName: "qrcode.viewfinder")
                .font(.system(size: 48))
                .foregroundStyle(.white.opacity(0.6))
            Text("Scanner Unavailable")
                .font(.title3.weight(.semibold))
                .foregroundStyle(.white)
            Button("Type Code Instead") { showManualEntry = true }
                .buttonStyle(.borderedProminent)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - Logic

    private func checkCameraPermission() async {
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized:
            cameraAuthorized = true
        case .notDetermined:
            cameraAuthorized = await AVCaptureDevice.requestAccess(for: .video)
        default:
            cameraAuthorized = false
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
            if let assetId = try await APIClient.shared.assetsLookup(rawScan: rawScan) {
                UINotificationFeedbackGenerator().notificationOccurred(.success)
                onMatch(assetId)
            } else {
                UINotificationFeedbackGenerator().notificationOccurred(.error)
                scanError = "No item matches this code."
                try? await Task.sleep(nanoseconds: 3_000_000_000)
                scanError = nil
            }
        } catch {
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
        init(onScan: @escaping (String) -> Void) { self.onScan = onScan }

        func dataScanner(_ dataScanner: DataScannerViewController, didTapOn item: RecognizedItem) {
            if case .barcode(let barcode) = item, let value = barcode.payloadStringValue {
                onScan(value)
            }
        }

        func dataScanner(_ dataScanner: DataScannerViewController, didAdd addedItems: [RecognizedItem], allItems: [RecognizedItem]) {
            guard let item = addedItems.first, case .barcode(let barcode) = item,
                  let value = barcode.payloadStringValue else { return }
            onScan(value)
        }
    }
}
