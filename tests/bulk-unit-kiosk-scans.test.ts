import { describe, expect, it, vi } from "vitest";
import {
  scanKioskCheckinBulkUnit,
  scanKioskPickupBulkUnit,
} from "@/lib/services/bulk-unit-scans";

function makeTx(overrides: Partial<Record<string, unknown>> = {}) {
  const tx = {
    booking: { findUnique: vi.fn() },
    bulkSkuUnit: { findUnique: vi.fn(), update: vi.fn() },
    bookingBulkUnitAllocation: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    bookingBulkItem: { update: vi.fn() },
    ...overrides,
  };
  return tx as typeof tx & any;
}

const pickupBooking = {
  id: "booking-1",
  kind: "CHECKOUT",
  status: "PENDING_PICKUP",
  bulkItems: [{
    id: "bulk-item-1",
    bulkSkuId: "sku-1",
    plannedQuantity: 5,
    checkedOutQuantity: 0,
    bulkSku: {
      id: "sku-1",
      name: "Sony Battery",
      category: "Batteries",
      binQrCodeValue: "94e068d1",
      trackByNumber: true,
    },
  }],
};

describe("scanKioskPickupBulkUnit", () => {
  it("binds one available numbered unit to a pending pickup", async () => {
    const tx = makeTx();
    tx.booking.findUnique.mockResolvedValue(pickupBooking);
    tx.bulkSkuUnit.findUnique.mockResolvedValue({
      id: "unit-7",
      bulkSkuId: "sku-1",
      unitNumber: 7,
      status: "AVAILABLE",
    });
    tx.bookingBulkUnitAllocation.findUnique.mockResolvedValue(null);

    const result = await scanKioskPickupBulkUnit(tx, {
      bookingId: "booking-1",
      scanValue: "94e068d1-7",
    });

    expect(result).toEqual(expect.objectContaining({
      handled: true,
      success: true,
      item: expect.objectContaining({
        id: "bulk-item-1:slot:1",
        tagName: "#7",
        unitNumber: 7,
      }),
    }));
    expect(tx.bookingBulkUnitAllocation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        bookingBulkItemId: "bulk-item-1",
        bulkSkuUnitId: "unit-7",
      }),
    });
    expect(tx.bulkSkuUnit.update).toHaveBeenCalledWith({
      where: { id: "unit-7" },
      data: { status: "CHECKED_OUT" },
    });
    expect(tx.bookingBulkItem.update).toHaveBeenCalledWith({
      where: { id: "bulk-item-1" },
      data: { checkedOutQuantity: { increment: 1 } },
    });
  });

  it("returns duplicate feedback with the unit number", async () => {
    const tx = makeTx();
    tx.booking.findUnique.mockResolvedValue(pickupBooking);
    tx.bulkSkuUnit.findUnique.mockResolvedValue({
      id: "unit-7",
      bulkSkuId: "sku-1",
      unitNumber: 7,
      status: "CHECKED_OUT",
    });
    tx.bookingBulkUnitAllocation.findUnique.mockResolvedValue({
      id: "allocation-1",
      checkedOutAt: new Date(),
    });

    const result = await scanKioskPickupBulkUnit(tx, {
      bookingId: "booking-1",
      scanValue: "94e068d1-7",
    });

    expect(result).toEqual({
      handled: true,
      success: false,
      error: "Sony Battery #7 already scanned",
    });
  });
});

describe("scanKioskCheckinBulkUnit", () => {
  it("returns only the scanned numbered unit", async () => {
    const tx = makeTx();
    tx.booking.findUnique.mockResolvedValue({
      ...pickupBooking,
      status: "OPEN",
      bulkItems: [{
        ...pickupBooking.bulkItems[0],
        checkedOutQuantity: 5,
        checkedInQuantity: 0,
      }],
    });
    tx.bulkSkuUnit.findUnique.mockResolvedValue({
      id: "unit-7",
      bulkSkuId: "sku-1",
      unitNumber: 7,
      status: "CHECKED_OUT",
    });
    tx.bookingBulkUnitAllocation.findUnique.mockResolvedValue({
      id: "allocation-1",
      checkedOutAt: new Date(),
      checkedInAt: null,
    });

    const result = await scanKioskCheckinBulkUnit(tx, {
      bookingId: "booking-1",
      scanValue: "94e068d1-7",
    });

    expect(result).toEqual(expect.objectContaining({
      handled: true,
      success: true,
      item: expect.objectContaining({ tagName: "#7", unitNumber: 7 }),
    }));
    expect(tx.bookingBulkUnitAllocation.update).toHaveBeenCalledWith({
      where: { id: "allocation-1" },
      data: expect.objectContaining({ checkedInAt: expect.any(Date) }),
    });
    expect(tx.bulkSkuUnit.update).toHaveBeenCalledWith({
      where: { id: "unit-7" },
      data: { status: "AVAILABLE" },
    });
    expect(tx.bookingBulkItem.update).toHaveBeenCalledWith({
      where: { id: "bulk-item-1" },
      data: { checkedInQuantity: { increment: 1 } },
    });
  });
});
