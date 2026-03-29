import { describe, it, expect, vi, beforeEach } from "vitest";
import { expectSerializableIsolation } from "./_helpers/assert-transaction";

// ─── Transaction tracking ───────────────────────────────────────────────────
const transactionCalls: Array<{ options: unknown }> = [];

// ─── Mock @/lib/db ──────────────────────────────────────────────────────────
vi.mock("@/lib/db", () => {
  const mockTx = {
    booking: { findUnique: vi.fn() },
    scanEvent: { findFirst: vi.fn(), create: vi.fn() },
    bookingBulkItem: { update: vi.fn() },
    bulkStockBalance: { findMany: vi.fn(), upsert: vi.fn() },
    bulkStockMovement: { createMany: vi.fn() },
    scanSession: { findFirst: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
    overrideEvent: { count: vi.fn(), create: vi.fn() },
    bookingSerializedItem: { updateMany: vi.fn() },
    assetAllocation: { updateMany: vi.fn() },
    auditLog: { create: vi.fn(), createMany: vi.fn() },
  };

  return {
    db: {
      $transaction: vi.fn(async (fn: (tx: typeof mockTx) => Promise<unknown>, options?: unknown) => {
        transactionCalls.push({ options });
        return fn(mockTx);
      }),
      scanEvent: { create: vi.fn() },
      _mockTx: mockTx,
    },
  };
});

vi.mock("@/lib/audit", () => ({
  createAuditEntry: vi.fn(),
  createAuditEntries: vi.fn(),
}));

vi.mock("@/lib/services/bookings", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/services/bookings")>();
  return {
    ...actual,
    markCheckoutCompleted: vi.fn().mockResolvedValue({ success: true }),
  };
});

vi.mock("@/lib/services/availability", () => ({
  checkAvailability: vi.fn().mockResolvedValue({ conflicts: [] }),
}));

import { db } from "@/lib/db";
import { recordScan } from "@/lib/services/scans";

const mockTx = (db as any)._mockTx;

beforeEach(() => {
  transactionCalls.length = 0;
});

// ═════════════════════════════════════════════════════════════════════════════
// BUG PROOF: Non-numbered bulk scan TOCTOU
// The quantity guard runs before the transaction, but the increment runs inside
// a separate transaction without SERIALIZABLE isolation.
// ═════════════════════════════════════════════════════════════════════════════
describe("non-numbered bulk scan TOCTOU", () => {
  function setupBulkScan(checkedOut = 0, planned = 10) {
    mockTx.scanEvent.findFirst.mockResolvedValue(null);
    mockTx.booking.findUnique.mockResolvedValue({
      id: "b-1",
      kind: "CHECKOUT",
      status: "OPEN",
      serializedItems: [],
      bulkItems: [{
        id: "bi-1",
        bulkSkuId: "sku-1",
        plannedQuantity: planned,
        checkedOutQuantity: checkedOut,
        checkedInQuantity: 0,
        bulkSku: { id: "sku-1", binQrCodeValue: "BIN-QR-1", trackByNumber: false },
      }],
    });
    mockTx.scanEvent.create.mockResolvedValue({ id: "event-1" });
    mockTx.bookingBulkItem.update.mockResolvedValue({});
  }

  it("BUG: quantity guard reads outside the increment transaction (TOCTOU gap)", async () => {
    setupBulkScan(0, 10);

    await recordScan({
      bookingId: "b-1",
      actorUserId: "actor-1",
      phase: "CHECKOUT" as any,
      scanType: "BULK_BIN" as any,
      scanValue: "BIN-QR-1",
      quantity: 5,
    });

    // The first transaction is SERIALIZABLE (dedup + booking lookup).
    // The second transaction (increment) has NO isolation specified — that's the bug.
    expect(transactionCalls.length).toBeGreaterThanOrEqual(2);
    expectSerializableIsolation(transactionCalls, 0);
    // BUG: Second tx has no isolation level. A concurrent scan could read stale
    // checkedOutQuantity, pass the guard, and both scans increment — exceeding planned.
    expect(transactionCalls[1].options).toBeUndefined();
  });

  it("creates scan event and increments quantity on success", async () => {
    setupBulkScan(3, 10);

    const result = await recordScan({
      bookingId: "b-1",
      actorUserId: "actor-1",
      phase: "CHECKOUT" as any,
      scanType: "BULK_BIN" as any,
      scanValue: "BIN-QR-1",
      quantity: 2,
    });

    expect(result.success).toBe(true);
    expect(mockTx.scanEvent.create).toHaveBeenCalled();
    expect(mockTx.bookingBulkItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { checkedOutQuantity: { increment: 2 } },
      })
    );
  });

  it("rejects quantity exceeding planned", async () => {
    setupBulkScan(8, 10);

    await expect(
      recordScan({
        bookingId: "b-1",
        actorUserId: "actor-1",
        phase: "CHECKOUT" as any,
        scanType: "BULK_BIN" as any,
        scanValue: "BIN-QR-1",
        quantity: 5,
      })
    ).rejects.toThrow("Scan would exceed");
  });

  it("rejects bulk scan without quantity", async () => {
    setupBulkScan(0, 10);

    await expect(
      recordScan({
        bookingId: "b-1",
        actorUserId: "actor-1",
        phase: "CHECKOUT" as any,
        scanType: "BULK_BIN" as any,
        scanValue: "BIN-QR-1",
      })
    ).rejects.toThrow("Bulk scans require a positive quantity");
  });
});
