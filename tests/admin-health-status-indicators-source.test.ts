import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(path, "utf8");
}

describe("admin health status indicators", () => {
  it("uses a static, labeled status dot", () => {
    const indicator = source("src/components/ui/status-indicator.tsx");

    expect(indicator).toContain("bg-current");
    expect(indicator).not.toContain("animate-ping");
    expect(indicator).not.toContain("shouldAnimate");
  });

  it("maps admin queue and checklist counts through one shared health helper", () => {
    const helper = source("src/lib/operational-health.ts");

    expect(helper).toContain("export function summarizeOperationalHealth");
    expect(helper).toContain('state: "down"');
    expect(helper).toContain('label: "Critical"');
    expect(helper).toContain('state: "fixing"');
    expect(helper).toContain('label: "Needs work"');
    expect(helper).toContain('label: "Partial data"');
    expect(helper).toContain('state: "active"');
  });

  it("shows the shared operational rail on Fix Today queue health", () => {
    const sourceText = source("src/app/(app)/admin/fix-today/FixTodayClient.tsx");

    expect(sourceText).toContain('import { OperationalStatusRail, type OperationalStatusRailItem } from "@/components/OperationalStatusRail"');
    expect(sourceText).toContain('import StatusIndicator from "@/components/ui/status-indicator"');
    expect(sourceText).toContain("const railItems: OperationalStatusRailItem[]");
    expect(sourceText).toContain('id: "critical-checks"');
    expect(sourceText).toContain('id: "partial-data"');
    expect(sourceText).toContain("<OperationalStatusRail");
    expect(sourceText).toContain('label: "Queue updated"');
    expect(sourceText).toContain('allClearLabel={activeSections.length === 0 && partialFailures.length === 0 ? "No admin fixes are open"');
    expect(sourceText).toContain("state={hasWork ? meta.state : \"active\"}");
  });

  it("shows shared status indicators on Inventory Hygiene checklist health", () => {
    const sourceText = source("src/app/(app)/items/hygiene/page.tsx");

    expect(sourceText).toContain('import StatusIndicator from "@/components/ui/status-indicator"');
    expect(sourceText).toContain('import { summarizeOperationalHealth } from "@/lib/operational-health"');
    expect(sourceText).toContain("const checklistHealth = data");
    expect(sourceText).toContain("needsWorkCount: data.totals.checksNeedingWork");
    expect(sourceText).toContain("partialFailureCount: partialFailures.length");
    expect(sourceText).toContain("state={checklistHealth.state}");
    expect(sourceText).toContain("state={health.state}");
  });
});
