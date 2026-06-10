import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("app shell quick search source", () => {
  it("uses the shared item-title fallback for quick search results", () => {
    const source = readFileSync("src/components/AppShell.tsx", "utf8");

    expect(source).toContain('import { assetSearchTitle } from "@/lib/search-result-title";');
    expect(source).toContain("name?: string | null;");
    expect(source).toContain("brand?: string | null;");
    expect(source).toContain("model?: string | null;");
    expect(source).toContain("type?: string | null;");
    expect(source).toContain("title: assetSearchTitle(item)");
    expect(source).not.toContain('title: item.assetTag ?? "Untitled item"');
  });

  it("does not steal keyboard input from page-owned search fields", () => {
    const source = readFileSync("src/components/AppShell.tsx", "utf8");

    expect(source).toContain("function isKeyboardOwnedTarget");
    expect(source).toContain('"input"');
    expect(source).toContain('"textarea"');
    expect(source).toContain('"select"');
    expect(source).toContain("'[role=\"textbox\"]'");
    expect(source).toContain("'[role=\"searchbox\"]'");
    expect(source).toContain("if (e.defaultPrevented) return;");
    expect(source).toContain("isKeyboardOwnedTarget(e.target) || isKeyboardOwnedTarget(document.activeElement)");
  });
});
