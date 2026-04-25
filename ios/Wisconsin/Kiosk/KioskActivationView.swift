import SwiftUI

struct KioskActivationView: View {
    @Environment(KioskStore.self) private var store
    @State private var code = ""
    @State private var error: String?
    @State private var isLoading = false

    var body: some View {
        VStack(spacing: 40) {
            Spacer()

            VStack(spacing: 12) {
                Image(systemName: "barcode.viewfinder")
                    .font(.system(size: 64))
                    .foregroundStyle(Color.kioskRed)
                Text("Gear Room Kiosk")
                    .font(.system(size: 36, weight: .bold))
                    .foregroundStyle(.white)
                Text("This iPad isn't activated yet")
                    .font(.title3)
                    .foregroundStyle(.white.opacity(0.85))
                Text("Ask gear room staff to set up this device.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                Text("Staff: enter the 6-digit code from Settings → Kiosk Devices")
                    .font(.caption)
                    .foregroundStyle(.secondary.opacity(0.6))
                    .padding(.top, 4)
            }

            // Code display
            HStack(spacing: 12) {
                ForEach(0..<6, id: \.self) { i in
                    RoundedRectangle(cornerRadius: 10)
                        .stroke(i < code.count ? Color.kioskRed : Color.white.opacity(0.2), lineWidth: 2)
                        .frame(width: 52, height: 68)
                        .overlay {
                            if i < code.count {
                                Text(String(Array(code)[i]))
                                    .font(.title.monospaced())
                                    .foregroundStyle(.white)
                            }
                        }
                }
            }

            if let error {
                Text(error)
                    .foregroundStyle(.red)
                    .font(.callout)
            }

            // Numpad
            KioskNumPad(code: $code, onComplete: activate)
                .frame(maxWidth: 320)
                .disabled(isLoading)

            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .overlay {
            if isLoading {
                ProgressView()
                    .scaleEffect(1.5)
                    .tint(.white)
            }
        }
    }

    private func activate() {
        guard code.count == 6, !isLoading else { return }
        isLoading = true
        error = nil
        Task {
            do {
                let resp = try await KioskAPI.shared.kioskActivate(code: code)
                store.activate(response: resp)
            } catch APIError.serverError(let msg) {
                error = msg
                code = ""
            } catch APIError.unauthorized {
                error = "Invalid activation code."
                code = ""
            } catch {
                self.error = "Activation failed. Check your code and try again."
                code = ""
            }
            isLoading = false
        }
    }
}

// MARK: - Numpad

private struct KioskNumPad: View {
    @Binding var code: String
    let onComplete: () -> Void

    private let layout: [[String]] = [
        ["1", "2", "3"],
        ["4", "5", "6"],
        ["7", "8", "9"],
        ["⌫", "0", "✓"],
    ]

    var body: some View {
        VStack(spacing: 12) {
            ForEach(layout, id: \.self) { row in
                HStack(spacing: 12) {
                    ForEach(row, id: \.self) { key in
                        Button {
                            handleKey(key)
                        } label: {
                            Text(key)
                                .font(.title2.weight(.semibold))
                                .foregroundStyle(.white)
                                .frame(maxWidth: .infinity)
                                .frame(height: 64)
                                .background(keyBackground(key), in: RoundedRectangle(cornerRadius: 12))
                        }
                    }
                }
            }
        }
    }

    private func handleKey(_ key: String) {
        switch key {
        case "⌫":
            if !code.isEmpty { code.removeLast() }
        case "✓":
            if code.count == 6 { onComplete() }
        default:
            if code.count < 6 { code.append(key) }
            if code.count == 6 { onComplete() }
        }
    }

    private func keyBackground(_ key: String) -> Color {
        switch key {
        case "✓": return Color.kioskRed
        case "⌫": return Color.white.opacity(0.1)
        default: return Color.white.opacity(0.08)
        }
    }
}
