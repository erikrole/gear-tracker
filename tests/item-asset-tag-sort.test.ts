import { describe, expect, it } from "vitest";
import { compareItemAssetTags, getItemAssetTagSortKey } from "@/lib/item-asset-tag-sort";

describe("item asset tag sorting", () => {
  it("uses the equipment family instead of operational prefixes", () => {
    expect(getItemAssetTagSortKey("FB 70-200 1")).toBe("70-200 1");
    expect(getItemAssetTagSortKey("MBB 28-75 1")).toBe("28-75 1");
    expect(getItemAssetTagSortKey("FX6 2")).toBe("FX6 2");
  });

  it("sorts prefixed department/team rows with their asset-tag family", () => {
    const tags = [
      "FX6 1",
      "FB 70-200 2",
      "FX3 2",
      "MBB 28-75 1",
      "70-200 1",
      "FB 16-35 1",
      "FB FX3 1",
    ];

    expect(tags.sort(compareItemAssetTags)).toEqual([
      "FB 16-35 1",
      "MBB 28-75 1",
      "70-200 1",
      "FB 70-200 2",
      "FB FX3 1",
      "FX3 2",
      "FX6 1",
    ]);
  });

  it("keeps numeric suffixes in natural order", () => {
    const tags = ["FX3 10", "FX3 2", "FX3 1", "FX6 1", "FX3"];

    expect(tags.sort(compareItemAssetTags)).toEqual([
      "FX3",
      "FX3 1",
      "FX3 2",
      "FX3 10",
      "FX6 1",
    ]);
  });

  it("handles hyphenated repeated family names", () => {
    const tags = [
      "Dell Single Monitor Arm-5",
      "Dell Single Monitor Arm",
      "Dell Single Monitor Arm-2",
    ];

    expect(tags.sort(compareItemAssetTags)).toEqual([
      "Dell Single Monitor Arm",
      "Dell Single Monitor Arm-2",
      "Dell Single Monitor Arm-5",
    ]);
  });
});
