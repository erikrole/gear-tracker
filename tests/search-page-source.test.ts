import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("full search page source", () => {
  it("does not render blank item result titles when item identity fields are sparse", () => {
    const source = readFileSync("src/app/(app)/search/page.tsx", "utf8");

    expect(source).toContain('import { assetSearchTitle } from "@/lib/search-result-title";');
    expect(source).toContain("title: assetSearchTitle(item)");
  });
});
