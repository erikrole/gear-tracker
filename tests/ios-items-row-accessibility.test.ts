import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function source(relativeFile: string) {
  return readFileSync(path.join(process.cwd(), relativeFile), "utf8");
}

describe("iOS Items row accessibility", () => {
  it("keeps item rows combined and announces the detail navigation action", () => {
    const itemsView = source("ios/Wisconsin/Views/ItemsView.swift");

    expect(itemsView).toContain(".accessibilityElement(children: .combine)");
    expect(itemsView).toContain(".accessibilityLabel(rowAccessibilityLabel)");
    expect(itemsView).toContain('.accessibilityHint("Double-tap to view item details")');
  });
});
