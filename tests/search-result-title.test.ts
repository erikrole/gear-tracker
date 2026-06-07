import { describe, expect, it } from "vitest";
import { assetSearchTitle } from "@/lib/search-result-title";

describe("assetSearchTitle", () => {
  it("keeps asset tags as the preferred item identity", () => {
    expect(assetSearchTitle({
      assetTag: "CAM-001",
      name: "Primary camera",
      brand: "Sony",
      model: "FX3",
      type: "Camera",
    })).toBe("CAM-001");
  });

  it("falls back to item name when an asset tag is missing", () => {
    expect(assetSearchTitle({ name: "Primary camera", brand: "Sony", model: "FX3" })).toBe("Primary camera");
  });

  it("falls back to brand and model when tag and name are missing", () => {
    expect(assetSearchTitle({ brand: "Sony", model: "FX3", type: "Camera" })).toBe("Sony · FX3");
  });

  it("falls back to type when product identity fields are missing", () => {
    expect(assetSearchTitle({ type: "Camera" })).toBe("Camera");
  });

  it("returns a stable placeholder only when no item identity is available", () => {
    expect(assetSearchTitle({})).toBe("Untitled item");
  });
});
