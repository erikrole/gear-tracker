import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
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
    expect(scanner).toContain("TimeInterval? = nil");
    expect(scanner).toContain("duration ?? defaultSuppressionDuration");
    expect(scanner).toContain("static func allowScannerFocusNow()");
    expect(scanner).toContain("HIDScannerFocusGate.canAcquireScannerFocus");

    // Ownership gate: the sink can never take first responder while a visible
    // UIKit text input is editing — not just during a fixed time window.
    expect(scanner).toContain("activeVisibleEditors.isEmpty && Date() >= suppressedUntil");
    expect(scanner).toContain("static func installEditingObserversIfNeeded()");
    expect(scanner).toContain("UITextField.textDidBeginEditingNotification");
    expect(scanner).toContain("UITextView.textDidBeginEditingNotification");
    expect(scanner).toContain("!(editor is HIDTextField)");
    expect(scanner).toContain("HIDScannerFocusGate.installEditingObserversIfNeeded()");

    // Self-healing acquisition: blocked attempts retry until the keyboard is
    // released, so the scanner is never left dead after typed-entry sheets.
    expect(scanner).toContain("func ensureScannerFocus(_ textField: UITextField)");
    expect(scanner).toContain("private func scheduleFocusRetry(_ textField: UITextField)");
    expect(scanner).toContain("pendingFocusRetry?.cancel()");

    // Plain @State, never @FocusState: the UIKit-backed booking-name field is
    // invisible to SwiftUI's focus system, so a @FocusState value for it gets
    // reset to nil on the next focus pass and the stale binding force-resigns
    // the keyboard the instant the field is tapped.
    expect(checkout).toContain("@State private var focusedCheckoutField: KioskCheckoutFocusedField? = nil");
    expect(checkout).not.toContain("@FocusState private var focusedCheckoutField");
    expect(checkout).not.toContain("FocusState<KioskCheckoutFocusedField?>.Binding");
    expect(checkout).toContain("@State private var scannerCaptureEnabled = false");
    expect(checkout).toContain("private var shouldListenForHIDScans: Bool");
    expect(checkout).toContain("scannerCaptureEnabled && checkoutContextReady");
    expect(checkout).toContain("focusedCheckoutField == nil");
    expect(checkout).toContain("if scannerCaptureEnabled {");
    expect(checkout).toContain("HIDScannerField(isEnabled: shouldListenForHIDScans)");
    expect(checkout).toContain("KioskNativeTextField(");
    expect(checkout).toContain("focusedField.wrappedValue == .customPurpose");
    expect(checkout).toContain("HIDScannerFocusGate.allowScannerFocusNow()");
    expect(checkout).toContain("UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder)");
    expect(checkout).toContain("DispatchQueue.main.async {\n            HIDScannerFocusGate.allowScannerFocusNow()\n            scannerCaptureEnabled = true");
    expect(checkout).toContain("scannerCaptureEnabled = true");
    expect(checkout).toContain("scannerCaptureEnabled = false");
    expect(checkout).not.toContain("private struct KioskPurposeKeyboard: View");

    // Existing-checkout equipment editing owns a separate scanner phase. It
    // submits HID scans directly and yields whenever the visible title field,
    // a custody mutation, or a removal confirmation owns interaction.
    const detailSheet = source("ios/Wisconsin/Kiosk/KioskCheckoutDetailSheet.swift");
    expect(detailSheet).toContain("HIDScannerField(isEnabled: shouldListenForItemScans)");
    expect(detailSheet).toContain("scannerCaptureEnabled");
    expect(detailSheet).toContain("!titleFocused");
    expect(detailSheet).toContain("!isMutating");
    expect(detailSheet).toContain("pendingRemoval == nil");
    expect(detailSheet).toContain("HIDScannerFocusGate.allowScannerFocusNow()");
    expect(detailSheet).toContain(".onChange(of: titleFocused)");
    expect(detailSheet).toContain("if !isFocused {");
    expect(detailSheet).toContain("armScannerCapture()");
    expect(detailSheet).toContain("Task { await addItem(scanValue: value) }");
    expect(detailSheet).not.toContain('placeholder: "Scan or type item"');

    expect(shell).toContain("KioskActivityMonitor { store.resetInactivity() }");
    expect(shell).toContain("private struct KioskActivityMonitor: UIViewRepresentable");
    expect(shell).toContain("recognizer.cancelsTouchesInView = false");
    expect(shell).toContain("shouldRecognizeSimultaneouslyWith otherGestureRecognizer");
    expect(shell).not.toContain(".simultaneousGesture(TapGesture");
    expect(shell).not.toContain("DragGesture(minimumDistance");
  });

  it("never bridges UIKit-backed text fields through @FocusState anywhere in the kiosk", () => {
    // Class-wide guard for the 2026-07-06 keyboard-death bug: a UIKit-backed
    // KioskNativeTextField is invisible to SwiftUI's focus system, so any
    // @FocusState value written for it gets reset to nil on the next focus
    // pass and the stale binding force-resigns the keyboard on tap.
    const kioskDir = path.join(process.cwd(), "ios/Wisconsin/Kiosk");
    const files = readdirSync(kioskDir).filter((file) => file.endsWith(".swift"));
    for (const file of files) {
      const text = source(path.join("ios/Wisconsin/Kiosk", file));
      if (text.includes("KioskNativeTextField(")) {
        // Declarations only — comments may mention @FocusState to explain the ban.
        expect(text, `${file} mounts KioskNativeTextField and must not declare @FocusState`).not.toMatch(/@FocusState\s+(private\s+)?var/);
        expect(text, `${file} must not type props as FocusState bindings`).not.toContain("FocusState<");
      }
    }
  });

  it("offers the scanner double-press tip when the keyboard never appears", () => {
    const components = source("ios/Wisconsin/Kiosk/KioskComponents.swift");
    const checkout = source("ios/Wisconsin/Kiosk/KioskCheckoutView.swift");
    const sheet = source("ios/Wisconsin/Kiosk/KioskCheckoutDetailSheet.swift");

    expect(components).toContain("struct KioskKeyboardHint: View");
    expect(components).toContain("Double-press the scanner button");
    // Only a real software keyboard counts — the hardware-keyboard assistant
    // strip posts keyboard notifications too, with a short frame.
    expect(components).toContain("UIResponder.keyboardDidShowNotification");
    expect(components).toContain("UIResponder.keyboardWillHideNotification");
    expect(components).toContain("frame.height > 120");
    // Grace period so a normally-appearing keyboard never flashes the tip.
    expect(components).toContain("try? await Task.sleep(nanoseconds: 750_000_000)");

    expect(checkout).toContain("KioskKeyboardHint(isFieldFocused: focusedField.wrappedValue == .customPurpose)");
    expect(sheet).toContain("KioskKeyboardHint(isFieldFocused: titleFocused)");
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
    expect(nativeField).toContain("field.forceResignFirstResponder()");
    expect(nativeField).toContain("override func resignFirstResponder() -> Bool");
    expect(nativeField).not.toContain("resignIfUnprotected()");
    expect(nativeField).not.toContain("inputView = UIView()");
    expect(nativeField).not.toContain("textField.reloadInputViews()");

    expect(scanner).toContain("field.inputAssistantItem.leadingBarButtonGroups = []");
    expect(scanner).toContain("field.inputAssistantItem.trailingBarButtonGroups = []");
  });
});
