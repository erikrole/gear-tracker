import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function source(relativeFile: string) {
  return readFileSync(path.join(process.cwd(), relativeFile), "utf8");
}

describe("iOS main app and kiosk target split", () => {
  it("keeps kiosk sources out of the main Wisconsin target", () => {
    const project = source("ios/project.yml");
    const mainTarget = project.slice(
      project.indexOf("  Wisconsin:"),
      project.indexOf("  WisconsinKiosk:"),
    );
    const kioskTarget = project.slice(project.indexOf("  WisconsinKiosk:"));

    expect(mainTarget).toContain("- Kiosk/**");
    expect(mainTarget).toContain("- KioskOnly/**");
    expect(kioskTarget).toContain("- path: Wisconsin/KioskOnly");
    expect(kioskTarget).toContain("- path: Wisconsin/Kiosk");
  });

  it("does not expose kiosk launch routes from the main app shell or Settings", () => {
    const app = source("ios/Wisconsin/App/WisconsinApp.swift");
    const delegate = source("ios/Wisconsin/App/AppDelegate.swift");
    const profile = source("ios/Wisconsin/Views/ProfileView.swift");

    expect(app).not.toContain("KioskStore");
    expect(app).not.toContain("KioskShellView");
    expect(app).not.toContain('url.host == "kiosk"');
    expect(app).toContain('url.host == "booking"');

    expect(profile).not.toContain("KioskStore");
    expect(profile).not.toContain("Kiosk Mode");
    expect(profile).not.toContain("enterKiosk");
    expect(profile).toContain("Scanner Debugger");

    expect(delegate).not.toContain("sharedKioskStore");
    expect(delegate).toContain("return .all");
  });
});
