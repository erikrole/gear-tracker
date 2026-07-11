import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function source(relativeFile: string) {
  return readFileSync(path.join(process.cwd(), relativeFile), "utf8");
}

function appTabViewShell() {
  return source("ios/Wisconsin/Views/AppTabView.swift").split("// MARK: - Profile")[0] ?? "";
}

function guidesClientFunction(apiClient: string) {
  const match = apiClient.match(/func guides\([\s\S]*?\n    }\n/);
  return match?.[0] ?? "";
}

describe("iOS native Guides page", () => {
  it("uses the existing read-only Resources API contract", () => {
    const apiClient = source("ios/Wisconsin/Core/APIClient.swift");
    const guidesClient = guidesClientFunction(apiClient);
    const models = source("ios/Wisconsin/Models/Models.swift");
    const listRoute = source("src/app/api/resources/route.ts");
    const detailRoute = source("src/app/api/resources/[id]/route.ts");

    expect(guidesClient).toContain("func guides(search: String? = nil, category: String? = nil) async throws -> [GuideListItem]");
    expect(guidesClient).toContain('request(path: "/api/resources", queryItems: items)');
    expect(guidesClient).not.toContain('request(path: "/api/resources/upload-image"');
    expect(guidesClient).not.toContain('method: "POST")');

    expect(models).toContain("enum ResourceType: String, Codable");
    expect(models).toContain("struct GuideListItem: Codable, Identifiable, Hashable");
    expect(models).toContain("markdown = try container.decodeIfPresent(String.self, forKey: .markdown) ?? \"\"");
    expect(models).toContain("targetRoles = try container.decodeIfPresent([String].self, forKey: .targetRoles) ?? []");
    expect(models).toContain("targetAreas = try container.decodeIfPresent([String].self, forKey: .targetAreas) ?? []");
    expect(models).toContain("published = try container.decodeIfPresent(Bool.self, forKey: .published) ?? true");

    expect(listRoute).toContain('const published = user.role === Role.STUDENT ? true : undefined;');
    expect(listRoute).toContain("const guides = await listGuides({ published, category, search, audience });");
    expect(detailRoute).toContain("if (user.role === Role.STUDENT && !guide.published)");
  });

  it("renders Guides with native SwiftUI list, search, refresh, and reader patterns", () => {
    const view = source("ios/Wisconsin/Views/GuidesView.swift");

    expect(view).toContain("NavigationStack { configuredContent }");
    expect(view).toContain("List {");
    expect(view).toContain(".listStyle(.insetGrouped)");
    expect(view).toContain(".searchable(");
    expect(view).toContain("prompt: Text(\"Search guides\")");
    expect(view).toContain(".refreshable { await vm.load(forceRefresh: true) }");
    expect(view).toContain("ContentUnavailableView");
    expect(view).toContain("NavigationLink {");
    expect(view).toContain("GuideReaderView(guide: guide)");
    expect(view).toContain("NativeMarkdownArticle(markdown: guide.markdown)");
    expect(view).toContain("AttributedString(markdown: markdown");
    expect(view).not.toContain("Edit");
    expect(view).not.toContain("markVerified");
    expect(view).not.toContain("upload-image");
  });

  it("wires native Guides into Settings and the regular-width Resources sidebar", () => {
    const appTab = appTabViewShell();
    const browse = source("ios/Wisconsin/Views/BrowseView.swift");

    expect(appTab).toContain('Tab("Browse", systemImage: "square.grid.2x2", value: 2)');
    expect(appTab).toContain("BrowseView()");
    expect(browse).toContain("GuidesView(wrapsInNavigationStack: false)");
    expect(appTab).toContain('Tab("Guides", systemImage: "book.closed", value: 6)');
    expect(appTab).toContain("GuidesView()");
    expect(appTab).not.toContain("https://wisconsincreative.com/resources");
    expect(browse).toContain("GuidesView(wrapsInNavigationStack: false)");
  });

  it("keeps Settings Directory as a compact fallback for Guides", () => {
    const appTab = appTabViewShell();
    const browse = source("ios/Wisconsin/Views/BrowseView.swift");

    expect(appTab).toContain('Tab("Browse", systemImage: "square.grid.2x2", value: 2)');
    expect(appTab).toContain("if showsSidebarDestinations {");
    expect(appTab).toContain(".tabPlacement(.sidebarOnly)");
    expect(browse).toContain("GuidesView(wrapsInNavigationStack: false)");
  });
});
