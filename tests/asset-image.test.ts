import { describe, expect, it } from "vitest";
import { normalizeAssetImageSrc } from "@/lib/asset-image";

describe("normalizeAssetImageSrc", () => {
  it("returns null for empty image sources", () => {
    expect(normalizeAssetImageSrc(null)).toBeNull();
    expect(normalizeAssetImageSrc(undefined)).toBeNull();
    expect(normalizeAssetImageSrc("   ")).toBeNull();
  });

  it("trims stored item image URLs", () => {
    expect(normalizeAssetImageSrc("  https://example.com/item.jpg  ")).toBe(
      "https://example.com/item.jpg",
    );
  });

  it("normalizes legacy http item image URLs to https for the app CSP", () => {
    expect(normalizeAssetImageSrc("http://example.com/item.jpg")).toBe(
      "https://example.com/item.jpg",
    );
  });
});
