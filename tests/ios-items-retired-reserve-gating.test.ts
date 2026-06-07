import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function source(relativeFile: string) {
  return readFileSync(path.join(process.cwd(), relativeFile), "utf8");
}

describe("iOS Items retired reserve gating", () => {
  it("does not expose Reserve row actions for retired items", () => {
    const itemsView = source("ios/Wisconsin/Views/ItemsView.swift");

    const reserveGates = itemsView.match(/if asset\.computedStatus != \.retired/g) ?? [];
    expect(reserveGates.length).toBeGreaterThanOrEqual(2);
    expect(itemsView).toContain('Label("Reserve", systemImage: "plus.circle")');
    expect(itemsView).toContain(".swipeActions(edge: .trailing, allowsFullSwipe: false)");
    expect(itemsView).toContain(".contextMenu");
  });

  it("does not expose the detail Reserve button for retired items", () => {
    const itemDetailView = source("ios/Wisconsin/Views/ItemDetailView.swift");

    expect(itemDetailView).toContain("if asset.computedStatus != .retired");
    expect(itemDetailView).toContain("ReserveButton {");
    expect(itemDetailView).toContain("reserveAsset = asset.asAsset");
  });
});
