import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("AssetImage shadcn avatar contracts", () => {
  const source = readFileSync("src/components/AssetImage.tsx", "utf8");

  it("imports from @/components/ui/avatar", () => {
    expect(source).toContain("@/components/ui/avatar");
  });

  it("uses Avatar component", () => {
    expect(source).toContain("Avatar");
  });

  it("uses AvatarImage component", () => {
    expect(source).toContain("AvatarImage");
  });

  it("uses AvatarFallback component", () => {
    expect(source).toContain("AvatarFallback");
  });

  it("no longer imports next/image", () => {
    expect(source).not.toContain("next/image");
  });

  it("still imports normalizeAssetImageSrc", () => {
    expect(source).toContain("normalizeAssetImageSrc");
  });
});
