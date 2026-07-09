import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

function source(relativeFile: string) {
  return readFileSync(path.join(process.cwd(), relativeFile), "utf8");
}

describe("iOS kiosk checkout details polish", () => {
  it("models checkout setup as either ad hoc or linked to an event", () => {
    const checkout = source("ios/Wisconsin/Kiosk/KioskCheckoutView.swift");

    expect(checkout).toContain("@State private var isLinkedToEvent = false");
    expect(checkout).toContain('Toggle("Link to event", isOn: $isLinkedToEvent)');
    expect(checkout).toContain("isLinkedToEvent ? selectedEvent != nil : !trimmedCustomPurpose.isEmpty");
    expect(checkout).toContain("eventId: isLinkedToEvent ? selectedEvent?.id : nil");
    expect(checkout).toContain("customPurpose: !isLinkedToEvent && !trimmedCustomPurpose.isEmpty ? trimmedCustomPurpose : nil");
    expect(checkout).toContain(".onChange(of: isLinkedToEvent)");
    expect(checkout).toContain("customPurpose = \"\"");
    expect(checkout).not.toContain("person.crop.circle.badge.checkmark");
  });

  it("puts booking name in context and return time in its own window before scanning", () => {
    const checkout = source("ios/Wisconsin/Kiosk/KioskCheckoutView.swift");

    expect(checkout).toContain("private var checkoutLayout: some View");
    expect(checkout).toContain("if checkoutContextReady {");
    expect(checkout).toContain("KioskAdaptiveSplit { _ in");
    expect(checkout).toContain("KioskSideRail(isCompact: isCompact)");
    expect(checkout).toContain("checkoutContextSetupZone");
    expect(checkout).toContain("KioskCheckoutSetupPanel(");
    expect(checkout).toContain("private struct KioskCheckoutSetupPanel");
    expect(checkout).toContain("KioskCheckoutSetupHero");
    expect(checkout).toContain("private struct KioskCheckoutWindow");
    expect(checkout).toContain("static let maxWidth: CGFloat = 1048");
    expect(checkout).toContain("static let contextColumnWidth: CGFloat = 376");
    expect(checkout).toContain("static let returnColumnWidth: CGFloat = 648");
    expect(checkout).toContain("static let returnDateWidth: CGFloat = 390");
    expect(checkout).toContain("ViewThatFits(in: .vertical)");
    expect(checkout).toContain("ViewThatFits(in: .horizontal)");
    expect(checkout).toContain("HStack(alignment: .top, spacing: KioskSpacing.lg) {");
    expect(checkout).toContain(".frame(width: KioskCheckoutSetupLayout.contextColumnWidth");
    expect(checkout).toContain(".frame(width: KioskCheckoutSetupLayout.returnColumnWidth");
    expect(checkout).toContain("KioskCheckoutContextWindow(");
    expect(checkout).toContain("KioskCheckoutReturnWindow(dueBackAt: $dueBackAt)");
    expect(checkout).toContain('title: "Context"');
    expect(checkout).toContain('KioskCheckoutWindow(title: "Return")');
    expect(checkout).toContain('"Upcoming events"');
    expect(checkout).toContain("KioskCheckoutEventRow(");
    expect(checkout).toContain('"All Events"');
    expect(checkout).toContain('"Booking name"');
    expect(checkout).toContain("KioskNativeTextField(");
    expect(checkout).toContain('"Return time"');
    expect(checkout).toContain(".contentShape(Rectangle())");
    expect(checkout).toContain(".buttonStyle(.plain)");
    expect(checkout).toContain(".frame(maxWidth: .infinity, maxHeight: .infinity)");
    expect(checkout).not.toContain('KioskCheckoutWindow(title: "Details")');
    expect(checkout).not.toContain("KioskCheckoutDetailsWindow");
    expect(checkout).not.toContain('"Ad hoc checkout"');
    expect(checkout).not.toContain('"No event linked"');
    expect(checkout).not.toContain("setupStep(");
    expect(checkout).not.toContain("returnColumnMinWidth");
    expect(checkout).toContain("VStack(alignment: .leading, spacing: KioskSpacing.lg) {");
    expect(checkout).not.toContain("KioskCheckoutPurposeSection");
    expect(checkout).not.toContain("KioskCheckoutEventChoiceButton(");
    expect(checkout).not.toContain(".buttonStyle(KioskPressStyle())");
  });

  it("keeps return editing native and always visible without preset/custom mode", () => {
    const checkout = source("ios/Wisconsin/Kiosk/KioskCheckoutView.swift");

    expect(checkout).toContain("private struct KioskCheckoutReturnDatePicker");
    expect(checkout).toContain("private struct KioskUICalendarPicker: UIViewRepresentable");
    expect(checkout).toContain("UICalendarView()");
    expect(checkout).toContain("UICalendarSelectionSingleDate(delegate: context.coordinator)");
    expect(checkout).toContain("canSelectDate dateComponents");
    expect(checkout).toContain("didSelectDate dateComponents");
    expect(checkout).toContain("private struct KioskUIDatePicker: UIViewRepresentable");
    expect(checkout).toContain("UIDatePicker()");
    expect(checkout).toContain("preferredDatePickerStyle = preferredStyle");
    expect(checkout).toContain("displayedComponent: .time");
    expect(checkout).toContain("preferredStyle: .wheels");
    expect(checkout).toContain("mergedSelection(from dateComponents: DateComponents?)");
    expect(checkout).toContain("mergedSelection(from pickerDate: Date)");
    expect(checkout).toContain("ViewThatFits(in: .horizontal)");
    expect(checkout).not.toContain("displayedComponent: .date");
    expect(checkout).not.toContain("preferredStyle: .inline");
    expect(checkout).not.toContain('DatePicker(\n            "Return date"');
    expect(checkout).not.toContain('DatePicker(\n            "Return time"');
    expect(checkout).not.toContain(".datePickerStyle(.graphical)");
    expect(checkout).not.toContain(".datePickerStyle(.wheel)");
    expect(checkout).not.toContain("private enum KioskCheckoutReturnPreset");
    expect(checkout).not.toContain('Picker("Return preset"');
    expect(checkout).not.toContain(".pickerStyle(.segmented)");
    expect(checkout).not.toContain("showsCustomReturnPicker");
    expect(checkout).not.toContain('case custom = "Custom"');
    expect(checkout).not.toContain("purposeSuggestions");
    expect(checkout).not.toContain("KioskQuickSelectButton(");
    expect(checkout).not.toContain('"Repair/Test"');
    expect(checkout).not.toContain('"Game Prep"');
    expect(checkout).not.toContain('"Walk-up"');
  });
});
