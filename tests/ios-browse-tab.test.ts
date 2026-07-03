import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function source(relativeFile: string) {
  return readFileSync(path.join(process.cwd(), relativeFile), "utf8");
}

function appTabViewShell() {
  return source("ios/Wisconsin/Views/AppTabView.swift").split("// MARK: - Profile")[0] ?? "";
}

describe("iOS More tab", () => {
  it("uses a native More tab instead of burying Items as its own compact tab", () => {
    const appTab = appTabViewShell();

    const homeIndex = appTab.indexOf('Tab("Home", systemImage: "house", value: 0)');
    const scheduleIndex = appTab.indexOf('Tab("Schedule", systemImage: "calendar", value: 4)');
    const bookingsIndex = appTab.indexOf("Tab(gearTabLabel, systemImage: \"calendar.badge.checkmark\", value: 1)");
    const moreIndex = appTab.indexOf('Tab("More", systemImage: "ellipsis.circle", value: 2)');
    const searchIndex = appTab.indexOf('Tab("Search", systemImage: "magnifyingglass", value: 3, role: .search)');

    expect([homeIndex, scheduleIndex, bookingsIndex, moreIndex, searchIndex].every((index) => index >= 0)).toBe(true);
    expect(homeIndex).toBeLessThan(scheduleIndex);
    expect(scheduleIndex).toBeLessThan(bookingsIndex);
    expect(bookingsIndex).toBeLessThan(moreIndex);
    expect(moreIndex).toBeLessThan(searchIndex);
    expect(appTab).toContain("BrowseView()");
    expect(appTab).not.toContain('Tab("Browse", systemImage: "square.grid.2x2", value: 2)');
    expect(appTab).not.toContain('Tab("Items", systemImage: "archivebox", value: 2)');
    expect(appTab).toContain('Tab("Search", systemImage: "magnifyingglass", value: 3, role: .search)');
    expect(appTab).toContain(".tabPlacement(.pinned)");
  });

  it("renders More as a native SwiftUI list of directory links", () => {
    const browse = source("ios/Wisconsin/Views/BrowseView.swift");

    expect(browse).toContain("NavigationStack {");
    expect(browse).toContain("List {");
    expect(browse).toContain(".listStyle(.insetGrouped)");
    expect(browse).toContain('.navigationTitle("More")');
    expect(browse).not.toContain('Text("More")');
    expect(browse).not.toContain('Text("Browse")');
    expect(browse).toContain("NavigationLink {");
    expect(browse).toContain("SettingsMenuRow(");
    expect(browse).toContain("ItemsView()");
    expect(browse).toContain("GuidesView(wrapsInNavigationStack: false)");
    expect(browse).toContain("LicensesView(wrapsInNavigationStack: false)");
    expect(browse).toContain("UsersView()");
    expect(browse).not.toContain("SidebarWebDestinationView");
  });

  it("exposes Users to every authenticated role while preserving admin-only tools elsewhere", () => {
    const appTab = appTabViewShell();
    const profile = source("ios/Wisconsin/Views/ProfileView.swift");
    const directorySection = profile.slice(
      profile.indexOf("private var directorySection"),
      profile.indexOf("private var toolsSection"),
    );

    expect(appTab).toContain('TabSection("Resources")');
    expect(appTab).toContain('Tab("Users", systemImage: "person.2", value: 5)');
    expect(appTab).not.toContain('TabSection("Admin")');
    expect(appTab).not.toMatch(/if isStaffOrAdmin \{[\s\S]*?Tab\("Users"/);

    expect(directorySection).toContain('title: "Users"');
    expect(directorySection).toContain("UsersView()");
    expect(directorySection).not.toContain("if isStaffOrAdmin");
    expect(profile).toContain("if isStaffOrAdmin { toolsSection }");
  });
});
