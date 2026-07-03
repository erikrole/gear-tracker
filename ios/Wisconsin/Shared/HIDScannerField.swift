import SwiftUI
import UIKit

enum HIDScannerFocusGate {
    private static let defaultSuppressionDuration: TimeInterval = 20
    private static var suppressedUntil = Date.distantPast

    static var canAcquireScannerFocus: Bool {
        Date() >= suppressedUntil
    }

    static func suppressScannerFocus(for duration: TimeInterval = defaultSuppressionDuration) {
        let nextSuppression = Date().addingTimeInterval(duration)
        if nextSuppression > suppressedUntil {
            suppressedUntil = nextSuppression
        }
    }

    static func allowScannerFocusNow() {
        suppressedUntil = .distantPast
    }
}

// UIViewRepresentable text field for Bluetooth HID barcode scanners.
// Suppresses the on-screen keyboard (inputView = UIView()) while still
// capturing keystrokes from HID devices. Re-acquires first responder while
// enabled so scanner capture remains active during dedicated scan phases.
struct HIDScannerField: UIViewRepresentable {
    private static let scannerIdleFlushDelay: TimeInterval = 0.5

    let isEnabled: Bool
    let onScan: (String) -> Void
    let onFocusChange: ((Bool) -> Void)?

    init(
        isEnabled: Bool = true,
        onScan: @escaping (String) -> Void,
        onFocusChange: ((Bool) -> Void)? = nil
    ) {
        self.isEnabled = isEnabled
        self.onScan = onScan
        self.onFocusChange = onFocusChange
    }

    func makeUIView(context: Context) -> UITextField {
        let field = HIDTextField()
        field.inputView = UIView()
        field.autocorrectionType = .no
        field.spellCheckingType = .no
        field.autocapitalizationType = .none
        field.textContentType = nil
        field.inputAssistantItem.leadingBarButtonGroups = []
        field.inputAssistantItem.trailingBarButtonGroups = []
        field.delegate = context.coordinator
        field.tintColor = .clear
        return field
    }

    func updateUIView(_ uiView: UITextField, context: Context) {
        context.coordinator.setEnabled(isEnabled)
        guard isEnabled else {
            uiView.text = ""
            if uiView.isFirstResponder {
                uiView.resignFirstResponder()
            }
            return
        }

        if !uiView.isFirstResponder, HIDScannerFocusGate.canAcquireScannerFocus {
            DispatchQueue.main.async {
                guard HIDScannerFocusGate.canAcquireScannerFocus else { return }
                uiView.becomeFirstResponder()
            }
        }
        uiView.inputAssistantItem.leadingBarButtonGroups = []
        uiView.inputAssistantItem.trailingBarButtonGroups = []
    }

    static func dismantleUIView(_ uiView: UITextField, coordinator: Coordinator) {
        coordinator.setEnabled(false)
        uiView.text = ""
        if uiView.isFirstResponder {
            uiView.resignFirstResponder()
        }
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(onScan: onScan, onFocusChange: onFocusChange)
    }

    final class Coordinator: NSObject, UITextFieldDelegate {
        let onScan: (String) -> Void
        let onFocusChange: ((Bool) -> Void)?
        private var pendingFlush: DispatchWorkItem?
        private(set) var isEnabled = true

        init(
            onScan: @escaping (String) -> Void,
            onFocusChange: ((Bool) -> Void)?
        ) {
            self.onScan = onScan
            self.onFocusChange = onFocusChange
        }

        func setEnabled(_ enabled: Bool) {
            isEnabled = enabled
            if !enabled {
                pendingFlush?.cancel()
                pendingFlush = nil
            }
        }

        func textFieldDidBeginEditing(_ textField: UITextField) {
            onFocusChange?(true)
        }

        func textField(
            _ textField: UITextField,
            shouldChangeCharactersIn range: NSRange,
            replacementString string: String
        ) -> Bool {
            guard isEnabled else { return false }
            guard let current = textField.text,
                  let textRange = Range(range, in: current) else {
                return true
            }

            let projected = current.replacingCharacters(in: textRange, with: string)
            if string.rangeOfCharacter(from: .newlines) != nil || string == "\t" {
                submit(projected, textField: textField)
                return false
            }

            scheduleFlush(for: textField)
            return true
        }

        func textFieldShouldReturn(_ textField: UITextField) -> Bool {
            guard isEnabled else { return false }
            submit(textField.text ?? "", textField: textField)
            return false
        }

        func textFieldDidEndEditing(_ textField: UITextField) {
            onFocusChange?(false)
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) { [weak self, weak textField] in
                guard let self, self.isEnabled, let textField, HIDScannerFocusGate.canAcquireScannerFocus else { return }
                textField.becomeFirstResponder()
            }
        }

        private func scheduleFlush(for textField: UITextField) {
            guard isEnabled else { return }
            pendingFlush?.cancel()
            let workItem = DispatchWorkItem { [weak self, weak textField] in
                guard let self, self.isEnabled, let textField else { return }
                self.submit(textField.text ?? "", textField: textField)
            }
            pendingFlush = workItem
            DispatchQueue.main.asyncAfter(deadline: .now() + HIDScannerField.scannerIdleFlushDelay, execute: workItem)
        }

        private func submit(_ text: String, textField: UITextField) {
            guard isEnabled else { return }
            pendingFlush?.cancel()
            pendingFlush = nil
            let value = text.trimmingCharacters(in: .whitespacesAndNewlines)
            if !value.isEmpty { onScan(value) }
            textField.text = ""
        }
    }
}

// Custom UITextField used only as a HID scanner sink. Focus ownership is
// controlled by HIDScannerField's enabled state.
private final class HIDTextField: UITextField {
    override var canBecomeFirstResponder: Bool { true }
}
