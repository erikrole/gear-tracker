import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function source(relativeFile: string) {
  return readFileSync(path.join(process.cwd(), relativeFile), "utf8");
}

function appTabViewShell() {
  return source("ios/Wisconsin/Views/AppTabView.swift").split("// MARK: - Profile")[0] ?? "";
}

describe("iOS Browse tab", () => {
  it("uses a native Browse tab instead of burying Items as its own compact tab", () => {
    const appTab = appTabViewShell();

    expect(appTab).toContain('Tab("Browse", systemImage: "square.grid.2x2", value: 2)');
    expect(appTab).toContain("BrowseView()");
    expect(appTab).not.toContain('Tab("Items", systemImage: "archivebox", value: 2)');
    expect(appTab).toContain('Tab("Search", systemImage: "magnifyingglass", value: 3, role: .search)');
    expect(appTab).toContain(".tabPlacement(.pinned)");
  });

  it("renders Browse as a native SwiftUI list of directory links", () => {
    const browse = source("ios/Wisconsin/Views/BrowseView.swift");

    expect(browse).toContain("NavigationStack {");
    expect(browse).toContain("List {");
    expect(browse).toContain(".listStyle(.insetGrouped)");
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
