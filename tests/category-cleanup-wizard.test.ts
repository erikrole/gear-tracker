import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("category cleanup wizard", () => {
  it("keeps missing-category cleanup grounded in inventory suggestions before fallback heuristics", () => {
    const assetRoute = readFileSync("src/app/api/assets/route.ts", "utf8");
    const wizard = readFileSync("src/app/(app)/items/gap-wizard-dialog.tsx", "utf8");

    expect(assetRoute).toContain("suggestedCategoryId");
    expect(assetRoute).toContain("buildCategorySuggestions");
    expect(assetRoute).toContain("categoryIdByLegacyName");
    expect(assetRoute).toContain("where: { categoryId: { not: null } }");

    expect(wizard).toContain("currentItem.suggestedCategoryId === id");
    expect(wizard).toContain("Similar categorized items");
    expect(wizard).toContain("categoryKeywordScore");
    expect(wizard).toContain("CATEGORY_KEYWORD_RULES");
  });
});
