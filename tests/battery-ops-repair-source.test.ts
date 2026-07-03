import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(path, "utf8");
}

describe("Battery Ops stale repair source contract", () => {
  it("explicitly applies the dry-run-first repair route from the confirmed action", () => {
    const sourceText = source("src/app/(app)/bulk-inventory/batteries/page.tsx");

    expect(sourceText).toContain('fetch("/api/bulk-skus/batteries/repair-stale"');
    expect(sourceText).toContain("JSON.stringify({ reason, dryRun: false })");
  });
});
