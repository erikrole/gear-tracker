import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function source(relativeFile: string) {
  return readFileSync(path.join(process.cwd(), relativeFile), "utf8");
}

function appTabViewShell() {
  return source("ios/Wisconsin/Views/AppTabView.swift").split("// MARK: - Profile")[0];
}

describe("iOS tab bar stability", () => {
  it("uses stable UITabBar-backed tab items for the primary app shell", () => {
    const appTab = appTabViewShell();

    expect(appTab).toContain("TabView(selection:");
    expect(appTab).toContain(".tabItem { Label(\"Schedule\", systemImage: \"calendar\") }");
    expect(appTab).toContain(".tag(4)");
    expect(appTab).toContain(".tabItem { Label(\"Scan\", systemImage: \"barcode.viewfinder\") }");
    expect(appTab).not.toContain("Tab(\"Schedule\"");
    expect(appTab).not.toContain("role: .search");
    expect(appTab).not.toContain(".tabBarMinimizeBehavior(");
  });

  it("guards role changes away from the staff-only Users tab", () => {
    const appTab = appTabViewShell();

    expect(appTab).toContain(".onChange(of: isStaffOrAdmin)");
    expect(appTab).toContain("if !canSeeUsers && appState.selectedTab == 5");
    expect(appTab).toContain("appState.selectedTab = 0");
  });
});
