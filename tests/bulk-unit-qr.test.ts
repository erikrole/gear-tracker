import { describe, expect, it } from "vitest";
import { buildDerivedBulkUnitQrValue, parseDerivedBulkUnitQr } from "@/lib/bulk-unit-qr";

describe("buildDerivedBulkUnitQrValue", () => {
  it("formats the derived unit QR value as {binQrCodeValue}-{unitNumber}", () => {
    expect(buildDerivedBulkUnitQrValue("SONY-BATTERY", 3)).toBe("SONY-BATTERY-3");
  });

  it("trims surrounding whitespace from the bin QR value", () => {
    expect(buildDerivedBulkUnitQrValue("  94e068d1 ", 16)).toBe("94e068d1-16");
  });

  it("round-trips through the parser", () => {
    const value = buildDerivedBulkUnitQrValue("94e068d1", 7);
    expect(parseDerivedBulkUnitQr(value, [
      { id: "sony-battery", binQrCodeValue: "94e068d1", trackByNumber: true },
    ])).toEqual({ bulkSkuId: "sony-battery", binQrCodeValue: "94e068d1", unitNumber: 7 });
  });

  it("rejects empty bin QR values and invalid unit numbers", () => {
    expect(() => buildDerivedBulkUnitQrValue("   ", 1)).toThrow();
    expect(() => buildDerivedBulkUnitQrValue("BIN", 0)).toThrow();
    expect(() => buildDerivedBulkUnitQrValue("BIN", -2)).toThrow();
  });
});

describe("parseDerivedBulkUnitQr", () => {
  it("resolves numbered unit QR values from the parent bin QR", () => {
    expect(parseDerivedBulkUnitQr("94e068d1-7", [
      { id: "sony-battery", binQrCodeValue: "94e068d1", trackByNumber: true },
    ])).toEqual({
      bulkSkuId: "sony-battery",
      binQrCodeValue: "94e068d1",
      unitNumber: 7,
    });
  });

  it("matches case-insensitively and trims scanner whitespace", () => {
    expect(parseDerivedBulkUnitQr(" 94E068D1-16 ", [
      { id: "sony-battery", binQrCodeValue: "94e068d1", trackByNumber: true },
    ])?.unitNumber).toBe(16);
  });

  it("does not resolve quantity-only bulk SKUs", () => {
    expect(parseDerivedBulkUnitQr("94e068d1-7", [
      { id: "gaff-tape", binQrCodeValue: "94e068d1", trackByNumber: false },
    ])).toBeNull();
  });

  it("rejects missing and invalid unit numbers", () => {
    const skus = [{ id: "sony-battery", binQrCodeValue: "94e068d1", trackByNumber: true }];

    expect(parseDerivedBulkUnitQr("94e068d1-", skus)).toBeNull();
    expect(parseDerivedBulkUnitQr("94e068d1-0", skus)).toBeNull();
    expect(parseDerivedBulkUnitQr("94e068d1-7A", skus)).toBeNull();
  });

  it("prefers the longest bin QR prefix when bin QR values contain hyphens", () => {
    expect(parseDerivedBulkUnitQr("BIN-QR-1-12", [
      { id: "short", binQrCodeValue: "BIN", trackByNumber: true },
      { id: "long", binQrCodeValue: "BIN-QR-1", trackByNumber: true },
    ])).toEqual({
      bulkSkuId: "long",
      binQrCodeValue: "BIN-QR-1",
      unitNumber: 12,
    });
  });
});
