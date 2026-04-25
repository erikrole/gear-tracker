import SwiftUI
import VisionKit
import AVFoundation

/// Sheet-presented camera fallback for kiosk flows when a HID hand scanner
/// is unavailable (unplugged, dead battery, or staff is using the iPad on
/// the floor at an event). Reuses Apple's DataScannerViewController; falls
/// back to a clear permission-needed message when the camera is denied.
struct KioskBarcodeCameraView: View {
    let onScan: (String) -> Void
    let onCancel: () -> Void

    @State private var permissionState: PermissionState = .checking

    enum PermissionState {
        case checking
        case authorized
        case denied
        case unsupported
    }

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            switch permissionState {
            case .checking:
                ProgressView().tint(.white).scaleEffect(1.4)
            case .authorized:
                if DataScannerViewController.isSupported && DataScannerViewController.isAvailable {
                    KioskDataScannerRepresentable(onScan: { value in
                        UINotificationFeedbackGenerator().notificationOccurred(.success)
                        onScan(value)
                    })
                    .ignoresSafeArea()
                    .overlay(alignment: .top) { header }
                } else {
                    unsupportedView
                }
            case .denied:
                deniedView
            case .unsupported:
                unsupportedView
            }
        }
        .task { await checkPermission() }
    }

    private var header: some View {
        HStack {
            Button {
                onCancel()
            } label: {
                Label("Done", systemImage: "xmark")
                    .font(.headline)
                    .foregroundStyle(.white)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 10)
                    .background(.black.opacity(0.5), in: Capsule())
            }
            Spacer()
            Text("Aim camera at barcode or QR")
                .font(.subheadline.weight(.medium))
                .foregroundStyle(.white)
                .padding(.horizontal, 14)
                .padding(.vertical, 8)
                .background(.black.opacity(0.5), in: Capsule())
            Spacer()
            Spacer().frame(width: 80)
        }
        .padding()
    }

    private var deniedView: some View {
        VStack(spacing: 16) {
            Image(systemName: "camera.fill")
                .font(.system(size: 56))
                .foregroundStyle(.secondary)
            Text("Camera access required")
                .font(.title3.bold())
                .foregroundStyle(.white)
            Text("Enable camera access in Settings to scan with the iPad camera.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)
            Button("Close") { onCancel() }
                .foregroundStyle(.white)
                .padding(.horizontal, 28)
                .padding(.vertical, 12)
                .background(Color.kioskRed, in: Capsule())
        }
    }

    private var unsupportedView: some View {
        VStack(spacing: 16) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 56))
                .foregroundStyle(.orange)
            Text("Camera scanning unavailable")
                .font(.title3.bold())
                .foregroundStyle(.white)
            Text("Use the hand scanner to continue.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
            Button("Close") { onCancel() }
                .foregroundStyle(.white)
                .padding(.horizontal, 28)
                .padding(.vertical, 12)
                .background(Color.kioskRed, in: Capsule())
        }
    }

    private func checkPermission() async {
        guard DataScannerViewController.isSupported else {
            permissionState = .unsupported
            return
        }
        let status = AVCaptureDevice.authorizationStatus(for: .video)
        switch status {
        case .authorized:
            permissionState = .authorized
        case .notDetermined:
            let granted = await AVCaptureDevice.requestAccess(for: .video)
            permissionState = granted ? .authorized : .denied
        case .denied, .restricted:
            permissionState = .denied
        @unknown default:
            permissionState = .denied
        }
    }
}

private struct KioskDataScannerRepresentable: UIViewControllerRepresentable {
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

    func updateUIViewController(_ vc: DataScannerViewController, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator(onScan: onScan) }

    final class Coordinator: NSObject, DataScannerViewControllerDelegate {
        let onScan: (String) -> Void
        private var lastScan: String?
        private var lastScanAt: Date = .distantPast

        init(onScan: @escaping (String) -> Void) { self.onScan = onScan }

        func dataScanner(_ scanner: DataScannerViewController, didTapOn item: RecognizedItem) {
            if case .barcode(let barcode) = item, let value = barcode.payloadStringValue {
                emit(value)
            }
        }

        func dataScanner(_ scanner: DataScannerViewController, didAdd addedItems: [RecognizedItem], allItems: [RecognizedItem]) {
            guard let item = addedItems.first, case .barcode(let barcode) = item,
                  let value = barcode.payloadStringValue else { return }
            emit(value)
        }

        // Simple debounce — same value within 1.5s is dropped.
        private func emit(_ value: String) {
            let now = Date()
            if value == lastScan, now.timeIntervalSince(lastScanAt) < 1.5 { return }
            lastScan = value
            lastScanAt = now
            onScan(value)
        }
    }
}
