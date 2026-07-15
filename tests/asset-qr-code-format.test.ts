import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ASSET_QR_CODE_LENGTH, generateAssetQrCode } from "@/lib/asset-qr-code";

describe("asset QR code generation", () => {
  it("generates shorter prefixless operator-facing codes", () => {
    for (let i = 0; i < 25; i++) {
      const code = generateAssetQrCode();

      expect(code).toHaveLength(ASSET_QR_CODE_LENGTH);
      expect(code).toMatch(/^[0-9A-F]{8}$/);
      expect(code).not.toMatch(/^QR-/);
    }
  });

  it("keeps generated asset QR paths on the shared format", () => {
    for (const file of [
      "src/app/api/assets/[id]/generate-qr/route.ts",
      "src/app/api/assets/[id]/duplicate/route.ts",
      "src/app/api/bulk-skus/[id]/qr-code/route.ts",
      "src/app/(app)/items/new-item-sheet/helpers.ts",
    ]) {
      const source = readFileSync(file, "utf8");

      expect(source).toContain("generateAssetQrCode");
      expect(source).not.toContain("`QR-${randomHex(8)");
      expect(source).not.toContain("return `QR-${hex}`");
    }
  });

  it("keeps scan lookup backward-compatible with older QR-prefixed labels", () => {
    const pickerSearch = readFileSync("src/app/api/assets/picker-search/route.ts", "utf8");
    const assetSearch = readFileSync("src/app/api/assets/route.ts", "utf8");
    const kioskScan = readFileSync("src/lib/services/kiosk-scan.ts", "utf8");

    expect(pickerSearch).toContain("const qrPrefixed = `QR-${qr}`");
    expect(assetSearch).toContain("{ qrCodeValue: { equals: `QR-${qr}`");
    expect(kioskScan).toContain("{ qrCodeValue: { equals: `qr-${trimmed}`");
  });
});
