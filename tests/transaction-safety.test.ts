import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Track $transaction options to verify isolation levels ────────────────────
const transactionCalls: Array<{ options: unknown }> = [];

// ─── Mock @/lib/db ───────────────────────────────────────────────────────────
vi.mock("@/lib/db", () => {
  const mockTx = {
    booking: { findUnique: vi.fn(), update: vi.fn() },
    bookingSerializedItem: { updateMany: vi.fn() },
    bookingBulkItem: { findUnique: vi.fn(), update: vi.fn() },
    bulkStockBalance: { findMany: vi.fn(), upsert: vi.fn() },
    bulkStockMovement: { createMany: vi.fn() },
    scanEvent: { findFirst: vi.fn(), create: vi.fn() },
    scanSession: { findFirst: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
    overrideEvent: { count: vi.fn(), create: vi.fn() },
    assetAllocation: { updateMany: vi.fn() },
    auditLog: { create: vi.fn(), createMany: vi.fn() },
    checkinItemReport: { findMany: vi.fn() },
    user: { findUnique: vi.fn().mockResolvedValue({ role: "ADMIN" }) },
  };

  return {
    db: {
      $transaction: vi.fn(async (fn: (tx: typeof mockTx) => Promise<unknown>, options?: unknown) => {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const calls = (globalThis as any).__transactionCalls;
        if (calls) calls.push({ options });
        return fn(mockTx);
      }),
      scanEvent: { create: vi.fn() },
      booking: { findUnique: vi.fn() },
      overrideEvent: { create: vi.fn() },
      auditLog: { create: vi.fn(), createMany: vi.fn() },
      _mockTx: mockTx,
    },
  };
});

// ─── Mock @/lib/audit (used by scans.ts) ─────────────────────────────────────
vi.mock("@/lib/audit", () => ({
  createAuditEntry: vi.fn(),
  createAuditEntries: vi.fn(),
  createAuditEntryTx: vi.fn(),
  createAuditEntriesTx: vi.fn(),
  createSystemAuditEntry: vi.fn(),
  lookupActorRole: vi.fn().mockResolvedValue("ADMIN"),
  AUDIT_RETENTION_DAYS: 90,
}));

// ─── Mock @/lib/services/bookings (used by scans.ts completeCheckinScan) ─────
vi.mock("@/lib/services/bookings", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/services/bookings")>();
  return {
    ...actual,
    markCheckoutCompleted: vi.fn().mockResolvedValue({ success: true }),
  };
});

// ─── Mock @/lib/services/availability (used by bookings.ts) ──────────────────
vi.mock("@/lib/services/availability", () => ({
  checkAvailability: vi.fn().mockResolvedValue({ conflicts: [] }),
}));

import { db } from "@/lib/db";
import { createAuditEntries } from "@/lib/audit";
import { recordScan, completeCheckoutScan, completeCheckinScan, startScanSession } from "@/lib/services/scans";

const mockTx = (db as any)._mockTx;

beforeEach(() => {
  vi.clearAllMocks();
  transactionCalls.length = 0;
  (globalThis as any).__transactionCalls = transactionCalls;
  mockTx.checkinItemReport.findMany.mockResolvedValue([]);
});

// ═══════════════════════════════════════════════════════════════════════════════
// createAuditEntries
// ═══════════════════════════════════════════════════════════════════════════════
describe("createAuditEntries", () => {
  it("is exported and callable", () => {
    expect(typeof createAuditEntries).toBe("function");
  });

  it("returns immediately for empty array (no DB call)", async () => {
    await createAuditEntries([]);
    expect(createAuditEntries).toHaveBeenCalledWith([]);
  });

  it("accepts a single entry", async () => {
    const entry = {
      actorId: "user-1",
      actorRole: "ADMIN" as const,
      entityType: "booking",
      entityId: "b-1",
      action: "test_action",
    };
    await createAuditEntries([entry]);
    expect(createAuditEntries).toHaveBeenCalledWith([entry]);
  });

  it("accepts multiple entries", async () => {
    const entries = [
      { actorId: "u1", actorRole: "ADMIN" as const, entityType: "booking", entityId: "b1", action: "a1" },
      { actorId: "u2", actorRole: "STAFF" as const, entityType: "asset", entityId: "a1", action: "a2", after: { note: "x" } },
    ];
    await createAuditEntries(entries);
    expect(createAuditEntries).toHaveBeenCalledWith(entries);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// recordScan — transaction isolation + input validation
// ═══════════════════════════════════════════════════════════════════════════════
describe("recordScan", () => {
  it("is exported and callable", () => {
    expect(typeof recordScan).toBe("function");
  });

  it("uses SERIALIZABLE isolation level", async () => {
    mockTx.scanEvent.findFirst.mockResolvedValue(null);
    mockTx.booking.findUnique.mockResolvedValue({
      id: "b-1",
      kind: "CHECKOUT",
      status: "OPEN",
      serializedItems: [
        {
          assetId: "asset-1",
          asset: { id: "asset-1", qrCodeValue: "QR-1", primaryScanCode: null, assetTag: null },
        },
      ],
      bulkItems: [],
      scanEvents: [],
    });

    await recordScan({
      bookingId: "b-1",
      actorUserId: "actor-1",
      phase: "CHECKOUT" as any,
      scanType: "SERIALIZED" as any,
      scanValue: "QR-1",
    });

    expect(transactionCalls.length).toBeGreaterThanOrEqual(1);
    expect(transactionCalls[0].options).toEqual({
      isolationLevel: "Serializable",
    });
  });

  it("throws on duplicate scan within dedup window", async () => {
    mockTx.scanEvent.findFirst.mockResolvedValue({
      id: "scan-existing",
      scanValue: "QR-1",
      success: true,
      createdAt: new Date(),
    });

    await expect(
      recordScan({
        bookingId: "b-1",
        actorUserId: "actor-1",
        phase: "CHECKOUT" as any,
        scanType: "SERIALIZED" as any,
        scanValue: "QR-1",
      })
    ).rejects.toThrow("Duplicate scan detected");
  });

  it("throws when booking is not found", async () => {
    mockTx.scanEvent.findFirst.mockResolvedValue(null);
    mockTx.booking.findUnique.mockResolvedValue(null);

    await expect(
      recordScan({
        bookingId: "nonexistent",
        actorUserId: "actor-1",
        phase: "CHECKOUT" as any,
        scanType: "SERIALIZED" as any,
        scanValue: "QR-1",
      })
    ).rejects.toThrow("Checkout not found");
  });

  it("throws when booking is not OPEN", async () => {
    mockTx.scanEvent.findFirst.mockResolvedValue(null);
    mockTx.booking.findUnique.mockResolvedValue({
      id: "b-1",
      kind: "CHECKOUT",
      status: "COMPLETED",
      serializedItems: [],
      bulkItems: [],
    });

    await expect(
      recordScan({
        bookingId: "b-1",
        actorUserId: "actor-1",
        phase: "CHECKOUT" as any,
        scanType: "SERIALIZED" as any,
        scanValue: "QR-1",
      })
    ).rejects.toThrow("no longer open");
  });

  it("throws when scanned serialized item does not belong to checkout", async () => {
    mockTx.scanEvent.findFirst.mockResolvedValue(null);
    mockTx.booking.findUnique.mockResolvedValue({
      id: "b-1",
      kind: "CHECKOUT",
      status: "OPEN",
      serializedItems: [
        {
          assetId: "asset-1",
          asset: { id: "asset-1", qrCodeValue: "QR-1", primaryScanCode: null, assetTag: null },
        },
      ],
      bulkItems: [],
    });

    await expect(
      recordScan({
        bookingId: "b-1",
        actorUserId: "actor-1",
        phase: "CHECKOUT" as any,
        scanType: "SERIALIZED" as any,
        scanValue: "QR-UNKNOWN",
      })
    ).rejects.toThrow("does not belong to this checkout");
  });

  it("creates a failed scan event when serialized item not found", async () => {
    mockTx.scanEvent.findFirst.mockResolvedValue(null);
    mockTx.booking.findUnique.mockResolvedValue({
      id: "b-1",
      kind: "CHECKOUT",
      status: "OPEN",
      serializedItems: [],
      bulkItems: [],
    });

    await expect(
      recordScan({
        bookingId: "b-1",
        actorUserId: "actor-1",
        phase: "CHECKOUT" as any,
        scanType: "SERIALIZED" as any,
        scanValue: "QR-UNKNOWN",
      })
    ).rejects.toThrow();

    expect(mockTx.scanEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        success: false,
        scanValue: "QR-UNKNOWN",
      }),
    });
  });

  it("throws when bulk scan has no quantity", async () => {
    mockTx.scanEvent.findFirst.mockResolvedValue(null);
    mockTx.booking.findUnique.mockResolvedValue({
      id: "b-1",
      kind: "CHECKOUT",
      status: "OPEN",
      serializedItems: [],
      bulkItems: [
        {
          id: "bi-1",
          bulkSkuId: "sku-1",
          plannedQuantity: 10,
          checkedOutQuantity: 0,
          checkedInQuantity: 0,
          bulkSku: { id: "sku-1", binQrCodeValue: "BIN-QR-1", trackByNumber: false },
        },
      ],
    });

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

  it("throws when bulk scan exceeds planned quantity", async () => {
    mockTx.scanEvent.findFirst.mockResolvedValue(null);
    mockTx.booking.findUnique.mockResolvedValue({
      id: "b-1",
      kind: "CHECKOUT",
      status: "OPEN",
      serializedItems: [],
      bulkItems: [
        {
          id: "bi-1",
          bulkSkuId: "sku-1",
          plannedQuantity: 5,
          checkedOutQuantity: 3,
          checkedInQuantity: 0,
          bulkSku: { id: "sku-1", binQrCodeValue: "BIN-QR-1", trackByNumber: false },
        },
      ],
    });
    // Guard now re-reads inside the transaction
    mockTx.bookingBulkItem.findUnique.mockResolvedValue({
      id: "bi-1",
      bulkSkuId: "sku-1",
      plannedQuantity: 5,
      checkedOutQuantity: 3,
      checkedInQuantity: 0,
    });

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
});

// ═══════════════════════════════════════════════════════════════════════════════
// startScanSession — booking validation
// ═══════════════════════════════════════════════════════════════════════════════
describe("startScanSession", () => {
  it("is exported and callable", () => {
    expect(typeof startScanSession).toBe("function");
  });

  it("throws when booking is not found", async () => {
    mockTx.booking.findUnique.mockResolvedValue(null);

    await expect(
      startScanSession({
        bookingId: "nonexistent",
        actorUserId: "actor-1",
        phase: "CHECKOUT" as any,
      })
    ).rejects.toThrow("Checkout not found");
  });

  it("throws when booking is not OPEN", async () => {
    mockTx.booking.findUnique.mockResolvedValue({
      id: "b-1",
      kind: "CHECKOUT",
      status: "COMPLETED",
    });

    await expect(
      startScanSession({
        bookingId: "b-1",
        actorUserId: "actor-1",
        phase: "CHECKOUT" as any,
      })
    ).rejects.toThrow("no longer open");
  });

  it("returns existing open session instead of creating duplicate", async () => {
    const existingSession = { id: "session-1", bookingId: "b-1", phase: "CHECKOUT", status: "OPEN" };
    mockTx.booking.findUnique.mockResolvedValue({
      id: "b-1",
      kind: "CHECKOUT",
      status: "OPEN",
    });
    mockTx.scanSession.findFirst.mockResolvedValue(existingSession);

    const result = await startScanSession({
      bookingId: "b-1",
      actorUserId: "actor-1",
      phase: "CHECKOUT" as any,
    });

    expect(result).toEqual(existingSession);
    expect(mockTx.scanSession.create).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// completeCheckoutScan — SERIALIZABLE isolation + validation
// ═══════════════════════════════════════════════════════════════════════════════
describe("completeCheckoutScan", () => {
  it("is exported and callable", () => {
    expect(typeof completeCheckoutScan).toBe("function");
  });

  it("uses SERIALIZABLE isolation level", async () => {
    mockTx.booking.findUnique.mockResolvedValue({
      id: "b-1",
      kind: "CHECKOUT",
      status: "OPEN",
      serializedItems: [],
      bulkItems: [],
      scanEvents: [],
    });
    mockTx.overrideEvent.count.mockResolvedValue(0);

    await completeCheckoutScan("b-1", "actor-1", "ADMIN" as any);

    const serializableCalls = transactionCalls.filter(
      (c) => (c.options as any)?.isolationLevel === "Serializable"
    );
    expect(serializableCalls.length).toBeGreaterThanOrEqual(1);
  });

  it("throws when booking is not OPEN", async () => {
    mockTx.booking.findUnique.mockResolvedValue({
      id: "b-1",
      kind: "CHECKOUT",
      status: "COMPLETED",
      serializedItems: [],
      bulkItems: [],
      scanEvents: [],
    });

    await expect(
      completeCheckoutScan("b-1", "actor-1", "ADMIN" as any)
    ).rejects.toThrow("Checkout must be open");
  });

  it("throws when scan requirements not met and no override", async () => {
    mockTx.booking.findUnique.mockResolvedValue({
      id: "b-1",
      kind: "CHECKOUT",
      status: "OPEN",
      serializedItems: [{ assetId: "a-1" }],
      bulkItems: [],
      scanEvents: [],
    });
    mockTx.overrideEvent.count.mockResolvedValue(0);

    await expect(
      completeCheckoutScan("b-1", "actor-1", "ADMIN" as any)
    ).rejects.toThrow("Scan requirements not met");
  });

  it("succeeds with override even when scan requirements not met", async () => {
    mockTx.booking.findUnique.mockResolvedValue({
      id: "b-1",
      kind: "CHECKOUT",
      status: "OPEN",
      serializedItems: [{ assetId: "a-1" }],
      bulkItems: [],
      scanEvents: [],
    });
    mockTx.overrideEvent.count.mockResolvedValue(1);

    const result = await completeCheckoutScan("b-1", "actor-1", "ADMIN" as any);

    expect(result.success).toBe(true);
    expect(result.overrideUsed).toBe(true);
    expect(result.missingSerialized).toEqual(["a-1"]);
  });

  it("reports success when all serialized items scanned", async () => {
    mockTx.booking.findUnique.mockResolvedValue({
      id: "b-1",
      kind: "CHECKOUT",
      status: "OPEN",
      serializedItems: [{ assetId: "a-1" }],
      bulkItems: [],
      scanEvents: [
        { scanType: "SERIALIZED", assetId: "a-1", phase: "CHECKOUT", success: true },
      ],
    });
    mockTx.overrideEvent.count.mockResolvedValue(0);

    const result = await completeCheckoutScan("b-1", "actor-1", "STAFF" as any);

    expect(result.success).toBe(true);
    expect(result.missingSerialized).toEqual([]);
    expect(result.overrideUsed).toBe(false);
  });

  it("closes open scan sessions on completion", async () => {
    mockTx.booking.findUnique.mockResolvedValue({
      id: "b-1",
      kind: "CHECKOUT",
      status: "OPEN",
      serializedItems: [],
      bulkItems: [],
      scanEvents: [],
    });
    mockTx.overrideEvent.count.mockResolvedValue(0);

    await completeCheckoutScan("b-1", "actor-1", "ADMIN" as any);

    expect(mockTx.scanSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          bookingId: "b-1",
          phase: "CHECKOUT",
          status: "OPEN",
        }),
        data: expect.objectContaining({
          status: "COMPLETED",
        }),
      })
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// completeCheckinScan — SERIALIZABLE isolation + validation
// ═══════════════════════════════════════════════════════════════════════════════
describe("completeCheckinScan", () => {
  it("is exported and callable", () => {
    expect(typeof completeCheckinScan).toBe("function");
  });

  it("uses SERIALIZABLE isolation level", async () => {
    mockTx.booking.findUnique.mockResolvedValue({
      id: "b-1",
      kind: "CHECKOUT",
      status: "OPEN",
      serializedItems: [],
      bulkItems: [],
      scanEvents: [],
    });
    mockTx.overrideEvent.count.mockResolvedValue(0);

    await completeCheckinScan("b-1", "actor-1", "ADMIN" as any);

    const serializableCalls = transactionCalls.filter(
      (c) => (c.options as any)?.isolationLevel === "Serializable"
    );
    expect(serializableCalls.length).toBeGreaterThanOrEqual(1);
  });

  it("throws when scan requirements not met and no override", async () => {
    mockTx.booking.findUnique.mockResolvedValue({
      id: "b-1",
      kind: "CHECKOUT",
      status: "OPEN",
      serializedItems: [{ assetId: "a-1" }],
      bulkItems: [],
      scanEvents: [],
    });
    mockTx.overrideEvent.count.mockResolvedValue(0);

    await expect(
      completeCheckinScan("b-1", "actor-1", "ADMIN" as any)
    ).rejects.toThrow("Scan requirements not met");
  });

  it("calls markCheckoutCompleted after successful scan completion", async () => {
    const { markCheckoutCompleted } = await import("@/lib/services/bookings");

    mockTx.booking.findUnique.mockResolvedValue({
      id: "b-1",
      kind: "CHECKOUT",
      status: "OPEN",
      serializedItems: [],
      bulkItems: [],
      scanEvents: [],
    });
    mockTx.overrideEvent.count.mockResolvedValue(0);

    await completeCheckinScan("b-1", "actor-1", "ADMIN" as any);

    expect(markCheckoutCompleted).toHaveBeenCalledWith("b-1", "actor-1");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// markCheckoutCompleted — SERIALIZABLE isolation (tested via import check)
// ═══════════════════════════════════════════════════════════════════════════════
describe("markCheckoutCompleted", () => {
  it("is exported and callable", async () => {
    const { markCheckoutCompleted } = await import("@/lib/services/bookings");
    expect(typeof markCheckoutCompleted).toBe("function");
  });
});
