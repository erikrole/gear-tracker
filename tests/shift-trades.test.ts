import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { makeShiftTrade, makeShiftAssignment, makeShift, makeUser } from "./_helpers/factories";
import { expectSerializableIsolation } from "./_helpers/assert-transaction";

// ─── Transaction tracking ───────────────────────────────────────────────────
const transactionCalls: Array<{ options: unknown }> = [];

// ─── Mock @/lib/db ──────────────────────────────────────────────────────────
vi.mock("@/lib/db", () => {
  const mockTx = {
    shiftTrade: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    shiftAssignment: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  };

  return {
    db: {
      $transaction: vi.fn(async (fn: (tx: typeof mockTx) => Promise<unknown>, options?: unknown) => {
        transactionCalls.push({ options });
        return fn(mockTx);
      }),
      shiftTrade: {
        findMany: vi.fn(),
        count: vi.fn(),
      },
      _mockTx: mockTx,
    },
  };
});

// ─── Mock shift-assignments ─────────────────────────────────────────────────
vi.mock("@/lib/services/shift-assignments", () => ({
  checkTimeConflict: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/services/shift-trade-emails", () => ({
  sendShiftTradeEmail: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/lib/badges", () => ({
  badges: {
    onTradeCompleted: vi.fn().mockResolvedValue(undefined),
  },
}));

import { db } from "@/lib/db";
import { badges } from "@/lib/badges";
import { checkTimeConflict } from "@/lib/services/shift-assignments";
import { sendShiftTradeEmail } from "@/lib/services/shift-trade-emails";
import { postTrade, claimTrade, approveTrade, declineTrade, cancelTrade, listTrades } from "@/lib/services/shift-trades";

const mockTx = (db as any)._mockTx;
const mockDb = db as any;

beforeEach(() => {
  transactionCalls.length = 0;
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-03-01T12:00:00.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

// ═════════════════════════════════════════════════════════════════════════════
// postTrade
// ═════════════════════════════════════════════════════════════════════════════
describe("postTrade", () => {
  it("creates a trade for an owned active assignment", async () => {
    const userId = "user-1";
    const assignment = {
      ...makeShiftAssignment({ userId }),
      shift: { ...makeShift(), shiftGroup: { isPremier: false } },
    };
    mockTx.shiftAssignment.findUnique.mockResolvedValue(assignment);
    mockTx.shiftTrade.findFirst.mockResolvedValue(null);
    mockTx.shiftTrade.create.mockResolvedValue({ id: "trade-1" });

    await postTrade(assignment.id, userId, "Need swap");

    expect(mockTx.shiftTrade.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          shiftAssignmentId: assignment.id,
          postedByUserId: userId,
          requiresApproval: false,
          notes: "Need swap",
        }),
      })
    );
  });

  it("throws 404 when assignment not found", async () => {
    mockTx.shiftAssignment.findUnique.mockResolvedValue(null);
    await expect(postTrade("bad-id", "user-1")).rejects.toThrow("Assignment not found");
  });

  it("throws 403 when user doesn't own the assignment", async () => {
    const assignment = {
      ...makeShiftAssignment({ userId: "other-user" }),
      shift: { ...makeShift(), shiftGroup: { isPremier: false } },
    };
    mockTx.shiftAssignment.findUnique.mockResolvedValue(assignment);
    await expect(postTrade(assignment.id, "user-1")).rejects.toThrow("only trade your own");
  });

  it("throws 400 for inactive assignment status", async () => {
    const assignment = {
      ...makeShiftAssignment({ userId: "user-1", status: "SWAPPED" }),
      shift: { ...makeShift(), shiftGroup: { isPremier: false } },
    };
    mockTx.shiftAssignment.findUnique.mockResolvedValue(assignment);
    await expect(postTrade(assignment.id, "user-1")).rejects.toThrow("Only active assignments");
  });

  it("throws 409 when assignment already has open trade", async () => {
    const assignment = {
      ...makeShiftAssignment({ userId: "user-1" }),
      shift: { ...makeShift(), shiftGroup: { isPremier: false } },
    };
    mockTx.shiftAssignment.findUnique.mockResolvedValue(assignment);
    mockTx.shiftTrade.findFirst.mockResolvedValue({ id: "existing-trade" });
    await expect(postTrade(assignment.id, "user-1")).rejects.toThrow("already has an open trade");
  });

  it("throws 400 when the shift has already started", async () => {
    const assignment = {
      ...makeShiftAssignment({ userId: "user-1" }),
      shift: {
        ...makeShift({
          startsAt: new Date("2026-03-01T11:00:00.000Z"),
          endsAt: new Date("2026-03-01T14:00:00.000Z"),
        }),
        shiftGroup: { isPremier: false },
      },
    };
    mockTx.shiftAssignment.findUnique.mockResolvedValue(assignment);

    await expect(postTrade(assignment.id, "user-1")).rejects.toThrow("already started");
    expect(mockTx.shiftTrade.create).not.toHaveBeenCalled();
  });

  it("sets requiresApproval=true for premier shift groups", async () => {
    const userId = "user-1";
    const assignment = {
      ...makeShiftAssignment({ userId }),
      shift: { ...makeShift(), shiftGroup: { isPremier: true } },
    };
    mockTx.shiftAssignment.findUnique.mockResolvedValue(assignment);
    mockTx.shiftTrade.findFirst.mockResolvedValue(null);
    mockTx.shiftTrade.create.mockResolvedValue({ id: "trade-1" });

    await postTrade(assignment.id, userId);

    expect(mockTx.shiftTrade.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ requiresApproval: true }),
      })
    );
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// claimTrade
// ═════════════════════════════════════════════════════════════════════════════
describe("claimTrade", () => {
  const shift = makeShift({ area: "Field" });

  function openTrade(overrides: Record<string, unknown> = {}) {
    return {
      ...makeShiftTrade({ postedByUserId: "poster-1" }),
      shiftAssignment: {
        ...makeShiftAssignment(),
        shift: {
          ...shift,
          shiftGroup: { event: { summary: "Wisconsin vs Iowa" } },
        },
      },
      ...overrides,
    };
  }

  // ── REGRESSION: claimTrade must use SERIALIZABLE to prevent double-claim ──
  it("uses SERIALIZABLE isolation to prevent double-claim", async () => {
    const trade = openTrade();
    mockTx.shiftTrade.findUnique.mockResolvedValue(trade);
    mockTx.user.findUnique.mockResolvedValue(makeUser({ primaryArea: "Field" }));
    mockTx.shiftAssignment.findUnique.mockResolvedValue({ ...trade.shiftAssignment });
    mockTx.shiftAssignment.update.mockResolvedValue({});
    mockTx.shiftAssignment.create.mockResolvedValue({});
    mockTx.shiftTrade.update.mockResolvedValue({ ...trade, claimedByUserId: "claimer-1", status: "COMPLETED" });

    await claimTrade(trade.id, "claimer-1");

    expectSerializableIsolation(transactionCalls, 0);
  });

  it("throws 404 when trade not found", async () => {
    mockTx.shiftTrade.findUnique.mockResolvedValue(null);
    await expect(claimTrade("bad-id", "user-1")).rejects.toThrow("Trade not found");
  });

  it("throws 409 when trade is not OPEN", async () => {
    mockTx.shiftTrade.findUnique.mockResolvedValue(openTrade({ status: "COMPLETED" }));
    await expect(claimTrade("trade-1", "user-1")).rejects.toThrow("no longer open");
  });

  it("throws 400 when claiming own trade", async () => {
    mockTx.shiftTrade.findUnique.mockResolvedValue(openTrade({ postedByUserId: "user-1" }));
    await expect(claimTrade("trade-1", "user-1")).rejects.toThrow("cannot claim your own");
  });

  it("calls checkTimeConflict for the claimant", async () => {
    const trade = openTrade();
    mockTx.shiftTrade.findUnique.mockResolvedValue(trade);
    mockTx.user.findUnique.mockResolvedValue(makeUser({ primaryArea: "Field" }));
    mockTx.shiftAssignment.findUnique.mockResolvedValue({ ...trade.shiftAssignment });
    mockTx.shiftAssignment.update.mockResolvedValue({});
    mockTx.shiftAssignment.create.mockResolvedValue({});
    mockTx.shiftTrade.update.mockResolvedValue({ ...trade, claimedByUserId: "claimer-1", status: "COMPLETED" });

    await claimTrade(trade.id, "claimer-1");

    expect(checkTimeConflict).toHaveBeenCalledWith(
      mockTx, "claimer-1", shift.startsAt, shift.endsAt
    );
  });

  it("throws 400 when area mismatch", async () => {
    mockTx.shiftTrade.findUnique.mockResolvedValue(openTrade());
    mockTx.user.findUnique.mockResolvedValue(makeUser({ primaryArea: "Courts" }));
    await expect(claimTrade("trade-1", "claimer-1")).rejects.toThrow("does not match");
  });

  it("throws 400 when claiming after the shift has started", async () => {
    mockTx.shiftTrade.findUnique.mockResolvedValue(openTrade({
      shiftAssignment: {
        ...makeShiftAssignment(),
        shift: {
          ...makeShift({
            area: "Field",
            startsAt: new Date("2026-03-01T11:00:00.000Z"),
            endsAt: new Date("2026-03-01T14:00:00.000Z"),
          }),
          shiftGroup: { event: { summary: "Wisconsin vs Iowa" } },
        },
      },
    }));

    await expect(claimTrade("trade-1", "claimer-1")).rejects.toThrow("already started");
    expect(checkTimeConflict).not.toHaveBeenCalled();
    expect(mockTx.shiftTrade.update).not.toHaveBeenCalled();
  });

  it("sets CLAIMED status when requiresApproval=true", async () => {
    const trade = openTrade({ requiresApproval: true });
    mockTx.shiftTrade.findUnique.mockResolvedValue(trade);
    mockTx.user.findUnique.mockResolvedValue(makeUser({ primaryArea: "Field" }));
    mockTx.shiftTrade.update.mockResolvedValue({ ...trade, status: "CLAIMED" });

    await claimTrade(trade.id, "claimer-1");

    expect(mockTx.shiftTrade.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "CLAIMED", claimedByUserId: "claimer-1" }),
      })
    );
    expect(sendShiftTradeEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "poster-1",
        title: "Your trade was claimed",
        eventSummary: "Wisconsin vs Iowa",
        area: "Field",
      })
    );
  });

  it("executes swap immediately when requiresApproval=false", async () => {
    const trade = openTrade({ requiresApproval: false });
    mockTx.shiftTrade.findUnique.mockResolvedValue(trade);
    mockTx.user.findUnique.mockResolvedValue(makeUser({ primaryArea: "Field" }));
    mockTx.shiftAssignment.findUnique.mockResolvedValue({ ...trade.shiftAssignment });
    mockTx.shiftAssignment.update.mockResolvedValue({});
    mockTx.shiftAssignment.create.mockResolvedValue({});
    mockTx.shiftTrade.update.mockResolvedValue({ ...trade, claimedByUserId: "claimer-1", status: "COMPLETED" });

    await claimTrade(trade.id, "claimer-1");

    expect(mockTx.shiftAssignment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: "SWAPPED" },
      })
    );
    expect(mockTx.shiftAssignment.create).toHaveBeenCalled();
    expect(mockTx.shiftTrade.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "COMPLETED" }),
      })
    );
    expect(sendShiftTradeEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "poster-1",
        title: "Your trade is done",
        eventSummary: "Wisconsin vs Iowa",
        area: "Field",
      })
    );
    expect(badges.onTradeCompleted).toHaveBeenCalledWith({
      userId: "poster-1",
      tradeId: trade.id,
      sourceKey: trade.id,
    });
    expect(badges.onTradeCompleted).toHaveBeenCalledWith({
      userId: "claimer-1",
      tradeId: trade.id,
      sourceKey: trade.id,
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// approveTrade
// ═════════════════════════════════════════════════════════════════════════════
describe("approveTrade", () => {
  it("executes swap on approved trade", async () => {
    const shift = makeShift({ area: "Field" });
    const trade = {
      ...makeShiftTrade({ status: "CLAIMED", claimedByUserId: "claimer-1", postedByUserId: "poster-1" }),
      shiftAssignment: {
        ...makeShiftAssignment(),
        shift: {
          ...shift,
          shiftGroup: { event: { summary: "Wisconsin vs Iowa" } },
        },
      },
    };
    const assignmentWithShift = {
      ...trade.shiftAssignment,
      shift,
    };
    mockTx.shiftTrade.findUnique.mockResolvedValue(trade);
    mockTx.shiftAssignment.findUnique.mockResolvedValue(assignmentWithShift);
    mockTx.shiftAssignment.update.mockResolvedValue({});
    mockTx.shiftAssignment.create.mockResolvedValue({});
    mockTx.shiftTrade.update.mockResolvedValue({ ...trade, status: "COMPLETED" });

    await approveTrade(trade.id);

    expect(mockTx.shiftTrade.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "COMPLETED" }),
      })
    );
    expect(sendShiftTradeEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "claimer-1",
        title: "Trade approved",
        eventSummary: "Wisconsin vs Iowa",
        area: "Field",
      })
    );
    expect(badges.onTradeCompleted).toHaveBeenCalledWith({
      userId: "poster-1",
      tradeId: trade.id,
      sourceKey: trade.id,
    });
    expect(badges.onTradeCompleted).toHaveBeenCalledWith({
      userId: "claimer-1",
      tradeId: trade.id,
      sourceKey: trade.id,
    });
  });

  it("throws 400 when trade is not CLAIMED", async () => {
    mockTx.shiftTrade.findUnique.mockResolvedValue({
      ...makeShiftTrade({ status: "OPEN" }),
      shiftAssignment: { ...makeShiftAssignment(), shift: makeShift() },
    });
    await expect(approveTrade("trade-1")).rejects.toThrow("Only claimed trades");
  });

  it("throws 400 when no claimer", async () => {
    mockTx.shiftTrade.findUnique.mockResolvedValue({
      ...makeShiftTrade({ status: "CLAIMED", claimedByUserId: null }),
      shiftAssignment: { ...makeShiftAssignment(), shift: makeShift() },
    });
    await expect(approveTrade("trade-1")).rejects.toThrow("no claimer");
  });

  it("throws 400 when approving after the shift has started", async () => {
    const trade = {
      ...makeShiftTrade({ status: "CLAIMED", claimedByUserId: "claimer-1", postedByUserId: "poster-1" }),
      shiftAssignment: {
        ...makeShiftAssignment(),
        shift: {
          ...makeShift({
            startsAt: new Date("2026-03-01T11:00:00.000Z"),
            endsAt: new Date("2026-03-01T14:00:00.000Z"),
          }),
          shiftGroup: { event: { summary: "Wisconsin vs Iowa" } },
        },
      },
    };
    mockTx.shiftTrade.findUnique.mockResolvedValue(trade);

    await expect(approveTrade(trade.id)).rejects.toThrow("already started");
    expect(mockTx.shiftAssignment.update).not.toHaveBeenCalled();
    expect(mockTx.shiftTrade.update).not.toHaveBeenCalled();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// declineTrade
// ═════════════════════════════════════════════════════════════════════════════
describe("declineTrade", () => {
  it("resets claimed trade back to OPEN", async () => {
    const shift = makeShift({ area: "Field" });
    const trade = {
      ...makeShiftTrade({ status: "CLAIMED", claimedByUserId: "claimer-1" }),
      shiftAssignment: {
        ...makeShiftAssignment(),
        shift: {
          ...shift,
          shiftGroup: { event: { summary: "Wisconsin vs Iowa" } },
        },
      },
    };
    mockTx.shiftTrade.findUnique.mockResolvedValue(trade);
    mockTx.shiftTrade.update.mockResolvedValue({ ...trade, status: "OPEN" });

    await declineTrade(trade.id);

    expect(mockTx.shiftTrade.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "OPEN",
          claimedByUserId: null,
          claimedAt: null,
        }),
      })
    );
    expect(sendShiftTradeEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "claimer-1",
        title: "Trade claim declined",
        eventSummary: "Wisconsin vs Iowa",
        area: "Field",
      })
    );
  });

  it("throws 400 when trade is not CLAIMED", async () => {
    mockTx.shiftTrade.findUnique.mockResolvedValue({
      ...makeShiftTrade({ status: "OPEN" }),
      shiftAssignment: { ...makeShiftAssignment(), shift: makeShift() },
    });
    await expect(declineTrade("trade-1")).rejects.toThrow("Only claimed trades");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// cancelTrade
// ═════════════════════════════════════════════════════════════════════════════
describe("cancelTrade", () => {
  it("cancels own OPEN trade", async () => {
    const trade = makeShiftTrade({ postedByUserId: "user-1", status: "OPEN" });
    mockTx.shiftTrade.findUnique.mockResolvedValue(trade);
    mockTx.shiftTrade.update.mockResolvedValue({ ...trade, status: "CANCELLED" });

    await cancelTrade(trade.id, "user-1");

    expect(mockTx.shiftTrade.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "CANCELLED" }),
      })
    );
  });

  it("cancels own CLAIMED trade", async () => {
    const trade = makeShiftTrade({ postedByUserId: "user-1", status: "CLAIMED" });
    mockTx.shiftTrade.findUnique.mockResolvedValue(trade);
    mockTx.shiftTrade.update.mockResolvedValue({ ...trade, status: "CANCELLED" });

    await cancelTrade(trade.id, "user-1");

    expect(mockTx.shiftTrade.update).toHaveBeenCalled();
  });

  it("throws 403 when cancelling someone else's trade", async () => {
    const trade = makeShiftTrade({ postedByUserId: "other-user", status: "OPEN" });
    mockTx.shiftTrade.findUnique.mockResolvedValue(trade);
    await expect(cancelTrade(trade.id, "user-1")).rejects.toThrow("only cancel your own");
  });

  it("throws 400 when trade is COMPLETED", async () => {
    const trade = makeShiftTrade({ postedByUserId: "user-1", status: "COMPLETED" });
    mockTx.shiftTrade.findUnique.mockResolvedValue(trade);
    await expect(cancelTrade(trade.id, "user-1")).rejects.toThrow("cannot be cancelled");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// listTrades
// ═════════════════════════════════════════════════════════════════════════════
describe("listTrades", () => {
  it("hides stale open trades from the default board query", async () => {
    mockDb.shiftTrade.findMany.mockResolvedValue([]);
    mockDb.shiftTrade.count.mockResolvedValue(0);

    await listTrades({ limit: 100, offset: 0 });

    expect(mockDb.shiftTrade.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            {
              OR: [
                { status: { notIn: ["OPEN", "CLAIMED"] } },
                { shiftAssignment: { shift: { startsAt: { gt: new Date("2026-03-01T12:00:00.000Z") } } } },
              ],
            },
          ]),
        }),
      }),
    );
  });

  it("hides stale trades for explicit OPEN queries", async () => {
    mockDb.shiftTrade.findMany.mockResolvedValue([]);
    mockDb.shiftTrade.count.mockResolvedValue(0);

    await listTrades({ status: "OPEN", area: "VIDEO", limit: 100, offset: 0 });

    expect(mockDb.shiftTrade.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "OPEN",
          AND: expect.arrayContaining([
            { shiftAssignment: { shift: { area: "VIDEO" } } },
            { shiftAssignment: { shift: { startsAt: { gt: new Date("2026-03-01T12:00:00.000Z") } } } },
          ]),
        }),
      }),
    );
  });
});
