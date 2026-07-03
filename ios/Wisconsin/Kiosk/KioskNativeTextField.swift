import SwiftUI
import UIKit

/// Native iOS text input for kiosk forms that need the system keyboard without
/// the iPad shortcut/suggestion assistant bar.
struct KioskNativeTextField: UIViewRepresentable {
    let placeholder: String
    @Binding var text: String
    @Binding var isFocused: Bool

    func makeUIView(context: Context) -> UITextField {
        let field = KioskKeyboardTextField()
        field.delegate = context.coordinator
        field.borderStyle = .none
        field.backgroundColor = .clear
        field.textColor = UIColor.label
        field.tintColor = UIColor(Color.kioskRed)
        field.font = UIFont.systemFont(ofSize: 15, weight: .semibold)
        field.returnKeyType = .done
        field.autocapitalizationType = .words
        field.autocorrectionType = .no
        field.spellCheckingType = .no
        field.smartDashesType = .no
        field.smartQuotesType = .no
        field.smartInsertDeleteType = .no
        field.textContentType = nil
        field.inputAssistantItem.leadingBarButtonGroups = []
        field.inputAssistantItem.trailingBarButtonGroups = []
        field.addTarget(context.coordinator, action: #selector(Coordinator.textDidChange(_:)), for: .editingChanged)
        return field
    }

    func updateUIView(_ uiView: UITextField, context: Context) {
        context.coordinator.parent = self
        if uiView.text != text {
            uiView.text = text
        }
        uiView.attributedPlaceholder = NSAttributedString(
            string: placeholder,
            attributes: [.foregroundColor: UIColor.secondaryLabel]
        )
        uiView.inputAssistantItem.leadingBarButtonGroups = []
        uiView.inputAssistantItem.trailingBarButtonGroups = []

        if isFocused {
            HIDScannerFocusGate.suppressScannerFocus()
        }

        if isFocused, !uiView.isFirstResponder {
            DispatchQueue.main.async {
                HIDScannerFocusGate.suppressScannerFocus()
                uiView.becomeFirstResponder()
            }
        } else if !isFocused, uiView.isFirstResponder {
            if let field = uiView as? KioskKeyboardTextField {
                field.forceResignFirstResponder()
            } else {
                uiView.resignFirstResponder()
            }
        }
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(parent: self)
    }

    final class Coordinator: NSObject, UITextFieldDelegate {
        var parent: KioskNativeTextField

        init(parent: KioskNativeTextField) {
            self.parent = parent
        }

        @objc func textDidChange(_ textField: UITextField) {
            (textField as? KioskKeyboardTextField)?.protectKeyboard()
            HIDScannerFocusGate.suppressScannerFocus()
            parent.text = textField.text ?? ""
        }

        func textFieldDidBeginEditing(_ textField: UITextField) {
            (textField as? KioskKeyboardTextField)?.protectKeyboard()
            HIDScannerFocusGate.suppressScannerFocus()
            parent.isFocused = true
        }

        func textFieldDidEndEditing(_ textField: UITextField) {
            parent.isFocused = false
        }

        func textFieldShouldReturn(_ textField: UITextField) -> Bool {
            parent.isFocused = false
            if let field = textField as? KioskKeyboardTextField {
                field.forceResignFirstResponder()
            } else {
                textField.resignFirstResponder()
            }
            return false
        }
    }
}

private final class KioskKeyboardTextField: UITextField {
    private static let resignProtectionDuration: TimeInterval = 1.2
    private var protectedUntil = Date.distantPast
    private var allowsForcedResign = false

    func protectKeyboard() {
        protectedUntil = Date().addingTimeInterval(Self.resignProtectionDuration)
    }

    func forceResignFirstResponder() {
        allowsForcedResign = true
        defer { allowsForcedResign = false }
        _ = super.resignFirstResponder()
    }

    override func resignFirstResponder() -> Bool {
        if !allowsForcedResign, Date() < protectedUntil {
            return false
        }
        return super.resignFirstResponder()
    }
}
