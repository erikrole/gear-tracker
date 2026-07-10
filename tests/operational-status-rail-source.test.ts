import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(path, "utf8");
}

describe("operational status rail source contract", () => {
  it("composes the rail from installed shadcn primitives", () => {
    const rail = source("src/components/OperationalStatusRail.tsx");

    expect(rail).toContain('from "@/components/ui/badge"');
    expect(rail).toContain('from "@/components/ui/button"');
    expect(rail).toContain('from "@/components/ui/collapsible"');
    expect(rail).toContain('from "@/components/ui/separator"');
    expect(rail).toContain('from "@/components/ui/tooltip"');
    expect(rail).toContain("<CollapsibleTrigger asChild>");
    expect(rail).toContain("<Button");
    expect(rail).toContain("<Badge");
  });

  it("prioritizes exceptions, bounds the visible rail, and accounts for overflow", () => {
    const rail = source("src/components/OperationalStatusRail.tsx");

    expect(rail).toContain("const TONE_RANK");
    expect(rail).toContain("maxVisibleItems = 3");
    expect(rail).toContain("const visibleItems = prioritizedItems.slice(0, maxVisibleItems)");
    expect(rail).toContain("const hiddenCount = Math.max(0, prioritizedItems.length - visibleItems.length)");
    expect(rail).toContain("Show details and ${hiddenCount} more statuses");
    expect(rail).toContain("allClearLabel");
    expect(rail).toContain("tabular-nums");
  });

  it("keeps route calculations outside the shared presentation contract", () => {
    const rail = source("src/components/OperationalStatusRail.tsx");
    const schedule = source("src/app/(app)/schedule/_components/ScheduleReadiness.tsx");
    const fixToday = source("src/app/(app)/admin/fix-today/FixTodayClient.tsx");

    expect(rail).not.toContain("ScheduleQueue");
    expect(rail).not.toContain("AdminFixTodayQueue");
    expect(schedule).toContain("<OperationalStatusRail");
    expect(schedule).toContain("const railItems: OperationalStatusRailItem[]");
    expect(fixToday).toContain("<OperationalStatusRail");
    expect(fixToday).toContain("const railItems: OperationalStatusRailItem[]");
  });
});
