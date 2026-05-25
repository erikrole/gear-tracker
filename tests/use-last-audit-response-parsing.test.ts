import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("useLastAudit response parsing", () => {
  it("uses safe JSON parsing for decorative settings audit hints", () => {
    const source = readFileSync("src/hooks/use-last-audit.ts", "utf8");

    expect(source).toContain("parseJsonSafely");
    expect(source).toContain("isLastAuditMap");
    expect(source).not.toMatch(/res\.json\(/);
    expect(source).not.toContain(".json().catch");
  });
});
