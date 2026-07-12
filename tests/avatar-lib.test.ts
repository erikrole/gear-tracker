import { describe, expect, it } from "vitest";

import { avatarColorClass, getInitials } from "@/lib/avatar";
import { imageExtensionForType } from "@/lib/blob";

describe("getInitials", () => {
  it("takes the first letter of the first two words", () => {
    expect(getInitials("Ben Snyder")).toBe("BS");
    expect(getInitials("Mary Jane Watson")).toBe("MJ");
  });

  it("handles single names, extra spaces, and empty input", () => {
    expect(getInitials("Cher")).toBe("C");
    expect(getInitials("  Ben   Snyder  ")).toBe("BS");
    expect(getInitials("")).toBe("");
    expect(getInitials("   ")).toBe("");
  });
});

describe("avatarColorClass", () => {
  it("is deterministic for the same seed", () => {
    expect(avatarColorClass("Ben Snyder")).toBe(avatarColorClass("Ben Snyder"));
  });

  it("always returns a paired bg/text class, even for edge seeds", () => {
    for (const seed of ["", "a", "Ben Snyder", "Ω≈ç√∫", "x".repeat(300)]) {
      const cls = avatarColorClass(seed);
      expect(cls).toMatch(/bg-/);
      expect(cls).toMatch(/text-/);
    }
  });
});

describe("imageExtensionForType", () => {
  it("maps each accepted upload type to its canonical extension", () => {
    expect(imageExtensionForType("image/jpeg")).toBe("jpg");
    expect(imageExtensionForType("image/png")).toBe("png");
    expect(imageExtensionForType("image/webp")).toBe("webp");
    expect(imageExtensionForType("image/gif")).toBe("gif");
  });

  it("falls back to jpg for anything unexpected", () => {
    expect(imageExtensionForType("image/svg+xml")).toBe("jpg");
    expect(imageExtensionForType("")).toBe("jpg");
  });
});
