import { describe, expect, it } from "vitest";
import { getRepeatTagBase, summarizeRepeatTags } from "@/app/(app)/items/new-item-sheet/repeat-tags";

describe("Add item repeat tag helper", () => {
  it("uses the typed tag family as the repeat base", () => {
    expect(getRepeatTagBase(" FX3 2 ")).toBe("FX3");
    expect(getRepeatTagBase("FX3")).toBe("FX3");
    expect(getRepeatTagBase(" Sony FX3 12 ")).toBe("Sony FX3");
  });

  it("counts exact family tags and suggests the next numeric suffix", () => {
    const summary = summarizeRepeatTags("FX3 2", [
      { assetTag: "FX3" },
      { assetTag: "FX3 2" },
      { assetTag: "FX30" },
      { assetTag: "FX3 cage" },
    ]);

    expect(summary).toMatchObject({
      base: "FX3",
      existingCount: 2,
      nextTag: "FX3 3",
      matchedTags: ["FX3", "FX3 2"],
    });
  });

  it("uses the highest existing suffix when a number is skipped", () => {
    const summary = summarizeRepeatTags("FX3", [
      { assetTag: "FX3 4" },
      { assetTag: "FX3 2" },
    ]);

    expect(summary?.existingCount).toBe(2);
    expect(summary?.nextTag).toBe("FX3 5");
  });
});
