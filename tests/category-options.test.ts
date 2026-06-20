import { describe, expect, it } from "vitest";
import { buildCategoryPathOptions } from "@/lib/category-options";

describe("buildCategoryPathOptions", () => {
  it("includes parents with children and deeply nested categories as selectable path options", () => {
    const options = buildCategoryPathOptions([
      { id: "camera", name: "Camera", parentId: null },
      { id: "lens", name: "Lens", parentId: "camera" },
      { id: "prime", name: "Prime", parentId: "lens" },
      { id: "audio", name: "Audio", parentId: null },
    ]);

    expect(options).toEqual([
      { value: "audio", label: "Audio", keywords: ["Audio"] },
      { value: "camera", label: "Camera", keywords: ["Camera"] },
      { value: "lens", label: "Camera / Lens", keywords: ["Lens"] },
      { value: "prime", label: "Camera / Lens / Prime", keywords: ["Prime"] },
    ]);
  });
});
