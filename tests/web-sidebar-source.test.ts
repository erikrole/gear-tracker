import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function source(relativeFile: string) {
  return readFileSync(path.join(process.cwd(), relativeFile), "utf8");
}

describe("web sidebar source contract", () => {
  it("keeps lookup in the web sidebar without turning app scan into custody scan", () => {
    const sidebar = source("src/components/Sidebar.tsx");

    expect(sidebar).toContain('{ label: "Lookup", href: "/scan", icon: ScanIcon, shortcut: "5" }');
    expect(sidebar).not.toContain("/scan?checkout");
  });

  it("keeps personal Settings reachable outside admin-only navigation", () => {
    const sidebar = source("src/components/Sidebar.tsx");
    const settingsIndex = sidebar.indexOf('{ label: "Settings", href: "/settings", icon: SettingsIcon }');
    const adminGroupIndex = sidebar.indexOf('label: "Admin"');

    expect(settingsIndex).toBeGreaterThan(-1);
    expect(adminGroupIndex).toBeGreaterThan(-1);
    expect(settingsIndex).toBeLessThan(adminGroupIndex);
  });

  it("uses user-scoped due-today counts and overdue-first badge priority", () => {
    const appShell = source("src/components/AppShell.tsx");
    const sidebar = source("src/components/Sidebar.tsx");

    expect(appShell).toContain("myDueTodayCount?: unknown");
    expect(appShell).toContain("setDueTodayBadgeCount(dueToday)");
    expect(sidebar).toContain("dueTodayBadgeCount?: number");
    expect(sidebar.indexOf("overdueBadgeCount > 0")).toBeLessThan(
      sidebar.indexOf("dueTodayBadgeCount > 0"),
    );
    expect(sidebar).toContain('suffix: "due today"');
    expect(sidebar).toContain("bg-[var(--orange-bg)] text-[var(--orange-text)]");
  });

  it("wires sidebar keyboard shortcuts from one exported target list", () => {
    const appShell = source("src/components/AppShell.tsx");
    const sidebar = source("src/components/Sidebar.tsx");

    expect(sidebar).toContain("export const SIDEBAR_SHORTCUT_TARGETS");
    expect(sidebar).toContain("⌘");
    expect(appShell).toContain('import AppSidebar, { SIDEBAR_SHORTCUT_TARGETS } from "./Sidebar";');
    expect(appShell).toContain("SIDEBAR_SHORTCUT_TARGETS.find");
    expect(appShell).toContain("router.push(targetRoute.href)");
    expect(appShell).toContain('[contenteditable="true"]');
  });
});
