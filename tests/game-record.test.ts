import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    calendarEvent: {
      groupBy: vi.fn(),
    },
  },
}));

import { db } from "@/lib/db";
import {
  gameRecordEventWhere,
  getGameRecordForUser,
} from "@/lib/services/game-record";

const mockedDb = db as unknown as {
  calendarEvent: { groupBy: ReturnType<typeof vi.fn> };
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("gameRecordEventWhere", () => {
  it("counts only games that carry a source-derived outcome", () => {
    expect(gameRecordEventWhere("user-1").result).toEqual({ not: null });
  });

  it("excludes cancelled, hidden, and archived events", () => {
    const where = gameRecordEventWhere("user-1");
    expect(where.status).toEqual({ not: "CANCELLED" });
    expect(where.isHidden).toBe(false);
    expect(where.archivedAt).toBeNull();
  });

  it("credits the user through an active shift assignment only", () => {
    const where = gameRecordEventWhere("user-1");
    const assignment = where.shiftGroup?.shifts?.some?.assignments?.some;
    expect(assignment?.userId).toBe("user-1");
    // Declined and swapped-away assignments are not assignments.
    expect(assignment?.status).toEqual({ in: ["DIRECT_ASSIGNED", "APPROVED"] });
  });
});

describe("getGameRecordForUser", () => {
  it("tallies wins and losses from the grouped counts", async () => {
    mockedDb.calendarEvent.groupBy.mockResolvedValue([
      { result: "WIN", sportCode: "MBB", site: "HOME", _count: { _all: 12 } },
      { result: "LOSS", sportCode: "MBB", site: "AWAY", _count: { _all: 4 } },
    ]);
    await expect(getGameRecordForUser("user-1")).resolves.toMatchObject({ wins: 12, losses: 4 });
  });

  it("returns a zero record when the user has no resolved games", async () => {
    mockedDb.calendarEvent.groupBy.mockResolvedValue([]);
    await expect(getGameRecordForUser("user-1")).resolves.toEqual({ wins: 0, losses: 0, bySport: [], bySite: [] });
  });

  it("fills the missing side when every game went one way", async () => {
    mockedDb.calendarEvent.groupBy.mockResolvedValue([{ result: "WIN", sportCode: "VB", site: "HOME", _count: { _all: 3 } }]);
    await expect(getGameRecordForUser("user-1")).resolves.toMatchObject({ wins: 3, losses: 0 });
  });

  it("ignores an unexpected null bucket rather than miscounting it", async () => {
    mockedDb.calendarEvent.groupBy.mockResolvedValue([
      { result: null, sportCode: "MBB", site: "HOME", _count: { _all: 99 } },
      { result: "LOSS", sportCode: "MBB", site: "HOME", _count: { _all: 2 } },
    ]);
    await expect(getGameRecordForUser("user-1")).resolves.toMatchObject({ wins: 0, losses: 2 });
  });

  it("groups by event so one game with two shifts counts once", async () => {
    mockedDb.calendarEvent.groupBy.mockResolvedValue([{ result: "WIN", sportCode: "MBB", site: "HOME", _count: { _all: 1 } }]);
    await getGameRecordForUser("user-1");
    const args = mockedDb.calendarEvent.groupBy.mock.calls[0]![0];
    expect(args.by).toEqual(["result", "sportCode", "site"]);
    expect(args._count).toEqual({ _all: true });
  });

  it("does not leak another user's games into the tally", async () => {
    mockedDb.calendarEvent.groupBy.mockResolvedValue([]);
    await getGameRecordForUser("user-2");
    const args = mockedDb.calendarEvent.groupBy.mock.calls[0]![0];
    expect(args.where.shiftGroup.shifts.some.assignments.some.userId).toBe("user-2");
  });
});

describe("getGameRecordForUser — counting dimensions", () => {
  it("splits the record by sport, most-played first", async () => {
    mockedDb.calendarEvent.groupBy.mockResolvedValue([
      { result: "WIN", sportCode: "MBB", site: "HOME", _count: { _all: 5 } },
      { result: "LOSS", sportCode: "MBB", site: "AWAY", _count: { _all: 3 } },
      { result: "WIN", sportCode: "VB", site: "HOME", _count: { _all: 2 } },
    ]);
    const record = await getGameRecordForUser("user-1");
    expect(record).toMatchObject({ wins: 7, losses: 3 });
    expect(record.bySport).toEqual([
      { sportCode: "MBB", wins: 5, losses: 3 },
      { sportCode: "VB", wins: 2, losses: 0 },
    ]);
  });

  it("counts neutral games as neutral instead of lumping them with unknown", async () => {
    mockedDb.calendarEvent.groupBy.mockResolvedValue([
      { result: "WIN", sportCode: "MROW", site: "NEUTRAL", _count: { _all: 4 } },
      { result: "LOSS", sportCode: "MROW", site: null, _count: { _all: 1 } },
      { result: "WIN", sportCode: "MROW", site: "HOME", _count: { _all: 2 } },
    ]);
    const record = await getGameRecordForUser("user-1");
    expect(record.bySite).toEqual([
      { site: "HOME", wins: 2, losses: 0 },
      { site: "NEUTRAL", wins: 4, losses: 0 },
      { site: null, wins: 0, losses: 1 },
    ]);
  });

  it("orders sites home, away, neutral, then unknown", async () => {
    mockedDb.calendarEvent.groupBy.mockResolvedValue([
      { result: "WIN", sportCode: "FB", site: null, _count: { _all: 1 } },
      { result: "WIN", sportCode: "FB", site: "NEUTRAL", _count: { _all: 1 } },
      { result: "WIN", sportCode: "FB", site: "AWAY", _count: { _all: 1 } },
      { result: "WIN", sportCode: "FB", site: "HOME", _count: { _all: 1 } },
    ]);
    const record = await getGameRecordForUser("user-1");
    expect(record.bySite.map((b) => b.site)).toEqual(["HOME", "AWAY", "NEUTRAL", null]);
  });

  it("keeps a game with no sport in its own bucket rather than dropping it", async () => {
    mockedDb.calendarEvent.groupBy.mockResolvedValue([
      { result: "WIN", sportCode: null, site: "HOME", _count: { _all: 2 } },
    ]);
    const record = await getGameRecordForUser("user-1");
    expect(record.wins).toBe(2);
    expect(record.bySport).toEqual([{ sportCode: null, wins: 2, losses: 0 }]);
  });

  it("counts one game once across both breakdowns", async () => {
    mockedDb.calendarEvent.groupBy.mockResolvedValue([
      { result: "WIN", sportCode: "MBB", site: "HOME", _count: { _all: 6 } },
      { result: "LOSS", sportCode: "VB", site: "NEUTRAL", _count: { _all: 4 } },
    ]);
    const record = await getGameRecordForUser("user-1");
    const played = record.wins + record.losses;
    const sumOf = (rows: Array<{ wins: number; losses: number }>) =>
      rows.reduce((n, r) => n + r.wins + r.losses, 0);
    expect(sumOf(record.bySport)).toBe(played);
    expect(sumOf(record.bySite)).toBe(played);
  });
});
