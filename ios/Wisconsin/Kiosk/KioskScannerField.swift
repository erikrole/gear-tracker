import SwiftUI
import UIKit

// UIViewRepresentable text field for Bluetooth HID barcode scanners.
// Suppresses the on-screen keyboard (inputView = UIView()) while still
// capturing keystrokes from HID devices. Aggressively re-acquires
// first responder so the scanner is always active.
struct KioskScannerField: UIViewRepresentable {
    private static let scannerIdleFlushDelay: TimeInterval = 0.5

    let onScan: (String) -> Void
    let onFocusChange: ((Bool) -> Void)?

    init(
        onScan: @escaping (String) -> Void,
        onFocusChange: ((Bool) -> Void)? = nil
    ) {
        self.onScan = onScan
        self.onFocusChange = onFocusChange
    }

    func makeUIView(context: Context) -> UITextField {
        let field = HIDTextField()
        field.inputView = UIView()          // suppress software keyboard
        field.autocorrectionType = .no
        field.autocapitalizationType = .none
        field.delegate = context.coordinator
        field.tintColor = .clear            // hide cursor
        return field
    }

    func updateUIView(_ uiView: UITextField, context: Context) {
        if !uiView.isFirstResponder {
            DispatchQueue.main.async { uiView.becomeFirstResponder() }
        }
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(onScan: onScan, onFocusChange: onFocusChange)
    }

    final class Coordinator: NSObject, UITextFieldDelegate {
        let onScan: (String) -> Void
        let onFocusChange: ((Bool) -> Void)?
        private var pendingFlush: DispatchWorkItem?

        init(
            onScan: @escaping (String) -> Void,
            onFocusChange: ((Bool) -> Void)?
        ) {
            self.onScan = onScan
            self.onFocusChange = onFocusChange
        }

        func textFieldDidBeginEditing(_ textField: UITextField) {
            onFocusChange?(true)
        }

        func textField(
            _ textField: UITextField,
            shouldChangeCharactersIn range: NSRange,
            replacementString string: String
        ) -> Bool {
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
            submit(textField.text ?? "", textField: textField)
            return false
        }

        // Re-acquire focus if something else steals it
        func textFieldDidEndEditing(_ textField: UITextField) {
            onFocusChange?(false)
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) {
                textField.becomeFirstResponder()
            }
        }

        private func scheduleFlush(for textField: UITextField) {
            pendingFlush?.cancel()
            let workItem = DispatchWorkItem { [weak self, weak textField] in
                guard let self, let textField else { return }
                self.submit(textField.text ?? "", textField: textField)
            }
            pendingFlush = workItem
            DispatchQueue.main.asyncAfter(deadline: .now() + KioskScannerField.scannerIdleFlushDelay, execute: workItem)
        }

        private func submit(_ text: String, textField: UITextField) {
            pendingFlush?.cancel()
            pendingFlush = nil
            let value = text.trimmingCharacters(in: .whitespacesAndNewlines)
            if !value.isEmpty { onScan(value) }
            textField.text = ""
        }
    }
}

// Custom UITextField that ignores attempts to resign first responder
// from gestures on other views, keeping the scanner always active.
private final class HIDTextField: UITextField {
    override var canBecomeFirstResponder: Bool { true }
}
