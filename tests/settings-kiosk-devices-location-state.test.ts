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
