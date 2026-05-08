import SwiftUI
import UIKit

struct KioskActivationView: View {
    @Environment(KioskStore.self) private var store
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
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
                    .accessibilityHidden(true)
                Text("Gear Room Kiosk")
                    .font(.system(size: 36, weight: .bold))
                    .foregroundStyle(.white)
                Text("This iPad isn't activated yet")
                    .font(.title3)
                    .foregroundStyle(.white.opacity(0.85))
                Text("Ask gear room staff to set up this device.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                Text("Staff: enter the 6-digit code from gear.erikrole.com → Settings → Kiosk Devices.")
                    .font(.caption)
                    .foregroundStyle(.secondary.opacity(0.6))
                    .multilineTextAlignment(.center)
                    .padding(.top, 4)
                    .padding(.horizontal, 24)
            }

            // Code display + paste affordance
            VStack(spacing: 14) {
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
                                        .transition(.opacity)
                                }
                            }
                    }
                }
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(code.isEmpty
                    ? "Activation code, 6 digits required"
                    : "Activation code, \(code.count) of 6 digits entered"
                )
                .animation(reduceMotion ? nil : .easeInOut(duration: 0.15), value: code)

                // Privacy-safe system paste control. The button auto-hides when
                // the clipboard doesn't contain a String, so it stays out of the
                // way unless the staffer just copied a code on a sister device.
                PasteButton(payloadType: String.self) { strings in
                    Task { @MainActor in handlePaste(strings) }
                }
                .buttonBorderShape(.capsule)
                .labelStyle(.titleAndIcon)
                .tint(.white.opacity(0.85))
                .disabled(isLoading)
                .accessibilityLabel("Paste activation code from clipboard")
            }

            if let error {
                Text(error)
                    .foregroundStyle(Color.statusText(.red))
                    .font(.callout)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 32)
                    .accessibilityAddTraits(.updatesFrequently)
            }

            // Numpad
            KioskNumPad(code: $code, onComplete: activate)
                .frame(maxWidth: 320)
                .disabled(isLoading)

            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .overlay(alignment: .center) {
            Group {
                if isLoading {
                    loadingScrim
                        .transition(.opacity)
                }
            }
        }
        .animation(reduceMotion ? nil : .easeInOut(duration: 0.2), value: isLoading)
    }

    private var loadingScrim: some View {
        ZStack {
            Color.black.opacity(0.5).ignoresSafeArea()
            VStack(spacing: 14) {
                ProgressView()
                    .scaleEffect(1.4)
                    .tint(.white)
                Text("Activating…")
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(.white)
            }
            .padding(.horizontal, 32)
            .padding(.vertical, 24)
            .background(Color(red: 22/255, green: 22/255, blue: 26/255), in: RoundedRectangle(cornerRadius: 16))
            .shadow(radius: 24)
            .accessibilityElement(children: .combine)
            .accessibilityLabel("Activating kiosk")
        }
    }

    /// Extract the longest run of digits from any pasted strings, truncate to
    /// 6, and either fill the field or auto-submit (when exactly 6 digits land).
    /// Tolerates pastes like "Code: 123456" or "123-456" — extracts 123456.
    private func handlePaste(_ strings: [String]) {
        guard let raw = strings.first else { return }
        let digits = raw.unicodeScalars.compactMap { $0.value >= 48 && $0.value <= 57 ? Character(String($0)) : nil }
        let trimmed = String(digits.prefix(6))
        guard !trimmed.isEmpty else { return }
        code = trimmed
        Haptics.tap()
        if trimmed.count == 6 {
            activate()
        }
    }

    private func activate() {
        guard code.count == 6, !isLoading else { return }
        isLoading = true
        error = nil
        Task {
            do {
                let resp = try await KioskAPI.shared.kioskActivate(code: code)
                Haptics.success()
                store.activate(response: resp)
            } catch APIError.serverError(let msg) {
                surfaceError(msg)
            } catch APIError.unauthorized {
                surfaceError("Invalid activation code.")
            } catch {
                surfaceError("Activation failed. Check your code and try again.")
            }
            isLoading = false
        }
    }

    /// Sets the error state, clears the code, and posts a VoiceOver
    /// announcement so blind users hear the failure without manual focus
    /// navigation. SwiftUI has no `accessibilityLiveRegion` equivalent;
    /// `UIAccessibility.post(.announcement, ...)` is the canonical path.
    private func surfaceError(_ message: String) {
        error = message
        code = ""
        Haptics.error()
        UIAccessibility.post(notification: .announcement, argument: message)
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
                        KioskNumPadButton(
                            key: key,
                            isEnabled: isEnabled(for: key),
                            action: { handleKey(key) }
                        )
                    }
                }
            }
        }
    }

    private func isEnabled(for key: String) -> Bool {
        switch key {
        case "✓": return code.count == 6
        case "⌫": return !code.isEmpty
        default:  return code.count < 6
        }
    }

    private func handleKey(_ key: String) {
        switch key {
        case "⌫":
            if !code.isEmpty {
                code.removeLast()
                Haptics.tap()
            }
        case "✓":
            if code.count == 6 {
                onComplete()
            }
        default:
            if code.count < 6 {
                code.append(key)
                Haptics.tap()
            }
            if code.count == 6 {
                onComplete()
            }
        }
    }
}

private struct KioskNumPadButton: View {
    let key: String
    let isEnabled: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(key)
                .font(.title2.weight(.semibold))
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity)
                .frame(height: 64)
                .background(background, in: RoundedRectangle(cornerRadius: 12))
        }
        .disabled(!isEnabled)
        .opacity(isEnabled ? 1.0 : 0.35)
        .accessibilityLabel(accessibilityLabel)
    }

    private var background: Color {
        switch key {
        case "✓": return Color.kioskRed
        case "⌫": return Color.white.opacity(0.1)
        default:  return Color.white.opacity(0.08)
        }
    }

    private var accessibilityLabel: String {
        switch key {
        case "⌫": return "Delete last digit"
        case "✓": return "Submit code"
        default:  return key
        }
    }
}
