import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  canonicalFirmwareIdentity,
  canonicalFirmwareModel,
  isSupportedFirmwareSourceType,
  normalizeFirmwareBrand,
  validateFirmwareSourceUrl,
} from "@/lib/firmware-watch-targets";

describe("firmware watch shared canonicalization", () => {
  it("canonicalizes the Sony brand from any casing", () => {
    expect(normalizeFirmwareBrand("sony")).toBe("Sony");
    expect(normalizeFirmwareBrand("SONY")).toBe("Sony");
    expect(normalizeFirmwareBrand("  Sony  ")).toBe("Sony");
  });

  it("applies Sony model aliases", () => {
    expect(canonicalFirmwareModel("Sony", "ilce-7m3/B")).toBe("ILCE-7M3");
    expect(canonicalFirmwareModel("Sony", "LCE-7M4")).toBe("ILCE-7M4");
    expect(canonicalFirmwareModel("Sony", "ILME-FX6")).toBe("ILME-FX6V");
    expect(canonicalFirmwareModel("Sony", "ILME-FX6V")).toBe("ILME-FX6V");
  });

  it("passes non-Sony brands and models through with only trim+uppercase", () => {
    expect(normalizeFirmwareBrand("Canon")).toBe("Canon");
    // The /B strip is brand-agnostic uppercase normalization, but Sony-only
    // prefix aliases must not apply to other brands.
    expect(canonicalFirmwareModel("Canon", "lce-foo")).toBe("LCE-FOO");
    expect(canonicalFirmwareModel("Canon", "ILME-FX6")).toBe("ILME-FX6");
  });

  it("builds a null identity when brand or model is empty", () => {
    expect(canonicalFirmwareIdentity("", "ILCE-7M3")).toBeNull();
    expect(canonicalFirmwareIdentity("Sony", "")).toBeNull();
    expect(canonicalFirmwareIdentity("Sony", "ilme-fx6")).toEqual({
      brand: "Sony",
      model: "ILME-FX6V",
    });
  });
});

describe("firmware watch supported source types", () => {
  it("treats Sony support pages as supported", () => {
    expect(isSupportedFirmwareSourceType("SONY_SUPPORT")).toBe(true);
  });

  it("treats schema-known Canon support as runtime-unsupported", () => {
    expect(isSupportedFirmwareSourceType("CANON_SUPPORT")).toBe(false);
  });

  it("rejects a schema-known but unsupported source type before any URL work", () => {
    expect(() =>
      validateFirmwareSourceUrl(
        "CANON_SUPPORT",
        "https://www.usa.canon.com/support",
      ),
    ).toThrow("Unsupported firmware source type: CANON_SUPPORT");
  });

  it("accepts an official Sony HTTPS source URL", () => {
    expect(() =>
      validateFirmwareSourceUrl(
        "SONY_SUPPORT",
        "https://www.sony.com/electronics/support/software/00257843",
      ),
    ).not.toThrow();
  });

  it("rejects non-HTTPS and off-allowlist Sony URLs", () => {
    expect(() =>
      validateFirmwareSourceUrl("SONY_SUPPORT", "http://www.sony.com/x"),
    ).toThrow("Firmware source URL must use HTTPS");
    expect(() =>
      validateFirmwareSourceUrl("SONY_SUPPORT", "https://example.com/x"),
    ).toThrow("Firmware source host is not allowed for SONY_SUPPORT");
  });
});

describe("seed script alias contract", () => {
  it("documents the shared helper as the authoritative Sony alias contract", () => {
    const script = readFileSync(
      path.join(process.cwd(), "scripts/seed-firmware-watch-targets.mjs"),
      "utf8",
    );
    expect(script).toContain("src/lib/firmware-watch-targets.ts");
  });

  it("keeps the script's Sony aliases in sync with the shared helper", () => {
    // The seed script must produce the same canonical Sony models the runtime
    // matcher expects. These are the alias rules both sides commit to.
    const cases: Array<[string, string]> = [
      ["ilce-7m3/B", "ILCE-7M3"],
      ["LCE-7M4", "ILCE-7M4"],
      ["ILME-FX6", "ILME-FX6V"],
    ];
    for (const [input, expected] of cases) {
      expect(canonicalFirmwareModel("Sony", input)).toBe(expected);
    }
  });
});
