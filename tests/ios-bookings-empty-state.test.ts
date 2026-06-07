import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("iOS bookings empty state recovery", () => {
  const source = readFileSync("ios/Wisconsin/Views/BookingsView.swift", "utf8");

  it("keeps no-result states actionable", () => {
    expect(source).toContain('Label("Clear search", systemImage: "xmark.circle")');
    expect(source).toContain('Label("Show all visible bookings", systemImage: "person.2")');
    expect(source).toContain('Label("New Reservation", systemImage: "plus")');
  });

  it("reloads the booking list after recovery actions", () => {
    expect(source).toContain("vm.searchText = \"\"");
    expect(source).toContain("vm.mineOnly = false");
    expect(source.match(/Task \{ await vm\.load\(reset: true\) \}/g)?.length).toBeGreaterThanOrEqual(2);
  });
});
