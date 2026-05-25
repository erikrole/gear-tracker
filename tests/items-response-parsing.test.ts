import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const ITEM_CLIENT_FILES = [
  "src/app/(app)/items/page.tsx",
  "src/app/(app)/items/hooks/use-filter-options.ts",
  "src/app/(app)/items/[id]/_hooks/use-item-actions.ts",
  "src/app/(app)/items/[id]/_hooks/use-item-data.ts",
  "src/app/(app)/items/[id]/ItemHistoryTab.tsx",
  "src/app/(app)/items/[id]/ItemInsightsTab.tsx",
  "src/app/(app)/items/[id]/ItemSettingsTab.tsx",
  "src/app/(app)/items/gap-wizard-dialog.tsx",
  "src/app/(app)/items/hygiene/page.tsx",
];

describe("items client response parsing", () => {
  it("uses safe JSON parsing in item client fetch paths", () => {
    for (const file of ITEM_CLIENT_FILES) {
      const source = readFileSync(file, "utf8");

      expect(source, file).not.toMatch(/await\s+res\.json\(/);
      expect(source, file).not.toContain(".json().catch");
      expect(source, file).not.toMatch(/return\s+res\.json\(/);
    }
  });
});
