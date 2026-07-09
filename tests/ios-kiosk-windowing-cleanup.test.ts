import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

function source(relativeFile: string) {
  return readFileSync(path.join(process.cwd(), relativeFile), "utf8");
}

describe("iOS kiosk windowing cleanup", () => {
  it("retires full-screen compatibility mode while declaring every iPad orientation", () => {
    const project = source("ios/project.yml");
    const plist = source("ios/Wisconsin/KioskOnly/Info.plist");
    const kioskTarget = project.slice(
      project.indexOf("  WisconsinKiosk:\n"),
      project.indexOf("  WisconsinTests:\n"),
    );

    expect(kioskTarget).not.toContain("UIRequiresFullScreen");
    expect(plist).not.toContain("UIRequiresFullScreen");
    for (const orientation of [
      "UIInterfaceOrientationPortrait",
      "UIInterfaceOrientationLandscapeLeft",
      "UIInterfaceOrientationLandscapeRight",
      "UIInterfaceOrientationPortraitUpsideDown",
    ]) {
      expect(kioskTarget).toContain(orientation);
      expect(plist).toContain(orientation);
    }
  });

  it("keeps the kiosk usable in compact and resized scenes", () => {
    const app = source("ios/Wisconsin/KioskOnly/KioskOnlyApp.swift");
    const chrome = source("ios/Wisconsin/Kiosk/KioskChrome.swift");
    const checkout = source("ios/Wisconsin/Kiosk/KioskCheckoutView.swift");
    const pickup = source("ios/Wisconsin/Kiosk/KioskPickupView.swift");
    const returned = source("ios/Wisconsin/Kiosk/KioskReturnView.swift");
    const hub = source("ios/Wisconsin/Kiosk/KioskStudentHubView.swift");

    expect(app).toContain(".windowResizability(.contentMinSize)");
    expect(app).toContain(".frame(minWidth: 640, minHeight: 540)");
    expect(chrome).toContain("struct KioskAdaptiveSplit<Primary: View, Secondary: View>: View");
    expect(chrome).toContain("proxy.size.width < KioskLayout.compactBreakpoint");
    expect(chrome).toContain("primary(true)");
    expect(chrome).toContain("secondary(true)");
    expect(checkout).toContain("KioskAdaptiveSplit { _ in");
    expect(checkout).toContain("KioskSideRail(isCompact: isCompact)");
    expect(pickup).toContain("KioskAdaptiveSplit { _ in");
    expect(pickup).toContain("KioskSideRail(isCompact: isCompact)");
    expect(returned).toContain("KioskAdaptiveSplit { _ in");
    expect(returned).toContain("KioskSideRail(isCompact: isCompact)");
    expect(hub).toContain("KioskAdaptiveSplit(compactSecondaryFraction: 0.40)");
  });

  it("resolves the scanner suppression default inside the main-actor gate", () => {
    const scanner = source("ios/Wisconsin/Shared/HIDScannerField.swift");

    expect(scanner).toContain("static func suppressScannerFocus(for duration: TimeInterval? = nil)");
    expect(scanner).toContain("let duration = duration ?? defaultSuppressionDuration");
    expect(scanner).not.toContain("TimeInterval = defaultSuppressionDuration");
  });
});
