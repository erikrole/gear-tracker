import { describe, it, expect, vi } from "vitest";
import { makeAsset, makeBulkStockBalance } from "./_helpers/factories";

// No module mocking needed — these functions accept tx as a parameter
import {
  checkSerializedConflicts,
  checkBulkShortages,
  checkAssetStatuses,
  checkAvailability,
} from "@/lib/services/availability";

function createMockTx() {
  return {
    assetAllocation: { findMany: vi.fn() },
    asset: { findMany: vi.fn() },
    bulkStockBalance: { findMany: vi.fn() },
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// checkSerializedConflicts
// ═════════════════════════════════════════════════════════════════════════════
describe("checkSerializedConflicts", () => {
  it("returns empty for no asset IDs", async () => {
    const tx = createMockTx();
    const result = await checkSerializedConflicts(tx as any, {
      serializedAssetIds: [],
      startsAt: new Date("2026-04-01"),
      endsAt: new Date("2026-04-02"),
    });
    expect(result).toEqual([]);
    expect(tx.assetAllocation.findMany).not.toHaveBeenCalled();
  });

  it("detects overlapping allocations", async () => {
    const tx = createMockTx();
    tx.assetAllocation.findMany.mockResolvedValue([{
      assetId: "a-1",
      bookingId: "b-other",
      startsAt: new Date("2026-04-01T08:00:00Z"),
      endsAt: new Date("2026-04-01T17:00:00Z"),
      booking: { title: "Other booking" },
    }]);

    const result = await checkSerializedConflicts(tx as any, {
      serializedAssetIds: ["a-1"],
      startsAt: new Date("2026-04-01T10:00:00Z"),
      endsAt: new Date("2026-04-01T12:00:00Z"),
    });

    expect(result).toHaveLength(1);
    expect(result[0].assetId).toBe("a-1");
    expect(result[0].conflictingBookingId).toBe("b-other");
  });

  it("excludes specified booking from conflict check", async () => {
    const tx = createMockTx();
    tx.assetAllocation.findMany.mockResolvedValue([]);

    await checkSerializedConflicts(tx as any, {
      serializedAssetIds: ["a-1"],
      startsAt: new Date("2026-04-01"),
      endsAt: new Date("2026-04-02"),
      excludeBookingId: "b-self",
    });

    expect(tx.assetAllocation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          bookingId: { not: "b-self" },
        }),
      })
    );
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// checkAssetStatuses
// ═════════════════════════════════════════════════════════════════════════════
describe("checkAssetStatuses", () => {
  it("returns empty for no asset IDs", async () => {
    const tx = createMockTx();
    const result = await checkAssetStatuses(tx as any, { serializedAssetIds: [] });
    expect(result).toEqual([]);
  });

  it("flags assets in MAINTENANCE status", async () => {
    const tx = createMockTx();
    tx.asset.findMany.mockResolvedValue([
      { id: "a-1", status: "MAINTENANCE", availableForCheckout: true, availableForReservation: true },
    ]);

    const result = await checkAssetStatuses(tx as any, { serializedAssetIds: ["a-1"] });
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ assetId: "a-1", status: "MAINTENANCE" });
  });

  it("flags missing assets as NOT_FOUND", async () => {
    const tx = createMockTx();
    tx.asset.findMany.mockResolvedValue([]);

    const result = await checkAssetStatuses(tx as any, { serializedAssetIds: ["a-missing"] });
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ assetId: "a-missing", status: "NOT_FOUND" });
  });

  it("flags assets not available for checkout", async () => {
    const tx = createMockTx();
    tx.asset.findMany.mockResolvedValue([
      { id: "a-1", status: "AVAILABLE", availableForCheckout: false, availableForReservation: true },
    ]);

    const result = await checkAssetStatuses(tx as any, {
      serializedAssetIds: ["a-1"],
      bookingKind: "CHECKOUT",
    });
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe("NOT_AVAILABLE_FOR_CHECKOUT");
  });

  it("flags assets not available for reservation", async () => {
    const tx = createMockTx();
    tx.asset.findMany.mockResolvedValue([
      { id: "a-1", status: "AVAILABLE", availableForCheckout: true, availableForReservation: false },
    ]);

    const result = await checkAssetStatuses(tx as any, {
      serializedAssetIds: ["a-1"],
      bookingKind: "RESERVATION",
    });
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe("NOT_AVAILABLE_FOR_RESERVATION");
  });

  it("passes AVAILABLE assets with correct flags", async () => {
    const tx = createMockTx();
    tx.asset.findMany.mockResolvedValue([
      { id: "a-1", status: "AVAILABLE", availableForCheckout: true, availableForReservation: true },
    ]);

    const result = await checkAssetStatuses(tx as any, {
      serializedAssetIds: ["a-1"],
      bookingKind: "CHECKOUT",
    });
    expect(result).toEqual([]);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// checkBulkShortages
// ═════════════════════════════════════════════════════════════════════════════
describe("checkBulkShortages", () => {
  it("returns empty for no bulk items", async () => {
    const tx = createMockTx();
    const result = await checkBulkShortages(tx as any, {
      locationId: "loc-1",
      bulkItems: [],
    });
    expect(result).toEqual([]);
  });

  it("detects shortage when requested > available", async () => {
    const tx = createMockTx();
    tx.bulkStockBalance.findMany.mockResolvedValue([
      { bulkSkuId: "sku-1", onHandQuantity: 3 },
    ]);

    const result = await checkBulkShortages(tx as any, {
      locationId: "loc-1",
      bulkItems: [{ bulkSkuId: "sku-1", quantity: 5 }],
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ bulkSkuId: "sku-1", requested: 5, available: 3 });
  });

  it("treats missing balance as 0 available", async () => {
    const tx = createMockTx();
    tx.bulkStockBalance.findMany.mockResolvedValue([]);

    const result = await checkBulkShortages(tx as any, {
      locationId: "loc-1",
      bulkItems: [{ bulkSkuId: "sku-missing", quantity: 1 }],
    });
    expect(result).toHaveLength(1);
    expect(result[0].available).toBe(0);
  });

  it("returns empty when sufficient stock", async () => {
    const tx = createMockTx();
    tx.bulkStockBalance.findMany.mockResolvedValue([
      { bulkSkuId: "sku-1", onHandQuantity: 100 },
    ]);

    const result = await checkBulkShortages(tx as any, {
      locationId: "loc-1",
      bulkItems: [{ bulkSkuId: "sku-1", quantity: 50 }],
    });
    expect(result).toEqual([]);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// checkAvailability (integration of sub-checks)
// ═════════════════════════════════════════════════════════════════════════════
describe("checkAvailability", () => {
  it("returns combined results from all sub-checks", async () => {
    const tx = createMockTx();
    tx.assetAllocation.findMany.mockResolvedValue([]);
    tx.bulkStockBalance.findMany.mockResolvedValue([]);
    tx.asset.findMany.mockResolvedValue([]);

    const result = await checkAvailability(tx as any, {
      locationId: "loc-1",
      startsAt: new Date("2026-04-01"),
      endsAt: new Date("2026-04-02"),
      serializedAssetIds: [],
      bulkItems: [],
    });

    expect(result).toEqual({
      conflicts: [],
      shortages: [],
      unavailableAssets: [],
    });
  });
});
