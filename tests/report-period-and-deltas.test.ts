import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { ALL_TIME_PERIOD, buildPeriodDelta, periodLabel } from "@/app/(app)/reports/use-report-period";

describe("period labels", () => {
  it("names the all-time window instead of showing 0d", () => {
    expect(periodLabel(ALL_TIME_PERIOD)).toBe("All time");
    expect(periodLabel(30)).toBe("30d");
  });
});

describe("prior-period deltas", () => {
  it("computes a ratio against the previous window", () => {
    const delta = buildPeriodDelta({ current: 118, days: 30, previous: 100 });

    expect(delta).toMatchObject({ absolute: 18, comparisonLabel: "vs prior 30d" });
    expect(delta?.percent).toBeCloseTo(0.18);
  });

  it("reports a raw difference when the prior window was empty", () => {
    // A percentage against zero is infinite, so the absolute value is the only
    // honest thing to show.
    const delta = buildPeriodDelta({ current: 12, days: 7, previous: 0 });

    expect(delta?.percent).toBeNull();
    expect(delta?.absolute).toBe(12);
  });

  it("uses percentage points for metrics that are already rates", () => {
    const delta = buildPeriodDelta({
      current: 98,
      days: 30,
      mode: "points",
      previous: 95,
    });

    expect(delta?.percent).toBeNull();
    expect(delta?.absolute).toBe(3);
    expect(delta?.absoluteSuffix).toBe(" pts");
  });

  it("offers no comparison for all-time or a missing prior window", () => {
    expect(buildPeriodDelta({ current: 5, days: ALL_TIME_PERIOD, previous: 4 })).toBeUndefined();
    expect(buildPeriodDelta({ current: 5, days: 30, previous: null })).toBeUndefined();
    expect(buildPeriodDelta({ current: 5, days: 30, previous: undefined })).toBeUndefined();
  });
});

describe("report period persistence contract", () => {
  const source = readFileSync("src/app/(app)/reports/use-report-period.ts", "utf8");

  it("keeps each report's existing query-param name configurable", () => {
    // Standardising these would break existing bookmarks and URL-sync tests.
    expect(source).toContain("paramName");
    expect(source).not.toContain('paramName = "period"');
  });

  it("lets an explicit URL param win over the remembered window", () => {
    expect(source).toContain("if (parse(searchParams.get(paramName)) !== null) return;");
  });

  it("survives storage access being blocked", () => {
    expect(source.match(/catch \{/g)?.length).toBeGreaterThanOrEqual(2);
  });
});

describe("metric card additions stay optional", () => {
  const source = readFileSync("src/components/OperationalFeedback.tsx", "utf8");

  it("keeps delta and sparkline opt-in so shared surfaces are unaffected", () => {
    expect(source).toContain("delta?: OperationalMetricDelta;");
    expect(source).toContain("sparkline?: number[];");
    expect(source).toContain("{delta ? (");
    expect(source).toContain("{sparkline ? <MetricSparkline values={sparkline} /> : null}");
  });

  it("renders a flat delta as no change rather than 0%", () => {
    expect(source).toContain('const text = direction === "flat" ? "No change" : formatDeltaText(delta);');
  });
});
