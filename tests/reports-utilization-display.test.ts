import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync("src/app/(app)/reports/utilization/page.tsx", "utf8");
const chartSource = readFileSync("src/app/(app)/reports/utilization/charts.tsx", "utf8");

describe("utilization report display labels", () => {
  it("uses shared equipment status labels instead of raw enum labels", () => {
    expect(chartSource).toContain("statusLabelEquipment(status)");
    expect(chartSource).toContain("PENDING_PICKUP");
    expect(chartSource).not.toContain("STATUS_META_LABELS");
    expect(pageSource).not.toContain("label={meta?.label || status}");
  });
});

describe("utilization report content", () => {
  it("reports custody-based utilization, not just an inventory snapshot", () => {
    for (const label of [
      'label="Utilization"',
      'label="Days in custody"',
      'label="Gear used"',
      'label="Idle this period"',
      'label="Never checked out"',
    ]) {
      expect(pageSource).toContain(label);
    }
  });

  it("scopes the report to a selectable period", () => {
    expect(pageSource).toContain("useReportPeriod");
    expect(pageSource).toContain("/api/reports/utilization?days=");
    expect(pageSource).toContain("ReportSegmentedControl");
  });

  it("renders breakdowns once, as share-of-total tables rather than duplicated charts", () => {
    expect(pageSource).toContain("ReportBreakdownTable");
    // The old page drew a bar chart and an identical table for the same rows.
    expect(chartSource).not.toContain("TopBreakdownChart");
    expect(pageSource).not.toContain("BreakdownCard");
  });

  it("drills breakdown rows into items using ids the items page can parse", () => {
    expect(pageSource).toContain("/items?location=");
    expect(pageSource).toContain("/items?category=");
    expect(pageSource).toContain("/items?department=");
    expect(chartSource).toContain("/items?status=");
  });

  it("marks the body stale while a refresh is in flight", () => {
    expect(pageSource).toContain("ReportDataRegion");
    expect(pageSource).toContain("refreshing");
  });
});
