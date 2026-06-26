import { describe, expect, it } from "vitest";
import { compareItemAssetTags, getItemAssetTagSortKey } from "@/lib/item-asset-tag-sort";

describe("item asset tag sorting", () => {
  it("uses the equipment family instead of operational prefixes", () => {
    expect(getItemAssetTagSortKey("FB 70-200 1")).toBe("70-200 1");
    expect(getItemAssetTagSortKey("MBB 28-75 1")).toBe("28-75 1");
    expect(getItemAssetTagSortKey("FB A7 V 1")).toBe("A7 V 1");
    expect(getItemAssetTagSortKey("FB Wireless Flash")).toBe("Wireless Flash");
    expect(getItemAssetTagSortKey("FX6 2")).toBe("FX6 2");
    expect(getItemAssetTagSortKey("70200 4")).toBe("70-200 4");
    expect(getItemAssetTagSortKey("100400 2")).toBe("100-400 2");
  });

  it("does not strip broad words unless the remainder is a known equipment tag", () => {
    expect(getItemAssetTagSortKey("Video Assist 1")).toBe("Video Assist 1");
    expect(getItemAssetTagSortKey("Photo Printer 1")).toBe("Photo Printer 1");
    expect(getItemAssetTagSortKey("Video FX6 1")).toBe("FX6 1");
    expect(getItemAssetTagSortKey("Creative 70-200 1")).toBe("70-200 1");
  });

  it("sorts prefixed department/team rows with their asset-tag family", () => {
    const tags = [
      "FX6 1",
      "FB 70-200 2",
      "FX3 2",
      "MBB 28-75 1",
      "70-200 1",
      "FB 16-35 1",
      "MBB 70-180 1",
      "FB FX3 1",
    ];

    expect(tags.sort(compareItemAssetTags)).toEqual([
      "FB 16-35 1",
      "MBB 28-75 1",
      "MBB 70-180 1",
      "70-200 1",
      "FB 70-200 2",
      "FX3 2",
      "FB FX3 1",
      "FX6 1",
    ]);
  });

  it("groups operational prefixes inside the same equipment family", () => {
    const tags = [
      "FB 70-200 3",
      "70-200 3",
      "FB 70-200 1",
      "70-200 1",
      "100-400 1",
      "FB 70-200 2",
      "70200 4",
      "70-200 2",
    ];

    expect(tags.sort(compareItemAssetTags)).toEqual([
      "70-200 1",
      "70-200 2",
      "70-200 3",
      "70200 4",
      "FB 70-200 1",
      "FB 70-200 2",
      "FB 70-200 3",
      "100-400 1",
    ]);
  });

  it("keeps broad-word false positives in their own natural position", () => {
    const tags = ["FX6 1", "Video Assist 1", "Video FX6 2", "FB FX6 3"];

    expect(tags.sort(compareItemAssetTags)).toEqual([
      "FX6 1",
      "Video FX6 2",
      "FB FX6 3",
      "Video Assist 1",
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
