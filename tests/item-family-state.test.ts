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

    expect(state.onHandQuantity).toBe(3);
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

  it("excludes retired numbered records from active inventory totals", () => {
    const state = summarizeItemFamilyState(
      {
        trackByNumber: true,
        balances: [{ onHandQuantity: 49 }],
        units: [
          ...Array.from({ length: 47 }, (_, index) => ({
            id: `available-${index + 1}`,
            status: BulkUnitStatus.AVAILABLE,
          })),
          { id: "checked-out-1", status: BulkUnitStatus.AVAILABLE },
          { id: "checked-out-2", status: BulkUnitStatus.AVAILABLE },
          { id: "retired-50", status: BulkUnitStatus.RETIRED },
          { id: "retired-51", status: BulkUnitStatus.RETIRED },
          { id: "retired-52", status: BulkUnitStatus.RETIRED },
        ],
      },
      new Map([
        ["checked-out-1", { bulkSkuUnitId: "checked-out-1" }],
        ["checked-out-2", { bulkSkuUnitId: "checked-out-2" }],
      ]),
    );

    expect(state.onHandQuantity).toBe(49);
    expect(state.availableQuantity).toBe(47);
    expect(state.checkedOutQuantity).toBe(2);
    expect(state.retiredQuantity).toBe(3);
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
