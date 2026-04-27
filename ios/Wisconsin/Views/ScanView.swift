import SwiftUI
import VisionKit

struct ScanView: View {
    @State private var isScanning = true
    @State private var isSearching = false
    @State private var results: SearchResults?
    @State private var navigationPath = NavigationPath()

    var body: some View {
        NavigationStack(path: $navigationPath) {
            ZStack(alignment: .bottom) {
                if DataScannerViewController.isSupported {
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
                        .tint(.white)
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
            .navigationTitle("Scan")
            .navigationBarTitleDisplayMode(.inline)
            .animation(.spring(duration: 0.3), value: results != nil)
            .navigationDestination(for: Asset.self) { asset in
                ItemDetailView(assetId: asset.id)
            }
            .navigationDestination(for: Booking.self) { booking in
                BookingDetailView(bookingId: booking.id)
            }
        }
    }

    private func handleScan(_ value: String) {
        isScanning = false
        isSearching = true
        Task {
            defer { isSearching = false }
            results = (try? await SearchService.shared.search(query: value)) ?? SearchResults()
        }
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

    var body: some View {
        VStack(spacing: 0) {
            Capsule()
                .fill(.tertiary)
                .frame(width: 36, height: 5)
                .padding(.top, 8)
                .padding(.bottom, 4)

            if results.isEmpty {
                Text("No results found")
                    .foregroundStyle(.secondary)
                    .padding(.vertical, 24)
            } else {
                ScrollView {
                    VStack(alignment: .leading, spacing: 0) {
                        ForEach(results.items) { asset in
                            Button {
                                navigationPath.append(asset)
                            } label: {
                                ResultRow(icon: "archivebox", title: asset.displayName,
                                          subtitle: asset.assetTag ?? asset.serialNumber ?? "—",
                                          badge: asset.computedStatus.rawValue, showChevron: true)
                            }
                            .buttonStyle(.plain)
                            Divider().padding(.leading, 52)
                        }
                        ForEach(results.reservations + results.checkouts) { booking in
                            Button {
                                navigationPath.append(booking)
                            } label: {
                                ResultRow(icon: "calendar", title: booking.title,
                                          subtitle: booking.status.rawValue,
                                          badge: nil, showChevron: true)
                            }
                            .buttonStyle(.plain)
                            Divider().padding(.leading, 52)
                        }
                        ForEach(results.users) { user in
                            ResultRow(icon: "person.circle", title: user.name,
                                      subtitle: user.email, badge: user.role, showChevron: false)
                            Divider().padding(.leading, 52)
                        }
                    }
                }
                .frame(maxHeight: 280)
            }

            Button("Scan Again", action: onScanAgain)
                .buttonStyle(.borderedProminent)
                .padding(.horizontal)
                .padding(.vertical, 12)
        }
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 20))
        .padding(.horizontal, 12)
        .padding(.bottom, 8)
    }
}

private struct ResultRow: View {
    let icon: String
    let title: String
    let subtitle: String
    let badge: String?
    let showChevron: Bool

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .frame(width: 28)
                .foregroundStyle(.tint)
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.subheadline.weight(.medium))
                Text(subtitle).font(.caption).foregroundStyle(.secondary)
            }
            Spacer()
            if let badge {
                Text(badge)
                    .font(.caption2.weight(.semibold))
                    .padding(.horizontal, 6)
                    .padding(.vertical, 3)
                    .background(.tint.opacity(0.12), in: Capsule())
                    .foregroundStyle(.tint)
            }
            if showChevron {
                Image(systemName: "chevron.right")
                    .font(.caption)
                    .foregroundStyle(.tertiary)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .contentShape(Rectangle())
    }
}
