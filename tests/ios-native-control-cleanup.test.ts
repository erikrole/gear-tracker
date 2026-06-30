import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function source(relativeFile: string) {
  return readFileSync(path.join(process.cwd(), relativeFile), "utf8");
}

function sliceBetween(sourceText: string, start: string, end: string) {
  const startIndex = sourceText.indexOf(start);
  const endIndex = sourceText.indexOf(end, startIndex);
  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);
  return sourceText.slice(startIndex, endIndex);
}

describe("iOS native control cleanup", () => {
  it("uses native SwiftUI search and toolbar scanner in global search", () => {
    const search = source("ios/Wisconsin/Views/Search/GlobalSearchSheet.swift");

    expect(search).toContain(".searchable(");
    expect(search).toContain("var showsCancelButton = true");
    expect(search).toContain("if showsCancelButton");
    expect(search).toContain("text: $query");
    expect(search).toContain("placement: .navigationBarDrawer(displayMode: .always)");
    expect(search).toContain('prompt: Text("Search items, bookings, people")');
    expect(search).toContain(".onSubmit(of: .search) { commitSearch() }");
    expect(search).toContain('Label("Scan QR code", systemImage: "qrcode.viewfinder")');
    expect(search).not.toContain("@FocusState private var fieldFocused");
    expect(search).not.toContain("private var searchBar");
    expect(search).not.toContain('TextField("Search items, bookings, people');
  });

  it("keeps Items search native and moves filters into toolbar menus", () => {
    const items = source("ios/Wisconsin/Views/ItemsView.swift");

    expect(items).toContain(".searchable(text: $vm.searchText");
    expect(items).toContain("ToolbarItemGroup(placement: .topBarTrailing)");
    expect(items).toContain('Label("Favorites", systemImage: vm.favoritesOnly ? "star.fill" : "star")');
    expect(items).toContain("AssetStatusFilterMenu(selected: $vm.selectedStatuses)");
    expect(items).toContain("ItemSortMenu(selected: $vm.sortOption)");
    expect(items).not.toContain("private var itemsControlStrip");
    expect(items).not.toContain("private struct ItemControlPill");
    expect(items).not.toContain("ScrollView(.horizontal, showsIndicators: false)");
  });

  it("uses native searchable for equipment search in Create Booking", () => {
    const sheet = source("ios/Wisconsin/Views/CreateBookingSheet.swift");
    const picker = sliceBetween(
      sheet,
      "private var equipmentPicker: some View",
      "private var reviewStep: some View",
    );

    expect(picker).toContain(".searchable(");
    expect(picker).toContain("text: $vm.assetSearch");
    expect(picker).toContain("placement: .navigationBarDrawer(displayMode: .always)");
    expect(picker).toContain('prompt: Text("Search equipment")');
    expect(picker).toContain('Label("Scan equipment", systemImage: "barcode.viewfinder")');
    expect(picker).not.toContain('TextField("Search equipment');
  });

  it("uses native bordered booking detail actions instead of glass buttons", () => {
    const booking = source("ios/Wisconsin/Views/BookingDetailView.swift");
    const actions = sliceBetween(
      booking,
      "private struct ActionsSection",
      "private struct SectionHeader",
    );

    expect(actions).not.toContain(".buttonStyle(.glass)");
    expect(actions).toMatch(/Label\("Extend Return Date"[\s\S]*?\.buttonStyle\(\.borderedProminent\)[\s\S]*?\.buttonBorderShape\(\.capsule\)[\s\S]*?\.controlSize\(\.large\)/);
    expect(actions).toMatch(/Label\("Cancel Booking"[\s\S]*?\.buttonStyle\(\.bordered\)[\s\S]*?\.buttonBorderShape\(\.capsule\)[\s\S]*?\.controlSize\(\.large\)/);
  });
});
