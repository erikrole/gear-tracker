import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("utilization report display labels", () => {
  it("uses shared equipment status labels instead of raw enum labels", () => {
    const pageSource = readFileSync("src/app/(app)/reports/utilization/page.tsx", "utf8");
    const chartSource = readFileSync("src/app/(app)/reports/utilization/charts.tsx", "utf8");

    expect(pageSource).toContain("statusLabelEquipment(status)");
    expect(pageSource).toContain("statusBadgeVariantEquipment(status)");
    expect(pageSource).not.toContain("label={meta?.label || status}");
    expect(chartSource).toContain("statusLabelEquipment(status)");
    expect(chartSource).toContain("PENDING_PICKUP");
    expect(chartSource).not.toContain("STATUS_META_LABELS");
  });
});
