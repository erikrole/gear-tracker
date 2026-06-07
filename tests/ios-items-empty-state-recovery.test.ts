import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function source(relativeFile: string) {
  return readFileSync(path.join(process.cwd(), relativeFile), "utf8");
}

describe("iOS Items empty state recovery", () => {
  it("keeps filtered no-result states actionable", () => {
    const itemsView = source("ios/Wisconsin/Views/ItemsView.swift");

    expect(itemsView).toContain("emptyStateActions");
    expect(itemsView).toContain('Label("Clear search", systemImage: "xmark.circle")');
    expect(itemsView).toContain('Label("Show all items", systemImage: "archivebox")');
  });

  it("reloads the Items list after recovery actions", () => {
    const itemsView = source("ios/Wisconsin/Views/ItemsView.swift");

    expect(itemsView).toContain('vm.searchText = ""');
    expect(itemsView).toContain("vm.favoritesOnly = false");
    expect(itemsView.match(/Task \{ await vm\.load\(reset: true\) \}/g)?.length).toBeGreaterThanOrEqual(2);
  });
});
