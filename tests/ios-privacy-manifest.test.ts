import { execFileSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

const manifestPath = path.join(process.cwd(), "ios/Wisconsin/Supporting/PrivacyInfo.xcprivacy");

function manifestJson() {
  return JSON.parse(execFileSync("plutil", ["-convert", "json", "-o", "-", manifestPath], { encoding: "utf8" })) as {
    NSPrivacyTracking: boolean;
    NSPrivacyTrackingDomains: string[];
    NSPrivacyCollectedDataTypes: Array<{
      NSPrivacyCollectedDataType: string;
      NSPrivacyCollectedDataTypeLinked: boolean;
      NSPrivacyCollectedDataTypeTracking: boolean;
      NSPrivacyCollectedDataTypePurposes: string[];
    }>;
  };
}

describe("Wisconsin privacy manifest", () => {
  it("matches the source-grounded App Store privacy inventory", () => {
    const manifest = manifestJson();
    const declared = new Map(manifest.NSPrivacyCollectedDataTypes.map((entry) => [entry.NSPrivacyCollectedDataType, entry]));

    expect(manifest.NSPrivacyTracking).toBe(false);
    expect(manifest.NSPrivacyTrackingDomains).toEqual([]);

    for (const type of [
      "NSPrivacyCollectedDataTypeName",
      "NSPrivacyCollectedDataTypeEmailAddress",
      "NSPrivacyCollectedDataTypePhoneNumber",
      "NSPrivacyCollectedDataTypeUserID",
      "NSPrivacyCollectedDataTypeDeviceID",
      "NSPrivacyCollectedDataTypeOtherUsageData",
      "NSPrivacyCollectedDataTypeOtherDiagnosticData",
    ]) {
      const entry = declared.get(type);
      expect(entry, `${type} should remain declared`).toBeDefined();
      expect(entry?.NSPrivacyCollectedDataTypeLinked).toBe(true);
      expect(entry?.NSPrivacyCollectedDataTypeTracking).toBe(false);
      expect(entry?.NSPrivacyCollectedDataTypePurposes).toEqual(["NSPrivacyCollectedDataTypePurposeAppFunctionality"]);
    }

    for (const unsupportedType of [
      "NSPrivacyCollectedDataTypeProductInteraction",
      "NSPrivacyCollectedDataTypeCrashData",
      "NSPrivacyCollectedDataTypePerformanceData",
    ]) {
      expect(declared.has(unsupportedType), `${unsupportedType} has no native collection SDK`).toBe(false);
    }
  });
});
