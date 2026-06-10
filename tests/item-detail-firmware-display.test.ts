import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function source(relativeFile: string) {
  return readFileSync(path.join(process.cwd(), relativeFile), "utf8");
}

describe("item detail firmware display", () => {
  it("returns firmware watch metadata from the asset detail API", () => {
    const route = source("src/app/api/assets/[id]/route.ts");

    expect(route).toContain("findFirmwareWatchTargetForAsset(asset.brand, asset.model)");
    expect(route).toContain("db.firmwareWatchTarget.findFirst");
    expect(route).toContain("latestVersion: true");
    expect(route).toContain("latestReleaseDate: true");
    expect(route).toContain("firmwareWatch,");
  });

  it("types and renders the editable firmware badge on the Info tab", () => {
    const types = source("src/app/(app)/items/[id]/types.ts");
    const infoTab = source("src/app/(app)/items/[id]/ItemInfoTab.tsx");

    expect(types).toContain("firmwareWatch: {");
    expect(types).toContain("supportMode: \"ACTIVE\" | \"MAINTENANCE\" | \"UNKNOWN\"");
    expect(infoTab).toContain("function FirmwareWatchPanel");
    expect(infoTab).toContain("installedFirmwareVersion");
    expect(infoTab).toContain("firmwareBadgeVariant");
    expect(infoTab).toContain("Set firmware");
    expect(infoTab).toContain("Outdated");
    expect(infoTab).toContain("Mark updated to latest");
    expect(infoTab).toContain("Sony update page");
    expect(infoTab).toContain("Official firmware source");
    expect(infoTab).toContain("asset.firmwareWatch &&");
    expect(infoTab).toContain('timeZone: "UTC"');
  });
});
