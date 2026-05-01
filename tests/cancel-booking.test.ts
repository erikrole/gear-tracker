import { describe, it, expect, vi, beforeEach } from "vitest";
import { expectSerializableIsolation } from "./_helpers/assert-transaction";

// ─── Transaction tracking ───────────────────────────────────────────────────
const transactionCalls: Array<{ options: unknown }> = [];

// ─── Mock @/lib/db ──────────────────────────────────────────────────────────
vi.mock("@/lib/db", () => {
  const mockTx = {
    booking: { findUnique: vi.fn(), update: vi.fn() },
    assetAllocation: { updateMany: vi.fn() },
    scanSession: { updateMany: vi.fn() },
    auditLog: { create: vi.fn() },
    user: { findUnique: vi.fn().mockResolvedValue({ role: "ADMIN" }) },
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
  checkAvailability: vi.fn().mockResolvedValue({ conflicts: [], shortages: [], unavailableAssets: [] }),
}));

import { db } from "@/lib/db";
import { cancelBooking, cancelReservation } from "@/lib/services/bookings";

const mockTx = (db as any)._mockTx;

beforeEach(() => {
  vi.clearAllMocks();
  transactionCalls.length = 0;
  mockTx.booking.update.mockResolvedValue({});
  mockTx.assetAllocation.updateMany.mockResolvedValue({});
  mockTx.scanSession.updateMany.mockResolvedValue({});
  mockTx.auditLog.create.mockResolvedValue({});
});

// ═══════════════════════════════════════════════════════════════════════════════
// cancelBooking
// ═══════════════════════════════════════════════════════════════════════════════
describe("cancelBooking", () => {
  it("uses SERIALIZABLE isolation", async () => {
    mockTx.booking.findUnique.mockResolvedValue({
      id: "b-1", kind: "CHECKOUT", status: "OPEN",
    });

    await cancelBooking("b-1", "actor-1");

    expectSerializableIsolation(transactionCalls, 0);
  });

  it("sets status to CANCELLED and deactivates allocations", async () => {
    mockTx.booking.findUnique.mockResolvedValue({
      id: "b-1", kind: "CHECKOUT", status: "OPEN",
    });

    const result = await cancelBooking("b-1", "actor-1");

    expect(result.success).toBe(true);
    expect(mockTx.booking.update).toHaveBeenCalledWith({
      where: { id: "b-1" },
      data: { status: "CANCELLED" },
    });
    expect(mockTx.assetAllocation.updateMany).toHaveBeenCalledWith({
      where: { bookingId: "b-1" },
      data: { active: false },
    });
  });

  it("cancels open scan sessions", async () => {
    mockTx.booking.findUnique.mockResolvedValue({
      id: "b-1", kind: "CHECKOUT", status: "OPEN",
    });

    await cancelBooking("b-1", "actor-1");

    expect(mockTx.scanSession.updateMany).toHaveBeenCalledWith({
      where: { bookingId: "b-1", status: "OPEN" },
      data: { status: "CANCELLED" },
    });
  });

  it("creates audit log entry", async () => {
    mockTx.booking.findUnique.mockResolvedValue({
      id: "b-1", kind: "CHECKOUT", status: "OPEN",
    });

    await cancelBooking("b-1", "actor-1");

    expect(mockTx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorUserId: "actor-1",
        entityType: "booking",
        entityId: "b-1",
        action: "cancelled",
      }),
    });
  });

  it("throws 404 when booking not found", async () => {
    mockTx.booking.findUnique.mockResolvedValue(null);
    await expect(cancelBooking("bad-id", "actor-1")).rejects.toThrow("Booking not found");
  });

  it("throws 400 when booking is already cancelled", async () => {
    mockTx.booking.findUnique.mockResolvedValue({
      id: "b-1", kind: "CHECKOUT", status: "CANCELLED",
    });
    await expect(cancelBooking("b-1", "actor-1")).rejects.toThrow("already cancelled");
  });

  it("throws 400 when booking is completed", async () => {
    mockTx.booking.findUnique.mockResolvedValue({
      id: "b-1", kind: "CHECKOUT", status: "COMPLETED",
    });
    await expect(cancelBooking("b-1", "actor-1")).rejects.toThrow("Cannot cancel a completed");
  });

  it("works for BOOKED reservations too", async () => {
    mockTx.booking.findUnique.mockResolvedValue({
      id: "b-1", kind: "RESERVATION", status: "BOOKED",
    });

    const result = await cancelBooking("b-1", "actor-1");
    expect(result.success).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// cancelReservation
// ═══════════════════════════════════════════════════════════════════════════════
describe("cancelReservation", () => {
  it("uses SERIALIZABLE isolation", async () => {
    mockTx.booking.findUnique.mockResolvedValue({
      id: "r-1", kind: "RESERVATION", status: "BOOKED",
    });

    await cancelReservation("r-1", "actor-1");

    expectSerializableIsolation(transactionCalls, 0);
  });

  it("cancels a BOOKED reservation", async () => {
    mockTx.booking.findUnique.mockResolvedValue({
      id: "r-1", kind: "RESERVATION", status: "BOOKED",
    });

    const result = await cancelReservation("r-1", "actor-1");

    expect(result.success).toBe(true);
    expect(mockTx.booking.update).toHaveBeenCalledWith({
      where: { id: "r-1" },
      data: { status: "CANCELLED" },
    });
  });

  it("throws 404 when not found", async () => {
    mockTx.booking.findUnique.mockResolvedValue(null);
    await expect(cancelReservation("bad-id", "actor-1")).rejects.toThrow("Reservation not found");
  });

  it("throws 400 when booking is a CHECKOUT", async () => {
    mockTx.booking.findUnique.mockResolvedValue({
      id: "b-1", kind: "CHECKOUT", status: "OPEN",
    });
    await expect(cancelReservation("b-1", "actor-1")).rejects.toThrow("Only reservations");
  });

  it("deactivates allocations and cancels scan sessions", async () => {
    mockTx.booking.findUnique.mockResolvedValue({
      id: "r-1", kind: "RESERVATION", status: "BOOKED",
    });

    await cancelReservation("r-1", "actor-1");

    expect(mockTx.assetAllocation.updateMany).toHaveBeenCalledWith({
      where: { bookingId: "r-1" },
      data: { active: false },
    });
    expect(mockTx.scanSession.updateMany).toHaveBeenCalledWith({
      where: { bookingId: "r-1", status: "OPEN" },
      data: { status: "CANCELLED" },
    });
  });
});
