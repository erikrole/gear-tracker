import { describe, expect, it } from "vitest";
import { BulkUnitStatus } from "@prisma/client";
import { summarizeItemFamilyState } from "@/lib/item-family-state";

describe("summarizeItemFamilyState", () => {
  it("uses active allocations over stored unit status for unit-tracked families", () => {
    const state = summarizeItemFamilyState(
      {
        trackByNumber: true,
        balances: [{ onHandQuantity: 99 }],
        units: [
          { id: "unit-orphan", unitNumber: 1, status: BulkUnitStatus.CHECKED_OUT },
          { id: "unit-active", unitNumber: 2, status: BulkUnitStatus.AVAILABLE },
          { id: "unit-lost", unitNumber: 3, status: BulkUnitStatus.LOST },
          { id: "unit-retired", unitNumber: 4, status: BulkUnitStatus.RETIRED },
        ],
      },
      new Map([["unit-active", { bulkSkuUnitId: "unit-active" }]]),
    );

    expect(state.onHandQuantity).toBe(4);
    expect(state.balanceOnHandQuantity).toBe(99);
    expect(state.availableQuantity).toBe(1);
    expect(state.checkedOutQuantity).toBe(1);
    expect(state.lostQuantity).toBe(1);
    expect(state.retiredQuantity).toBe(1);
    expect(state.effectiveUnits).toEqual([
      expect.objectContaining({ id: "unit-orphan", status: BulkUnitStatus.AVAILABLE }),
      expect.objectContaining({ id: "unit-active", status: BulkUnitStatus.CHECKED_OUT }),
      expect.objectContaining({ id: "unit-lost", status: BulkUnitStatus.LOST }),
      expect.objectContaining({ id: "unit-retired", status: BulkUnitStatus.RETIRED }),
    ]);
  });

  it("uses movement-adjusted stock balance for quantity-tracked families", () => {
    const state = summarizeItemFamilyState(
      {
        trackByNumber: false,
        balances: [{ onHandQuantity: 2 }, { onHandQuantity: 3 }],
        units: [],
      },
      new Map(),
    );

    expect(state.onHandQuantity).toBe(5);
    expect(state.availableQuantity).toBe(5);
    expect(state.checkedOutQuantity).toBe(0);
    expect(state.effectiveUnits).toEqual([]);
  });
});
