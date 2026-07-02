import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

function source(relativeFile: string) {
  return readFileSync(path.join(process.cwd(), relativeFile), "utf8");
}

describe("iOS kiosk checkout details polish", () => {
  it("keeps return-time editing inline and native instead of opening a custom sheet", () => {
    const checkout = source("ios/Wisconsin/Kiosk/KioskCheckoutView.swift");

    expect(checkout).toContain("showsCustomReturnPicker");
    expect(checkout).toContain("DatePicker(");
    expect(checkout).toContain(".datePickerStyle(.wheel)");
    expect(checkout).toContain("KioskQuickSelectButton(");
    expect(checkout).not.toContain("KioskReturnTimePickerSheet");
    expect(checkout).not.toContain("private enum KioskReturnPickerMode");
    expect(checkout).not.toContain(".presentationDetents");
    expect(checkout).not.toContain(".datePickerStyle(.compact)");
  });

  it("centers setup details before scanning instead of showing an empty items rail", () => {
    const checkout = source("ios/Wisconsin/Kiosk/KioskCheckoutView.swift");

    expect(checkout).toContain("private var checkoutLayout: some View");
    expect(checkout).toContain("if checkoutContextReady {");
    expect(checkout).toContain("KioskSideRail {");
    expect(checkout).toContain("checkoutContextSetupZone");
    expect(checkout).toContain(".frame(maxWidth: .infinity, maxHeight: .infinity)");
  });

  it("makes upcoming events and return-time suggestions prominent in checkout details", () => {
    const checkout = source("ios/Wisconsin/Kiosk/KioskCheckoutView.swift");

    expect(checkout).toContain("KioskCheckoutEventChoiceButton(");
    expect(checkout).toContain("Upcoming events");
    expect(checkout).toContain("featuredEvents");
    expect(checkout).toContain("purposeSuggestions");
    expect(checkout).toContain('quickButton("2 hr"');
    expect(checkout).toContain('quickButton("4 hr"');
    expect(checkout).toContain('quickButton("Tomorrow AM"');
    expect(checkout).toContain('quickButton("24 hr"');
    expect(checkout).toContain('quickButton("Event End"');
    expect(checkout).toContain('return ["Event", "Practice", "Shoot", "Media Day"]');
    expect(checkout).not.toContain('"Repair/Test"');
    expect(checkout).not.toContain('"Game Prep"');
    expect(checkout).not.toContain('"Walk-up"');
  });
});
