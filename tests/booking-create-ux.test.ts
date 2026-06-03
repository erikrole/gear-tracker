import { describe, expect, it } from "vitest";
import {
  buildAvailabilityReview,
  getAvailabilityWarningTotal,
  getStep2PrimaryActionLabel,
} from "@/components/booking-wizard/flow-summary";
import { EQUIPMENT_SECTIONS } from "@/lib/equipment-sections";

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
      activeSection: EQUIPMENT_SECTIONS[0]!.key,
      upcomingCommitmentCount: 1,
      bulkTurnaroundRiskCount: 1,
    })).toBe("Review with warnings (3 items)");
  });

  it("keeps unresolved selected items blocking before review", () => {
    expect(getStep2PrimaryActionLabel({
      ...baseCounts,
      itemCount: 0,
      unresolvedAssetCount: 2,
      activeSection: EQUIPMENT_SECTIONS[0]!.key,
    })).toBe("Remove unavailable items");
  });

  it("points empty selections to the next equipment section", () => {
    expect(getStep2PrimaryActionLabel({
      ...baseCounts,
      itemCount: 0,
      unresolvedAssetCount: 0,
      activeSection: EQUIPMENT_SECTIONS[0]!.key,
    })).toBe(`Browse ${EQUIPMENT_SECTIONS[1]!.label}`);
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
