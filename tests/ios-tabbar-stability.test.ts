import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function source(relativeFile: string) {
  return readFileSync(path.join(process.cwd(), relativeFile), "utf8");
}

function appTabViewShell() {
  return source("ios/Wisconsin/Views/AppTabView.swift").split("// MARK: - Profile")[0] ?? "";
}

describe("iOS tab bar stability", () => {
  it("uses the native SwiftUI Tab API for the primary app shell", () => {
    const appTab = appTabViewShell();

    expect(appTab).toContain("TabView(selection:");
    expect(appTab).toContain('Tab("Home", systemImage: "house", value: 0)');
    expect(appTab).toContain('Tab("Items", systemImage: "archivebox", value: 2)');
    expect(appTab).toContain('Tab("Schedule", systemImage: "calendar", value: 4)');
    expect(appTab).toContain('Tab("Scan", systemImage: "barcode.viewfinder", value: 3, role: .search)');
    expect(appTab).toContain(".tabPlacement(.pinned)");
    expect(appTab).toContain("AppTabShellStyle(usesSidebarAdaptableStyle: showsSidebarDestinations)");
    expect(appTab).toContain("content.tabViewStyle(.tabBarOnly)");
    expect(appTab).toContain("content.tabViewStyle(.sidebarAdaptable)");
    expect(appTab).toContain("private var showsSidebarDestinations: Bool");
    expect(appTab).toContain("horizontalSizeClass == .regular");
    expect(appTab).toContain('TabSection("Resources")');
    expect(appTab).toContain('Tab("Guides", systemImage: "book.closed", value: 6)');
    expect(appTab).toContain('TabSection("Admin")');
    expect(appTab).toContain('Tab("Users", systemImage: "person.2", value: 5)');
    expect(appTab).toContain('Tab("Licenses", systemImage: "key", value: 7)');
    expect(appTab.match(/\.tabPlacement\(\.sidebarOnly\)/g)).toHaveLength(3);
    expect(appTab).not.toContain(".tabItem");
    expect(appTab).not.toContain(".tag(");
    expect(appTab).not.toContain(".toolbar(.hidden, for: .tabBar)");
    expect(appTab).not.toContain(".tabBarMinimizeBehavior(");
  });

  it("renders scan through the native trailing search tab role, not a custom overlay", () => {
    const appTab = appTabViewShell();
    const appState = source("ios/Wisconsin/Core/AppState.swift");
    const home = source("ios/Wisconsin/Views/HomeView.swift");
    const scan = source("ios/Wisconsin/Views/ScanView.swift");

    expect(appTab).toContain("role: .search");
    expect(appTab).not.toContain("private struct AppTabBar");
    expect(appTab).not.toContain("private var scanTabButton");
    expect(appTab).not.toContain(".safeAreaInset(edge: .bottom");
    expect(appTab).not.toContain(".fullScreenCover(isPresented: $showScanLookup)");
    expect(appTab).not.toContain(".overlay(alignment: .bottomTrailing)");
    expect(appState).toContain("func presentScanLookup()");
    expect(appState).toContain("selectTab(3)");
    expect(home).toContain("AllClearEmptyState(openScan: { appState.presentScanLookup() })");
    expect(home).not.toContain("appState.selectedTab = 3");
    expect(scan).not.toContain("showsDismissButton");
    expect(scan).not.toContain("Button(\"Done\") { dismiss() }");
  });

  it("keeps secondary sidebar destinations out of the compact tab shell", () => {
    const appTab = appTabViewShell();

    expect(appTab).toContain("if showsSidebarDestinations {");
    expect(appTab).toContain("selectedTabIsSidebarOnly");
    expect(appTab).toContain("!showsSidebarDestinations && selectedTabIsSidebarOnly");
    expect(appTab).toContain("appState.selectedTab = 0");
  });

  it("uses lightweight web fallbacks only for sidebar destinations without native iOS screens", () => {
    const sidebarDestination = source("ios/Wisconsin/Views/SidebarWebDestinationView.swift");
    const appTab = appTabViewShell();

    expect(sidebarDestination).toContain("ContentUnavailableView");
    expect(sidebarDestination).toContain("var wrapsInNavigationStack = true");
    expect(sidebarDestination).toContain('Link("Open on web", destination: destination)');
    expect(appTab).toContain("https://gear.erikrole.com/resources");
    expect(appTab).toContain("https://gear.erikrole.com/licenses");
  });
});
