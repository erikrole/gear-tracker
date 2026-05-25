import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("SaveableField accessibility", () => {
  it("names dirty-row save and cancel actions with the field label", () => {
    const source = readFileSync("src/components/SaveableField.tsx", "utf8");

    expect(source).toContain("aria-label={`Save ${label}`}");
    expect(source).toContain("aria-label={`Cancel ${label}`}");
    expect(source).not.toContain('aria-label="Save"');
    expect(source).not.toContain('aria-label="Cancel"');
  });
});
