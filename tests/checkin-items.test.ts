import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the db module
vi.mock("@/lib/db", () => {
  const mockTx = {
    booking: { findUnique: vi.fn(), update: vi.fn() },
    bookingSerializedItem: { updateMany: vi.fn(), count: vi.fn() },
    assetAllocation: { updateMany: vi.fn() },
    bulkStockBalance: { findUnique: vi.fn(), upsert: vi.fn() },
    bulkStockMovement: { create: vi.fn() },
    scanSession: { updateMany: vi.fn() },
    auditLog: { create: vi.fn() },
  };
  return {
    db: {
      $transaction: vi.fn(async (fn: (tx: typeof mockTx) => Promise<unknown>) => {
        return fn(mockTx);
      }),
      _mockTx: mockTx,
    },
  };
});

import { db } from "@/lib/db";
import { checkinItems } from "@/lib/services/bookings";

const mockTx = (db as any)._mockTx;

beforeEach(() => {
  vi.clearAllMocks();
});

function makeOpenCheckout(serializedItems: { assetId: string; allocationStatus: string }[]) {
  return {
    id: "booking-1",
    kind: "CHECKOUT",
    status: "OPEN",
    locationId: "loc-1",
    serializedItems: serializedItems.map((item) => ({
      bookingId: "booking-1",
      assetId: item.assetId,
      allocationStatus: item.allocationStatus,
    })),
    bulkItems: [],
  };
}

describe("checkinItems", () => {
  it("returns items and keeps checkout OPEN when items remain", async () => {
    mockTx.booking.findUnique.mockResolvedValue(
      makeOpenCheckout([
        { assetId: "a1", allocationStatus: "active" },
        { assetId: "a2", allocationStatus: "active" },
      ])
    );
    mockTx.bookingSerializedItem.count.mockResolvedValue(1); // 1 remaining after returning a1

    const result = await checkinItems("booking-1", "actor-1", ["a1"]);

    expect(result.success).toBe(true);
    expect(result.returnedAssetIds).toEqual(["a1"]);
    expect(result.remainingActiveItems).toBe(1);
    expect(result.autoCompleted).toBe(false);

    // Should mark item as returned
    expect(mockTx.bookingSerializedItem.updateMany).toHaveBeenCalledWith({
      where: { bookingId: "booking-1", assetId: "a1" },
      data: { allocationStatus: "returned" },
    });

    // Should deactivate allocation
    expect(mockTx.assetAllocation.updateMany).toHaveBeenCalledWith({
      where: { bookingId: "booking-1", assetId: "a1", active: true },
      data: { active: false },
    });

    // Should NOT complete the booking
    expect(mockTx.booking.update).not.toHaveBeenCalled();
  });

  it("auto-completes checkout when all items returned", async () => {
    mockTx.booking.findUnique.mockResolvedValue(
      makeOpenCheckout([
        { assetId: "a1", allocationStatus: "active" },
      ])
    );
    mockTx.bookingSerializedItem.count.mockResolvedValue(0); // none remaining

    const result = await checkinItems("booking-1", "actor-1", ["a1"]);

    expect(result.autoCompleted).toBe(true);
    expect(result.remainingActiveItems).toBe(0);

    // Should complete the booking
    expect(mockTx.booking.update).toHaveBeenCalledWith({
      where: { id: "booking-1" },
      data: { status: "COMPLETED" },
    });
  });

  it("rejects check-in of assets not in the checkout", async () => {
    mockTx.booking.findUnique.mockResolvedValue(
      makeOpenCheckout([
        { assetId: "a1", allocationStatus: "active" },
      ])
    );

    await expect(
      checkinItems("booking-1", "actor-1", ["a999"])
    ).rejects.toThrow("Assets not in this checkout");
  });

  it("rejects check-in of already returned assets", async () => {
    mockTx.booking.findUnique.mockResolvedValue(
      makeOpenCheckout([
        { assetId: "a1", allocationStatus: "returned" },
      ])
    );

    await expect(
      checkinItems("booking-1", "actor-1", ["a1"])
    ).rejects.toThrow("Assets already returned");
  });

  it("rejects check-in on non-OPEN checkout", async () => {
    const booking = makeOpenCheckout([{ assetId: "a1", allocationStatus: "active" }]);
    (booking as any).status = "COMPLETED";
    mockTx.booking.findUnique.mockResolvedValue(booking);

    await expect(
      checkinItems("booking-1", "actor-1", ["a1"])
    ).rejects.toThrow("Can only check in items from an open checkout");
  });

  it("rejects check-in on non-existent booking", async () => {
    mockTx.booking.findUnique.mockResolvedValue(null);

    await expect(
      checkinItems("booking-999", "actor-1", ["a1"])
    ).rejects.toThrow("Checkout not found");
  });

  it("creates audit log entry for partial check-in", async () => {
    mockTx.booking.findUnique.mockResolvedValue(
      makeOpenCheckout([
        { assetId: "a1", allocationStatus: "active" },
        { assetId: "a2", allocationStatus: "active" },
      ])
    );
    mockTx.bookingSerializedItem.count.mockResolvedValue(1);

    await checkinItems("booking-1", "actor-1", ["a1"]);

    expect(mockTx.auditLog.create).toHaveBeenCalledWith({
      data: {
        actorUserId: "actor-1",
        entityType: "booking",
        entityId: "booking-1",
        action: "partial_checkin",
        afterJson: { returnedAssetIds: ["a1"] },
      },
    });
  });

  it("creates auto-completion audit log when fully returned", async () => {
    mockTx.booking.findUnique.mockResolvedValue(
      makeOpenCheckout([
        { assetId: "a1", allocationStatus: "active" },
      ])
    );
    mockTx.bookingSerializedItem.count.mockResolvedValue(0);

    await checkinItems("booking-1", "actor-1", ["a1"]);

    // Should have two audit entries: partial_checkin + auto_completed
    const auditCalls = mockTx.auditLog.create.mock.calls;
    expect(auditCalls).toHaveLength(2);
    expect(auditCalls[0][0].data.action).toBe("partial_checkin");
    expect(auditCalls[1][0].data.action).toBe("auto_completed_by_partial_checkin");
  });
});
