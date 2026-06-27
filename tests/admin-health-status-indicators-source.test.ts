import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(path, "utf8");
}

describe("admin health status indicators", () => {
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

  it("shows shared status indicators on Fix Today queue health", () => {
    const sourceText = source("src/app/(app)/admin/fix-today/FixTodayClient.tsx");

    expect(sourceText).toContain('import StatusIndicator from "@/components/ui/status-indicator"');
    expect(sourceText).toContain('import { summarizeOperationalHealth');
    expect(sourceText).toContain("const queueHealth = data");
    expect(sourceText).toContain("criticalCount: data.totals.criticalChecks");
    expect(sourceText).toContain("needsWorkCount: data.totals.checksNeedingWork");
    expect(sourceText).toContain("partialFailureCount: partialFailures.length");
    expect(sourceText).toContain("state={queueHealth.state}");
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
