import { describe, expect, it } from "vitest";
import { getGuideFreshness } from "@/lib/guide-freshness";

describe("guide freshness", () => {
  const now = new Date("2026-05-10T12:00:00Z");

  it("marks never-verified guides as needing review", () => {
    const freshness = getGuideFreshness({
      updatedAt: "2026-05-01T12:00:00Z",
      lastVerifiedAt: null,
    }, now);

    expect(freshness.status).toBe("needs-review");
    expect(freshness.detail).toBe("Never verified");
  });

  it("marks guides updated after verification as needing review", () => {
    const freshness = getGuideFreshness({
      updatedAt: "2026-05-10T12:00:10Z",
      lastVerifiedAt: "2026-05-10T12:00:00Z",
    }, now);

    expect(freshness.status).toBe("needs-review");
    expect(freshness.detail).toBe("Updated after verification");
  });

  it("keeps recently verified guides current", () => {
    const freshness = getGuideFreshness({
      updatedAt: "2026-05-10T12:00:00Z",
      lastVerifiedAt: "2026-05-10T12:00:00Z",
    }, now);

    expect(freshness.status).toBe("verified");
    expect(freshness.label).toBe("Verified");
  });

  it("marks old verification dates as needing review", () => {
    const freshness = getGuideFreshness({
      updatedAt: "2026-01-01T12:00:00Z",
      lastVerifiedAt: "2026-01-01T12:00:00Z",
    }, now);

    expect(freshness.status).toBe("needs-review");
    expect(freshness.daysSinceVerified).toBeGreaterThanOrEqual(90);
  });
});
