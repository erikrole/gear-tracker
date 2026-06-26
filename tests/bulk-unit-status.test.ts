import { describe, expect, it } from "vitest";
import { BulkUnitStatus } from "@prisma/client";
import { buildActiveBulkUnitAllocationMap, effectiveBulkUnitStatus } from "@/lib/bulk-unit-status";

describe("effectiveBulkUnitStatus", () => {
  it("treats active allocation as checked out", () => {
    expect(effectiveBulkUnitStatus(
      { id: "unit-1", status: BulkUnitStatus.AVAILABLE },
      { bulkSkuUnitId: "unit-1" },
    )).toBe(BulkUnitStatus.CHECKED_OUT);
  });

  it("treats orphaned raw checked-out status as available", () => {
    expect(effectiveBulkUnitStatus(
      { id: "unit-1", status: BulkUnitStatus.CHECKED_OUT },
      null,
    )).toBe(BulkUnitStatus.AVAILABLE);
  });

  it("preserves missing and retired status", () => {
    expect(effectiveBulkUnitStatus(
      { id: "unit-1", status: BulkUnitStatus.LOST },
      null,
    )).toBe(BulkUnitStatus.LOST);
    expect(effectiveBulkUnitStatus(
      { id: "unit-2", status: BulkUnitStatus.RETIRED },
      null,
    )).toBe(BulkUnitStatus.RETIRED);
  });

  it("keeps the first active allocation by unit id", () => {
    const map = buildActiveBulkUnitAllocationMap([
      { id: "newer", bulkSkuUnitId: "unit-1" },
      { id: "older", bulkSkuUnitId: "unit-1" },
    ]);

    expect(map.get("unit-1")).toEqual({ id: "newer", bulkSkuUnitId: "unit-1" });
  });
});
