import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { makeBooking, makeSerializedItem, makeBulkItem } from "./_helpers/factories";
import { expectSerializableIsolation } from "./_helpers/assert-transaction";

// ─── Transaction tracking ───────────────────────────────────────────────────
const transactionCalls: Array<{ options: unknown }> = [];

// ─── Mock @/lib/db ──────────────────────────────────────────────────────────
vi.mock("@/lib/db", () => {
  const mockTx = {
    booking: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), update: vi.fn() },
    assetAllocation: { updateMany: vi.fn() },
    auditLog: { create: vi.fn() },
  };

  return {
    db: {
      $transaction: vi.fn(async (fn: (tx: typeof mockTx) => Promise<unknown>, options?: unknown) => {
        transactionCalls.push({ options });
        return fn(mockTx);
      }),
      _mockTx: mockTx,
    },
  };
});

vi.mock("@/lib/services/availability", () => ({
  checkAvailability: vi.fn().mockResolvedValue({
    conflicts: [],
    shortages: [],
    unavailableAssets: [],
  }),
}));

import { db } from "@/lib/db";
import { checkAvailability } from "@/lib/services/availability";
import { extendBooking } from "@/lib/services/bookings";

const mockTx = (db as any)._mockTx;

const now = new Date("2026-04-01T12:00:00Z");
const currentEnd = new Date("2026-04-01T17:00:00Z");
const newEnd = new Date("2026-04-02T17:00:00Z");

function openBooking(overrides: Record<string, unknown> = {}) {
  return {
    id: "b-1",
    kind: "CHECKOUT",
    status: "OPEN",
    locationId: "loc-1",
    startsAt: new Date("2026-04-01T08:00:00Z"),
    endsAt: currentEnd,
    serializedItems: [{ assetId: "a-1" }],
    bulkItems: [{ bulkSkuId: "sku-1", plannedQuantity: 5 }],
    ...overrides,
  };
}

beforeEach(() => {
  vi.useFakeTimers({ now });
  transactionCalls.length = 0;
  mockTx.booking.findUnique.mockResolvedValue(openBooking());
  mockTx.booking.findUniqueOrThrow.mockResolvedValue({ id: "b-1" });
  mockTx.booking.update.mockResolvedValue({});
  mockTx.assetAllocation.updateMany.mockResolvedValue({});
  mockTx.auditLog.create.mockResolvedValue({});
  vi.mocked(checkAvailability).mockResolvedValue({
    conflicts: [],
    shortages: [],
    unavailableAssets: [],
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("extendBooking", () => {
  it("uses SERIALIZABLE isolation", async () => {
    await extendBooking("b-1", "actor-1", newEnd);
    expectSerializableIsolation(transactionCalls, 0);
  });

  it("extends booking and allocation end dates", async () => {
    await extendBooking("b-1", "actor-1", newEnd);

    expect(mockTx.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "b-1" },
        data: { endsAt: newEnd },
      })
    );
    expect(mockTx.assetAllocation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { bookingId: "b-1", active: true },
        data: { endsAt: newEnd },
      })
    );
  });

  it("creates audit log with before/after", async () => {
    await extendBooking("b-1", "actor-1", newEnd);

    expect(mockTx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "extended",
          beforeJson: { endsAt: currentEnd },
          afterJson: { endsAt: newEnd },
        }),
      })
    );
  });

  it("throws 404 when booking not found", async () => {
    mockTx.booking.findUnique.mockResolvedValue(null);
    await expect(extendBooking("bad-id", "actor-1", newEnd)).rejects.toThrow("Booking not found");
  });

  it("throws 400 for completed bookings", async () => {
    mockTx.booking.findUnique.mockResolvedValue(openBooking({ status: "COMPLETED" }));
    await expect(extendBooking("b-1", "actor-1", newEnd)).rejects.toThrow("Can only extend active");
  });

  it("throws 400 for cancelled bookings", async () => {
    mockTx.booking.findUnique.mockResolvedValue(openBooking({ status: "CANCELLED" }));
    await expect(extendBooking("b-1", "actor-1", newEnd)).rejects.toThrow("Can only extend active");
  });

  it("throws 400 when new end date is not later than current", async () => {
    const earlierEnd = new Date("2026-04-01T10:00:00Z");
    await expect(extendBooking("b-1", "actor-1", earlierEnd)).rejects.toThrow("must be later");
  });

  it("throws 400 when new end date is in the past", async () => {
    mockTx.booking.findUnique.mockResolvedValue(openBooking({
      endsAt: new Date("2020-01-01"),
    }));
    const pastDate = new Date("2020-01-02");
    await expect(extendBooking("b-1", "actor-1", pastDate)).rejects.toThrow("must be in the future");
  });

  it("throws 409 on availability conflicts in extended window", async () => {
    vi.mocked(checkAvailability).mockResolvedValueOnce({
      conflicts: [{ assetId: "a-1", conflictingBookingId: "b-other", startsAt: new Date(), endsAt: new Date() }],
      shortages: [],
      unavailableAssets: [],
    });

    await expect(extendBooking("b-1", "actor-1", newEnd)).rejects.toThrow("Conflicts");
  });

  it("checks availability with excludeBookingId", async () => {
    await extendBooking("b-1", "actor-1", newEnd);

    expect(checkAvailability).toHaveBeenCalledWith(
      mockTx,
      expect.objectContaining({ excludeBookingId: "b-1" })
    );
  });

  it("works with BOOKED status", async () => {
    mockTx.booking.findUnique.mockResolvedValue(openBooking({ status: "BOOKED" }));
    await expect(extendBooking("b-1", "actor-1", newEnd)).resolves.toBeDefined();
  });
});
