import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function source(relativeFile: string) {
  return readFileSync(path.join(process.cwd(), relativeFile), "utf8");
}

function appTabViewShell() {
  return source("ios/Wisconsin/Views/AppTabView.swift").split("// MARK: - Profile")[0] ?? "";
}

describe("iOS native Licenses page", () => {
  it("uses the existing license API routes without inventing a native-only contract", () => {
    const apiClient = source("ios/Wisconsin/Core/APIClient.swift");
    const models = source("ios/Wisconsin/Models/Models.swift");
    const route = source("src/app/api/licenses/route.ts");

    expect(apiClient).toContain("func licenses() async throws -> [LicenseCode]");
    expect(apiClient).toContain('request(path: "/api/licenses")');
    expect(apiClient).toContain("func myLicense() async throws -> ActiveLicenseClaim?");
    expect(apiClient).toContain('request(path: "/api/licenses/my")');
    expect(apiClient).toContain("func claimLicense(id: String) async throws -> LicenseClaimResult");
    expect(apiClient).toContain('request(path: "/api/licenses/\\(id)/claim", method: "POST")');
    expect(apiClient).toContain("func releaseLicense(id: String) async throws -> LicenseCode");
    expect(apiClient).toContain('request(path: "/api/licenses/\\(id)/release", method: "POST")');
    expect(apiClient).toContain("req.httpBody = Data()");

    expect(models).toContain("enum LicenseCodeStatus");
    expect(models).toContain("struct LicenseCode: Codable, Identifiable, Equatable");
    expect(models).toContain("let expiresAt: String?");
    expect(models).toContain('code = try container.decodeIfPresent(String.self, forKey: .code) ?? ""');
    expect(models).toContain("claims = try container.decodeIfPresent([LicenseCodeClaim].self, forKey: .claims) ?? []");

    expect(route).toContain('const isAdmin = user.role === "ADMIN" || user.role === "STAFF"');
    expect(route).toContain("const isHolder = c.claims.some((claim) => claim.userId === user.id)");
    expect(route).toContain('code: isHolder ? c.code : ""');
    expect(route).toContain("claim.userId === user.id");
    expect(route).toContain("user: null");
  });

  it("wires Licenses to native Settings and regular-width sidebar destinations", () => {
    const appTab = appTabViewShell();
    const browse = source("ios/Wisconsin/Views/BrowseView.swift");
    const profile = source("ios/Wisconsin/Views/ProfileView.swift");

    expect(appTab).toContain('Tab("More", systemImage: "ellipsis.circle", value: 2)');
    expect(appTab).toContain("BrowseView()");
    expect(browse).toContain("LicensesView(wrapsInNavigationStack: false)");
    expect(appTab).toContain('Tab("Licenses", systemImage: "key", value: 7)');
    expect(appTab).toContain("LicensesView()");
    expect(appTab).not.toContain("https://wisconsincreative.com/licenses");
    expect(profile).toContain("LicensesView(wrapsInNavigationStack: false)");
    expect(profile).not.toMatch(/title: "Licenses"[\s\S]*?SidebarWebDestinationView/);
  });

  it("uses native list, refresh, empty, and confirmation patterns for self-service actions", () => {
    const view = source("ios/Wisconsin/Views/LicensesView.swift");

    expect(view).toContain("NavigationStack { configuredContent }");
    expect(view).toContain("List {");
    expect(view).toContain(".listStyle(.insetGrouped)");
    expect(view).toContain(".refreshable { await vm.load(forceRefresh: true) }");
    expect(view).toContain("ContentUnavailableView");
    expect(view).toContain('"Claim Photo Mechanic license?"');
    expect(view).toContain("isPresented: claimConfirmBinding");
    expect(view).toContain('"Return Photo Mechanic license?"');
    expect(view).toContain("UIPasteboard.general.string = result.code");
    expect(view).toContain("UIPasteboard.general.string = activeClaim.code");
  });

  it("only calls release from the active-license path, not from arbitrary pool rows", () => {
    const view = source("ios/Wisconsin/Views/LicensesView.swift");

    expect(view).toContain("func releaseActiveClaim()");
    expect(view).toContain("guard let activeClaim, pendingActionId == nil else { return }");
    expect(view).toContain("APIClient.shared.releaseLicense(id: activeClaim.id)");
    expect(view).not.toContain("releaseLicense(id: code.id)");
  });

  it("keeps the screenshot state visually coherent when the user already has a license", () => {
    const view = source("ios/Wisconsin/Views/LicensesView.swift");
    const activeButtons = view.slice(
      view.indexOf("private func activeLicenseButtons"),
      view.indexOf("private var licensePoolSection"),
    );

    expect(view).toContain("activeClaimId == nil && (code.status == .available || code.status == .partial)");
    expect(view).not.toContain('"Already claimed"');
    expect(activeButtons).toContain('Button("Copy Code")');
    expect(activeButtons).toContain('Button("Return License", role: .destructive)');
    expect(activeButtons).not.toContain('Label("Copy Code"');
    expect(activeButtons).not.toContain('Label("Return License"');
    expect(activeButtons).toMatch(/Button\("Copy Code"\)[\s\S]*?\.buttonStyle\(\.bordered\)[\s\S]*?\.buttonBorderShape\(\.capsule\)[\s\S]*?\.controlSize\(\.small\)[\s\S]*?\.tint\(Color\.statusText\(\.blue\)\)/);
    expect(activeButtons).toMatch(/Button\("Return License", role: \.destructive\)[\s\S]*?\.buttonStyle\(\.bordered\)[\s\S]*?\.buttonBorderShape\(\.capsule\)[\s\S]*?\.controlSize\(\.small\)/);
  });

  it("hides unclaimed pool codes from students even if a future payload includes them", () => {
    const view = source("ios/Wisconsin/Views/LicensesView.swift");

    expect(view).toContain("canRevealUnclaimedCodes: isStaffOrAdmin");
    expect(view).toContain("private var canRevealCode: Bool");
    expect(view).toContain("canRevealUnclaimedCodes || isCurrentHolder");
    expect(view).toContain('canRevealCode && !code.code.isEmpty ? code.code : "Code hidden until claimed"');
  });

  it("renders Claim as a positive action instead of the destructive app accent", () => {
    const view = source("ios/Wisconsin/Views/LicensesView.swift");
    const poolRow = view.slice(view.indexOf("private struct LicensePoolRow"));

    expect(view).toContain('Button("Claim License")');
    expect(view).toMatch(/Button\("Claim License"\)[\s\S]*?\.tint\(Color\.statusText\(\.green\)\)/);
    expect(poolRow).toMatch(/Button\("Claim"\)[\s\S]*?\.buttonStyle\(\.borderedProminent\)[\s\S]*?\.buttonBorderShape\(\.capsule\)[\s\S]*?\.controlSize\(\.small\)[\s\S]*?\.tint\(Color\.statusText\(\.green\)\)/);
    expect(poolRow).not.toContain('Label("Claim", systemImage: "plus.circle")');
  });

  it("keeps admin management on web while exposing self-service to every role", () => {
    const view = source("ios/Wisconsin/Views/LicensesView.swift");
    const profile = source("ios/Wisconsin/Views/ProfileView.swift");

    expect(view).toContain('private static let webManagementURL = AppEnvironment.url(path: "/licenses")');
    expect(view).toContain("if isStaffOrAdmin {");
    expect(view).toContain('title: "Manage on web"');
    expect(source("ios/Wisconsin/Views/BrowseView.swift")).toContain("LicensesView(wrapsInNavigationStack: false)");
    expect(profile).toMatch(/Section\("Directory"\)[\s\S]*NavigationLink \{\s*LicensesView\(wrapsInNavigationStack: false\)/);
    expect(profile).toContain('? "Claim, copy, return, or open web management."');
    expect(profile).toContain(': "Claim, copy, or return a Photo Mechanic license."');
  });
});
