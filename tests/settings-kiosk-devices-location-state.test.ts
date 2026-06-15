import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("settings kiosk devices location state", () => {
  it("does not silently treat failed form-options locations as an empty kiosk picker", () => {
    const source = readFileSync("src/app/(app)/settings/kiosk-devices/page.tsx", "utf8");

    expect(source).toContain("error: formOptionsError");
    expect(source).toContain("reload: reloadFormOptions");
    expect(source).toContain("locationsUnavailable");
    expect(source).toContain("Locations could not load, so new kiosk devices cannot be assigned yet.");
    expect(source).toContain("Locations could not load. Kiosk assignment controls are unavailable until locations are readable.");
    expect(source).toContain("Retry locations");
    expect(source).toContain("disabled={adding || locationsUnavailable || !addName.trim() || !addLocationId}");
  });

  it("keeps kiosk create fields connected to form metadata", () => {
    const source = readFileSync("src/app/(app)/settings/kiosk-devices/page.tsx", "utf8");

    expect(source).toContain('name="kioskName"');
    expect(source).toContain('name="kioskLocationId"');
    expect(source).toContain('id="kiosk-name"');
    expect(source).toContain('id="kiosk-location"');
  });
});

describe("settings kiosk device activation reset", () => {
  it("lets an existing active kiosk generate a fresh code instead of forcing delete/recreate", () => {
    const page = readFileSync("src/app/(app)/settings/kiosk-devices/page.tsx", "utf8");
    const route = readFileSync("src/app/api/kiosk-devices/[id]/regenerate-code/route.ts", "utf8");

    expect(page).toContain('title: "Reset activation code?"');
    expect(page).toContain("This signs out the iPad and moves this device back to pending activation.");
    expect(page).toContain('{device.activated ? "Reset activation code" : "Regenerate code"}');
    expect(page).not.toContain("Deactivate the kiosk before regenerating its code.");

    expect(route).not.toContain("Cannot regenerate code for an already-activated kiosk");
    expect(route).toContain("activatedAt: null");
    expect(route).toContain("sessionToken: null");
    expect(route).toContain("sessionExpiresAt: null");
    expect(route).toContain("lastSeenAt: null");
    expect(route).toContain("resetSession: wasActivated");
  });
});
