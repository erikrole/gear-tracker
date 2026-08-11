import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const utilizationSource = readFileSync(
  "src/app/(app)/reports/utilization/page.tsx",
  "utf8",
);
const checkoutsSource = readFileSync(
  "src/app/(app)/reports/checkouts/page.tsx",
  "utf8",
);

describe("web report partial-result feedback", () => {
  it.each([
    ["utilization", utilizationSource],
    ["checkout", checkoutsSource],
  ])("keeps %s results visible while naming unavailable sections", (_name, source) => {
    expect(source).toContain("partialFailures?: string[]");
    expect(source).toContain("OperationalPartialResultsAlert");
    expect(source).toContain("failures={data.partialFailures ?? []}");
    expect(source).toContain("Refresh before treating zeros or empty sections as final.");
  });
});
