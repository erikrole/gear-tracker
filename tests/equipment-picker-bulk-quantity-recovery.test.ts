import { describe, expect, it } from "vitest";
import {
  getBulkAvailableQuantity,
  reconcileSelectedBulkQuantities,
} from "@/components/equipment-picker/bulk-quantity-recovery";

describe("bulk quantity recovery", () => {
  it("uses available units as the authoritative picker cap when present", () => {
    expect(getBulkAvailableQuantity({
      id: "battery",
      name: "Sony Battery",
      currentQuantity: 40,
      availableQuantity: 6,
    })).toBe(6);
  });

  it("clamps selected battery quantity when live counts drop", () => {
    const result = reconcileSelectedBulkQuantities(
      [{ bulkSkuId: "battery", quantity: 8 }],
      [{
        id: "battery",
        name: "Sony Battery",
        currentQuantity: 40,
        availableQuantity: 5,
      }],
    );

    expect(result).toEqual({
      changed: true,
      items: [{ bulkSkuId: "battery", quantity: 5 }],
      messages: ["Sony Battery was adjusted from 8 to 5."],
    });
  });

  it("removes selected quantity when no live stock remains", () => {
    const result = reconcileSelectedBulkQuantities(
      [{ bulkSkuId: "battery", quantity: 2 }],
      [{
        id: "battery",
        name: "Sony Battery",
        currentQuantity: 40,
        availableQuantity: 0,
      }],
    );

    expect(result).toEqual({
      changed: true,
      items: [],
      messages: ["Sony Battery was removed because none are available."],
    });
  });
});
