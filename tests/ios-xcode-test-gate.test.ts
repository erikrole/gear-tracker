import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("iOS Xcode verification gate", () => {
  it("runs each scheme's XCTest target on a compatible simulator by default", () => {
    const script = readFileSync("scripts/ios-xcode-verify.sh", "utf8");

    expect(script).toContain('SCHEME="${IOS_SCHEME:-Wisconsin}"');
    expect(script).toContain('elif [[ "$SCHEME" == "WisconsinKiosk" ]]');
    expect(script).toContain("platform=iOS Simulator,name=iPhone 16,OS=latest");
    expect(script).toContain("platform=iOS Simulator,name=iPad (A16),OS=latest");
    expect(script).toContain('if [[ "${IOS_SKIP_TESTS:-0}" != "1" ]]');
    expect(script).toContain('run_step "XCTest simulator suite"');
    expect(script).toMatch(/-destination "\$TEST_DESTINATION"[\s\S]*-derivedDataPath "\$DERIVED_DATA_PATH"[\s\S]*test/);
  });
});
