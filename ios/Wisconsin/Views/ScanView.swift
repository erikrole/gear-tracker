import SwiftUI
import VisionKit
import AVFoundation

struct ScanView: View {
    @State private var isScanning = true
    @State private var isSearching = false
    @State private var results: SearchResults?
    @State private var navigationPath = NavigationPath()
    @State private var cameraAuth: AVAuthorizationStatus = AVCaptureDevice.authorizationStatus(for: .video)
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

            if isSearching {
                ProgressView()
                    .padding(16)
                    .background(.ultraThinMaterial, in: Circle())
                    .padding(.bottom, 48)
            }

            if let results {
                ScanResultCard(results: results, navigationPath: $navigationPath) {
                    self.results = nil
                    isScanning = true
                }
                .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
    }

    private func handleScan(_ value: String) {
        isScanning = false
        isSearching = true
        Task {
            defer { isSearching = false }
            results = (try? await SearchService.shared.search(query: value, rawScan: value)) ?? SearchResults()
        }
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

// MARK: - Results card

private struct ScanResultCard: View {
    let results: SearchResults
    @Binding var navigationPath: NavigationPath
    let onScanAgain: () -> Void

    private var totalCount: Int {
        results.items.count + results.reservations.count + results.checkouts.count + results.users.count
    }

    var body: some View {
        VStack(spacing: 0) {
            Capsule()
                .fill(.tertiary)
                .frame(width: 36, height: 5)
                .padding(.top, 8)
                .padding(.bottom, 4)

            if results.isEmpty {
                emptyState
            } else if totalCount > 3 {
                ScrollView {
                    resultRows
                }
                .frame(maxHeight: 300)
            } else {
                resultRows
            }

            Divider()

            Button("Scan Again", action: onScanAgain)
                .buttonStyle(.glassProminent)
                .controlSize(.large)
                .frame(maxWidth: .infinity)
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
        }
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 20))
        .padding(.horizontal, 12)
        .padding(.bottom, 8)
    }

    private var emptyState: some View {
        VStack(spacing: 6) {
            Image(systemName: "qrcode.viewfinder")
                .font(.title2)
                .foregroundStyle(.secondary)
            Text("Nothing found")
                .font(.subheadline.weight(.medium))
            Text("This code isn't linked to any item yet")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(.vertical, 20)
        .padding(.horizontal)
        .frame(maxWidth: .infinity)
    }

    private var resultRows: some View {
        VStack(alignment: .leading, spacing: 0) {
            ForEach(Array(results.items.enumerated()), id: \.element.id) { index, asset in
                Button {
                    navigationPath.append(asset)
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
    }
}
