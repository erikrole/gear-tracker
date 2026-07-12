import { describe, expect, it } from "vitest";
import { isOptimizableAssetImageSrc, normalizeAssetImageSrc } from "@/lib/asset-image";

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

describe("isOptimizableAssetImageSrc", () => {
  it("optimizes only blob-hosted images (the next.config remotePatterns allowlist)", () => {
    expect(isOptimizableAssetImageSrc("https://abc123.public.blob.vercel-storage.com/assets/a1/1.jpg")).toBe(true);
    expect(isOptimizableAssetImageSrc("https://static.bhphoto.com/images/item.jpg")).toBe(false);
    expect(isOptimizableAssetImageSrc("https://example.com/item.jpg")).toBe(false);
  });

  it("rejects lookalike hosts and unparseable sources", () => {
    expect(isOptimizableAssetImageSrc("https://public.blob.vercel-storage.com.evil.com/x.jpg")).toBe(false);
    expect(isOptimizableAssetImageSrc("not a url")).toBe(false);
    expect(isOptimizableAssetImageSrc("")).toBe(false);
  });
});
