import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("dashboard accessibility contracts", () => {
  it("names the icon-only refresh action", () => {
    const source = readFileSync("src/app/(app)/page.tsx", "utf8");

    expect(source).toContain('aria-label="Refresh dashboard"');
  });
});
