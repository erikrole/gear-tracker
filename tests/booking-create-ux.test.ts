import { describe, expect, it } from "vitest";
import {
  buildAvailabilityReview,
  getAvailabilityWarningTotal,
  getStep2PrimaryActionLabel,
} from "@/components/booking-wizard/flow-summary";

const baseCounts = {
  conflictCount: 0,
  upcomingCommitmentCount: 0,
  turnaroundRiskCount: 0,
  bulkTurnaroundRiskCount: 0,
};

describe("booking create UX helpers", () => {
  it("counts all selected availability warnings, not only hard conflicts", () => {
    expect(getAvailabilityWarningTotal({
      conflictCount: 1,
      upcomingCommitmentCount: 2,
      turnaroundRiskCount: 3,
      bulkTurnaroundRiskCount: 4,
    })).toBe(10);
  });

  it("labels selected advisory warnings before review", () => {
    expect(getStep2PrimaryActionLabel({
      ...baseCounts,
      itemCount: 3,
      unresolvedAssetCount: 0,
      upcomingCommitmentCount: 1,
      bulkTurnaroundRiskCount: 1,
    })).toBe("Review with warnings (3 items)");
  });

  it("keeps unresolved selected items blocking before review", () => {
    expect(getStep2PrimaryActionLabel({
      ...baseCounts,
      itemCount: 0,
      unresolvedAssetCount: 2,
    })).toBe("Remove unavailable items");
  });

  it("keeps empty selections tied to selection instead of category browsing", () => {
    expect(getStep2PrimaryActionLabel({
      ...baseCounts,
      itemCount: 0,
      unresolvedAssetCount: 0,
    })).toBe("Select equipment");
  });

  it("does not show an availability review when no warnings are present", () => {
    expect(buildAvailabilityReview(baseCounts)).toBeNull();
  });

  it("uses conflict copy for hard availability conflicts", () => {
    const review = buildAvailabilityReview({
      ...baseCounts,
      conflictCount: 1,
      upcomingCommitmentCount: 1,
    });

    expect(review).toMatchObject({
      tone: "conflict",
      title: "Availability needs review",
      total: 2,
      advisoryCount: 1,
    });
    expect(review?.description).toContain("hard conflict");
  });

  it("uses advisory copy for next-use and turnaround warnings", () => {
    const review = buildAvailabilityReview({
      ...baseCounts,
      upcomingCommitmentCount: 1,
      turnaroundRiskCount: 1,
      bulkTurnaroundRiskCount: 1,
    });

    expect(review).toMatchObject({
      tone: "advisory",
      title: "Availability warnings noted",
      total: 3,
      advisoryCount: 3,
      turnaroundCount: 2,
    });
    expect(review?.description).toContain("do not block creation");
  });
});
