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

  it("suggests the strongest matching family while the operator is still typing", () => {
    const summary = summarizeRepeatTags("F", [
      { assetTag: "FX3" },
      { assetTag: "FX3 2" },
      { assetTag: "FX30" },
      { assetTag: "FX30 2" },
      { assetTag: "FS7" },
    ]);

    expect(summary).toMatchObject({
      base: "FX3",
      existingCount: 2,
      nextTag: "FX3 3",
    });
  });

  it("suggests the next tag when the operator types a base without a number", () => {
    const summary = summarizeRepeatTags("70-200", [
      { assetTag: "70-200 1" },
      { assetTag: "70-200 2" },
      { assetTag: "70-200 4" },
      { assetTag: "70 macro 1" },
    ]);

    expect(summary).toMatchObject({
      base: "70-200",
      existingCount: 3,
      nextTag: "70-200 5",
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

  it("returns no suggestion when the typed prefix has no matching family", () => {
    expect(summarizeRepeatTags("ZZ", [{ assetTag: "FX3" }])).toBeNull();
  });
});
