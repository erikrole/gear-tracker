import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    shiftAssignment: {
      findMany: vi.fn(),
    },
  },
}));

import { db } from "@/lib/db";
import { getShiftRecordStats } from "@/lib/services/shift-records";

const findMany = vi.mocked(db.shiftAssignment.findMany);

function assignment(
  id: string,
  event: {
    id: string;
    result: "WIN" | "LOSS" | null;
    sportCode: string | null;
  },
) {
  return {
    id,
    shift: {
      shiftGroup: {
        event,
      },
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("personal shift records", () => {
  it("counts shifts separately while deduplicating event results", async () => {
    findMany.mockResolvedValue([
      assignment("a-1", { id: "event-win", result: "WIN", sportCode: "MBB" }),
      assignment("a-2", { id: "event-win", result: "WIN", sportCode: "MBB" }),
      assignment("a-3", { id: "event-loss", result: "LOSS", sportCode: "MBB" }),
      assignment("a-4", { id: "event-resultless", result: null, sportCode: "VB" }),
      assignment("a-5", { id: "event-sportless", result: null, sportCode: null }),
    ] as never);

    await expect(
      getShiftRecordStats("user-1", new Date("2026-07-23T20:00:00.000Z")),
    ).resolves.toEqual({
      shiftCount: 5,
      resultEventCount: 2,
      wins: 1,
      losses: 1,
      bySport: [
        {
          sportCode: "MBB",
          sportLabel: "Men's Basketball",
          shiftCount: 3,
          resultEventCount: 2,
          wins: 1,
          losses: 1,
        },
        {
          sportCode: "VB",
          sportLabel: "Volleyball",
          shiftCount: 1,
          resultEventCount: 0,
          wins: 0,
          losses: 0,
        },
      ],
    });

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        userId: "user-1",
        status: { in: ["DIRECT_ASSIGNED", "APPROVED"] },
        shift: {
          shiftGroup: {
            publishedAt: { not: null },
            event: {
              status: "CONFIRMED",
              endsAt: { lte: new Date("2026-07-23T20:00:00.000Z") },
            },
          },
        },
      },
    }));
    const query = findMany.mock.calls[0]?.[0];
    expect(query?.where?.shift?.shiftGroup?.event).not.toHaveProperty("archivedAt");
  });

  it("returns an empty record without inventing result coverage", async () => {
    findMany.mockResolvedValue([]);

    await expect(getShiftRecordStats("user-empty")).resolves.toEqual({
      shiftCount: 0,
      resultEventCount: 0,
      wins: 0,
      losses: 0,
      bySport: [],
    });
  });
});
