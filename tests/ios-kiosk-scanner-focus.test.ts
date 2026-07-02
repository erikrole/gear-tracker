import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

function source(relativeFile: string) {
  return readFileSync(path.join(process.cwd(), relativeFile), "utf8");
}

describe("iOS kiosk scanner focus", () => {
  it("keeps scanner capture gated while native checkout inputs own focus", () => {
    const scanner = source("ios/Wisconsin/Shared/HIDScannerField.swift");
    const checkout = source("ios/Wisconsin/Kiosk/KioskCheckoutView.swift");
    const shell = source("ios/Wisconsin/Kiosk/KioskShellView.swift");

    expect(scanner).toContain("let isEnabled: Bool");
    expect(scanner).toContain("guard isEnabled else {");
    expect(scanner).toContain("static func dismantleUIView");
    expect(scanner).toContain("coordinator.setEnabled(false)");
    expect(scanner).toContain("enum HIDScannerFocusGate");
    expect(scanner).toContain("static func suppressScannerFocus");
    expect(scanner).toContain("HIDScannerFocusGate.canAcquireScannerFocus");
    expect(scanner).toContain("guard let self, self.isEnabled, let textField, HIDScannerFocusGate.canAcquireScannerFocus else { return }");

    expect(checkout).toContain("@FocusState private var focusedCheckoutField: KioskCheckoutFocusedField?");
    expect(checkout).toContain("@State private var scannerCaptureEnabled = false");
    expect(checkout).toContain("private var shouldListenForHIDScans: Bool");
    expect(checkout).toContain("scannerCaptureEnabled && checkoutContextReady");
    expect(checkout).toContain("focusedCheckoutField == nil");
    expect(checkout).toContain("if scannerCaptureEnabled {");
    expect(checkout).toContain("HIDScannerField(isEnabled: shouldListenForHIDScans)");
    expect(checkout).toContain("KioskNativeTextField(");
    expect(checkout).toContain("focusedField.wrappedValue == .customPurpose");
    expect(checkout).toContain("scannerCaptureEnabled = true");
    expect(checkout).toContain("scannerCaptureEnabled = false");
    expect(checkout).not.toContain("private struct KioskPurposeKeyboard: View");

    expect(shell).toContain("DragGesture(minimumDistance: 16)");
    expect(shell).not.toContain("DragGesture(minimumDistance: 0)");
  });

  it("keeps kiosk native text input on the system keyboard without the assistant bar", () => {
    const nativeField = source("ios/Wisconsin/Kiosk/KioskNativeTextField.swift");
    const scanner = source("ios/Wisconsin/Shared/HIDScannerField.swift");

    expect(nativeField).toContain("struct KioskNativeTextField: UIViewRepresentable");
    expect(nativeField).toContain("field.inputAssistantItem.leadingBarButtonGroups = []");
    expect(nativeField).toContain("field.inputAssistantItem.trailingBarButtonGroups = []");
    expect(nativeField).toContain("field.autocorrectionType = .no");
    expect(nativeField).toContain("field.spellCheckingType = .no");
    expect(nativeField).toContain("HIDScannerFocusGate.suppressScannerFocus()");
    expect(nativeField).toContain("let field = KioskKeyboardTextField()");
    expect(nativeField).toContain("protectKeyboard()");
    expect(nativeField).toContain("override func resignFirstResponder() -> Bool");
    expect(nativeField).not.toContain("inputView = UIView()");
    expect(nativeField).not.toContain("textField.reloadInputViews()");

    expect(scanner).toContain("field.inputAssistantItem.leadingBarButtonGroups = []");
    expect(scanner).toContain("field.inputAssistantItem.trailingBarButtonGroups = []");
  });
});
