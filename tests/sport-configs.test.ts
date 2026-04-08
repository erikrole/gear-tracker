import { describe, it, expect, vi, beforeEach } from "vitest";
import { expectSerializableIsolation } from "./_helpers/assert-transaction";

// ─── Transaction tracking ───────────────────────────────────────────────────
const transactionCalls: Array<{ options: unknown }> = [];

// ─── Mock @/lib/db ──────────────────────────────────────────────────────────
vi.mock("@/lib/db", () => {
  const mockTx = {
    sportConfig: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
    sportShiftConfig: {
      upsert: vi.fn(),
    },
    studentSportAssignment: {
      findMany: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
      delete: vi.fn(),
    },
  };

  return {
    db: {
      $transaction: vi.fn(async (fn: (tx: typeof mockTx) => Promise<unknown>, options?: unknown) => {
        transactionCalls.push({ options });
        return fn(mockTx);
      }),
      // Direct access for non-transactional queries
      sportConfig: mockTx.sportConfig,
      sportShiftConfig: mockTx.sportShiftConfig,
      studentSportAssignment: mockTx.studentSportAssignment,
      _mockTx: mockTx,
    },
  };
});

import { db } from "@/lib/db";
import {
  getAllSportConfigs,
  getSportConfig,
  upsertSportConfig,
  toggleSportConfig,
  getSportRoster,
  addToRoster,
  removeFromRoster,
  bulkAddToRoster,
} from "@/lib/services/sport-configs";

const mockTx = (db as any)._mockTx;

beforeEach(() => {
  transactionCalls.length = 0;
});

// ═════════════════════════════════════════════════════════════════════════════
// getAllSportConfigs
// ═════════════════════════════════════════════════════════════════════════════
describe("getAllSportConfigs", () => {
  it("returns all sport configs ordered by sportCode", async () => {
    const configs = [
      { id: "sc-1", sportCode: "FB", active: true, shiftConfigs: [] },
      { id: "sc-2", sportCode: "MBB", active: true, shiftConfigs: [] },
    ];
    vi.mocked(db.sportConfig.findMany).mockResolvedValue(configs as any);

    const result = await getAllSportConfigs();

    expect(result).toEqual(configs);
    expect(db.sportConfig.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: { shiftConfigs: true },
        orderBy: { sportCode: "asc" },
      })
    );
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// getSportConfig
// ═════════════════════════════════════════════════════════════════════════════
describe("getSportConfig", () => {
  it("returns a single sport config by sportCode", async () => {
    const config = { id: "sc-1", sportCode: "FB", active: true, shiftConfigs: [] };
    vi.mocked(db.sportConfig.findUnique).mockResolvedValue(config as any);

    const result = await getSportConfig("FB");

    expect(result).toEqual(config);
    expect(db.sportConfig.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { sportCode: "FB" },
      })
    );
  });

  it("returns null when sport config not found", async () => {
    vi.mocked(db.sportConfig.findUnique).mockResolvedValue(null);

    const result = await getSportConfig("NONEXISTENT");

    expect(result).toBeNull();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// upsertSportConfig
// ═════════════════════════════════════════════════════════════════════════════
describe("upsertSportConfig", () => {
  it("creates a new sport config with shift configs", async () => {
    const config = { id: "sc-1", sportCode: "FB", active: true };
    mockTx.sportConfig.upsert.mockResolvedValue(config);
    mockTx.sportShiftConfig.upsert.mockResolvedValue({});
    mockTx.sportConfig.findUnique.mockResolvedValue({
      ...config,
      shiftConfigs: [{ area: "FIELD", homeCount: 4, awayCount: 2 }],
    });

    const result = await upsertSportConfig("FB", true, [
      { area: "FIELD" as any, homeCount: 4, awayCount: 2 },
    ]);

    expect(mockTx.sportConfig.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { sportCode: "FB" },
      })
    );
    expect(mockTx.sportShiftConfig.upsert).toHaveBeenCalledTimes(1);
    expect(result!.shiftConfigs).toHaveLength(1);
  });

  it("uses SERIALIZABLE isolation", async () => {
    mockTx.sportConfig.upsert.mockResolvedValue({ id: "sc-1" });
    mockTx.sportConfig.findUnique.mockResolvedValue({ id: "sc-1", shiftConfigs: [] });

    await upsertSportConfig("FB", true, []);

    expectSerializableIsolation(transactionCalls, 0);
  });

  it("passes shiftStartOffset and shiftEndOffset when provided", async () => {
    mockTx.sportConfig.upsert.mockResolvedValue({ id: "sc-1" });
    mockTx.sportConfig.findUnique.mockResolvedValue({ id: "sc-1", shiftConfigs: [] });

    await upsertSportConfig("FB", true, [], -60, 30);

    expect(mockTx.sportConfig.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          shiftStartOffset: -60,
          shiftEndOffset: 30,
        }),
        update: expect.objectContaining({
          shiftStartOffset: -60,
          shiftEndOffset: 30,
        }),
      })
    );
  });

  it("upserts multiple shift config areas", async () => {
    mockTx.sportConfig.upsert.mockResolvedValue({ id: "sc-1" });
    mockTx.sportShiftConfig.upsert.mockResolvedValue({});
    mockTx.sportConfig.findUnique.mockResolvedValue({ id: "sc-1", shiftConfigs: [] });

    await upsertSportConfig("FB", true, [
      { area: "FIELD" as any, homeCount: 4, awayCount: 2 },
      { area: "COURT" as any, homeCount: 3, awayCount: 1 },
    ]);

    expect(mockTx.sportShiftConfig.upsert).toHaveBeenCalledTimes(2);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// toggleSportConfig
// ═════════════════════════════════════════════════════════════════════════════
describe("toggleSportConfig", () => {
  it("toggles a sport config active state", async () => {
    vi.mocked(db.sportConfig.update).mockResolvedValue({
      id: "sc-1",
      sportCode: "FB",
      active: false,
      shiftConfigs: [],
    } as any);

    const result = await toggleSportConfig("FB", false);

    expect(db.sportConfig.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { sportCode: "FB" },
        data: { active: false },
      })
    );
    expect(result.active).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Roster operations
// ═════════════════════════════════════════════════════════════════════════════
describe("getSportRoster", () => {
  it("returns roster with user details", async () => {
    vi.mocked(db.studentSportAssignment.findMany).mockResolvedValue([
      {
        id: "ssa-1",
        userId: "u-1",
        sportCode: "FB",
        user: { id: "u-1", name: "Student 1", email: "s1@uw.edu", role: "STUDENT", primaryArea: null },
        createdAt: new Date("2026-01-01"),
      },
    ] as any);

    const result = await getSportRoster("FB");

    expect(result).toHaveLength(1);
    expect(result[0].userId).toBe("u-1");
    expect(result[0].user.name).toBe("Student 1");
  });
});

describe("addToRoster", () => {
  it("creates a sport assignment", async () => {
    vi.mocked(db.studentSportAssignment.create).mockResolvedValue({
      id: "ssa-new",
      userId: "u-1",
      sportCode: "FB",
      user: { id: "u-1", name: "Student 1" },
    } as any);

    const result = await addToRoster("u-1", "FB");

    expect(db.studentSportAssignment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { userId: "u-1", sportCode: "FB" },
      })
    );
  });
});

describe("removeFromRoster", () => {
  it("deletes a sport assignment", async () => {
    vi.mocked(db.studentSportAssignment.delete).mockResolvedValue({} as any);

    await removeFromRoster("ssa-1");

    expect(db.studentSportAssignment.delete).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "ssa-1" },
      })
    );
  });
});

describe("bulkAddToRoster", () => {
  it("creates multiple assignments and returns updated roster", async () => {
    vi.mocked(db.studentSportAssignment.createMany).mockResolvedValue({ count: 2 } as any);
    vi.mocked(db.studentSportAssignment.findMany).mockResolvedValue([
      { id: "ssa-1", userId: "u-1", sportCode: "FB", user: { id: "u-1", name: "S1" }, createdAt: new Date() },
      { id: "ssa-2", userId: "u-2", sportCode: "FB", user: { id: "u-2", name: "S2" }, createdAt: new Date() },
    ] as any);

    const result = await bulkAddToRoster(["u-1", "u-2"], "FB");

    expect(db.studentSportAssignment.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skipDuplicates: true,
      })
    );
    expect(result).toHaveLength(2);
  });
});
