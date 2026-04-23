import SwiftUI

// Placeholder — AVFoundation scanner wired in next sprint
struct ScanView: View {
    var body: some View {
        NavigationStack {
            VStack(spacing: 16) {
                Image(systemName: "qrcode.viewfinder")
                    .font(.system(size: 72))
                    .foregroundStyle(.secondary)
                Text("Scanner Coming Soon")
                    .font(.headline)
                Text("Native QR scanner for quick\ncheckout and return.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .navigationTitle("Scan")
        }
    }
}
