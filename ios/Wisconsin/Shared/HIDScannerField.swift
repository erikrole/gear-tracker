import SwiftUI
import UIKit

enum HIDScannerFocusGate {
    private static let defaultSuppressionDuration: TimeInterval = 20
    /// Short grace after a visible field ends editing so the sink's delayed
    /// re-acquire cannot slip in during a field-to-field keyboard handoff.
    private static let editingHandoffGrace: TimeInterval = 1.0
    private static var suppressedUntil = Date.distantPast
    private static var activeVisibleEditors = Set<ObjectIdentifier>()
    private static var observersInstalled = false

    /// The scanner sink may only take first responder when no visible text
    /// input is editing (ownership gate) AND no suppression window is active
    /// (transition grace). The ownership gate is what prevents the sink from
    /// stealing the keyboard mid-typing — it holds however long the student
    /// keeps the keyboard up, unlike the old time-window-only design that
    /// lapsed after 20 idle seconds.
    static var canAcquireScannerFocus: Bool {
        activeVisibleEditors.isEmpty && Date() >= suppressedUntil
    }

    static func suppressScannerFocus(for duration: TimeInterval = defaultSuppressionDuration) {
        let nextSuppression = Date().addingTimeInterval(duration)
        if nextSuppression > suppressedUntil {
            suppressedUntil = nextSuppression
        }
    }

    static func allowScannerFocusNow() {
        // Clears the time window only. A visible field that is literally still
        // editing keeps the keyboard until it resigns.
        suppressedUntil = .distantPast
    }

    /// Tracks every UIKit-backed text input in the process (UITextField,
    /// UITextView — including the fields backing SwiftUI TextFields) so the
    /// scanner sink can never steal first responder while one is editing.
    /// The sink itself (HIDTextField) is excluded from tracking.
    static func installEditingObserversIfNeeded() {
        guard !observersInstalled else { return }
        observersInstalled = true

        let center = NotificationCenter.default
        let beginNames = [UITextField.textDidBeginEditingNotification, UITextView.textDidBeginEditingNotification]
        let endNames = [UITextField.textDidEndEditingNotification, UITextView.textDidEndEditingNotification]
        for name in beginNames {
            center.addObserver(forName: name, object: nil, queue: .main) { note in
                guard let editor = note.object as? UIResponder, !(editor is HIDTextField) else { return }
                activeVisibleEditors.insert(ObjectIdentifier(editor))
            }
        }
        for name in endNames {
            center.addObserver(forName: name, object: nil, queue: .main) { note in
                guard let editor = note.object as? UIResponder, !(editor is HIDTextField) else { return }
                activeVisibleEditors.remove(ObjectIdentifier(editor))
                suppressScannerFocus(for: editingHandoffGrace)
            }
        }
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
        HIDScannerFocusGate.installEditingObserversIfNeeded()
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

        if !uiView.isFirstResponder {
            let coordinator = context.coordinator
            DispatchQueue.main.async { [weak uiView] in
                guard let uiView else { return }
                coordinator.ensureScannerFocus(uiView)
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
        private var pendingFocusRetry: DispatchWorkItem?
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
                pendingFocusRetry?.cancel()
                pendingFocusRetry = nil
            }
        }

        /// Converge to first responder whenever enabled and the focus gate is
        /// open. If a visible field currently owns the keyboard, retry until
        /// it lets go — this keeps scans working after typed-entry sheets and
        /// keyboard handoffs without stealing focus mid-typing.
        func ensureScannerFocus(_ textField: UITextField) {
            guard isEnabled, !textField.isFirstResponder else { return }
            if HIDScannerFocusGate.canAcquireScannerFocus {
                textField.becomeFirstResponder()
            } else {
                scheduleFocusRetry(textField)
            }
        }

        private func scheduleFocusRetry(_ textField: UITextField) {
            pendingFocusRetry?.cancel()
            let workItem = DispatchWorkItem { [weak self, weak textField] in
                guard let self, let textField else { return }
                self.ensureScannerFocus(textField)
            }
            pendingFocusRetry = workItem
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.3, execute: workItem)
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
                guard let self, self.isEnabled, let textField else { return }
                // ensureScannerFocus checks the focus gate and keeps retrying
                // until the visible field releases the keyboard.
                self.ensureScannerFocus(textField)
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
