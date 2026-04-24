import SwiftUI
import UIKit

// UIViewRepresentable text field for Bluetooth HID barcode scanners.
// Suppresses the on-screen keyboard (inputView = UIView()) while still
// capturing keystrokes from HID devices. Aggressively re-acquires
// first responder so the scanner is always active.
struct KioskScannerField: UIViewRepresentable {
    let onScan: (String) -> Void

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
        Coordinator(onScan: onScan)
    }

    final class Coordinator: NSObject, UITextFieldDelegate {
        let onScan: (String) -> Void
        init(onScan: @escaping (String) -> Void) { self.onScan = onScan }

        func textFieldShouldReturn(_ textField: UITextField) -> Bool {
            let value = (textField.text ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            if !value.isEmpty { onScan(value) }
            textField.text = ""
            return false
        }

        // Re-acquire focus if something else steals it
        func textFieldDidEndEditing(_ textField: UITextField) {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) {
                textField.becomeFirstResponder()
            }
        }
    }
}

// Custom UITextField that ignores attempts to resign first responder
// from gestures on other views, keeping the scanner always active.
private final class HIDTextField: UITextField {
    override var canBecomeFirstResponder: Bool { true }
}
