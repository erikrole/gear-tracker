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

describe("ItemThumbnailStack shadcn avatar contracts", () => {
  const source = readFileSync("src/components/ItemThumbnailStack.tsx", "utf8");

  it("imports AssetImage", () => {
    expect(source).toContain("AssetImage");
  });

  it("imports AvatarGroup from @/components/ui/avatar", () => {
    expect(source).toContain("AvatarGroup");
    expect(source).toContain("@/components/ui/avatar");
  });

  it("imports AvatarGroupCount from @/components/ui/avatar", () => {
    expect(source).toContain("AvatarGroupCount");
  });

  it("does not import normalizeAssetImageSrc", () => {
    expect(source).not.toContain("normalizeAssetImageSrc");
  });

  it("does not define function StackImage", () => {
    expect(source).not.toMatch(/function StackImage/);
  });
});

describe("BookingEquipmentTab thumbnail contracts", () => {
  const source = readFileSync("src/app/(app)/bookings/BookingEquipmentTab.tsx", "utf8");

  it("does not define function ItemThumbnail", () => {
    expect(source).not.toMatch(/function ItemThumbnail/);
  });

  it("does not import ImageIcon from lucide-react", () => {
    expect(source).not.toMatch(/ImageIcon/);
  });
});
