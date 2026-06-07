import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function source(relativeFile: string) {
  return readFileSync(path.join(process.cwd(), relativeFile), "utf8");
}

describe("iOS Items favorite recovery", () => {
  it("keeps optimistic rollback visible when favorite updates fail", () => {
    const itemsView = source("ios/Wisconsin/Views/ItemsView.swift");

    expect(itemsView).toContain("func toggleFavorite(_ asset: Asset) async throws");
    expect(itemsView).toContain("applyFavorite(assetId: asset.id, value: asset.isFavorited)");
    expect(itemsView).toContain("throw error");
    expect(itemsView).toContain("@State private var toast: Toast?");
    expect(itemsView).toContain("private func toggleFavorite(_ asset: Asset) async");
    expect(itemsView).toContain("try await vm.toggleFavorite(asset)");
    expect(itemsView).toContain('Toast(message: "Couldn\'t update favorite", icon: "exclamationmark.triangle.fill", role: .error)');
    expect(itemsView).toContain(".toast($toast)");
  });
});
