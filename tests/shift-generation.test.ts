import { describe, expect, it, vi, beforeEach } from "vitest";

const { mockTx } = vi.hoisted(() => ({
  mockTx: {
    calendarEvent: {
      findUnique: vi.fn(),
    },
    shiftGroup: {
      create: vi.fn(),
    },
    shift: {
      createMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/db", () => ({
  db: {
    calendarEvent: {
      findUnique: vi.fn(),
    },
    sportConfig: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    $transaction: vi.fn(async (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx)),
    _mockTx: mockTx,
  },
}));

import { db } from "@/lib/db";
import { generateShiftsForEvent } from "@/lib/services/shift-generation";

function calendarEvent(row: unknown) {
  return row as Awaited<ReturnType<typeof db.calendarEvent.findUnique>>;
}

function sportConfig(row: unknown) {
  return row as Awaited<ReturnType<typeof db.sportConfig.findUnique>>;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("generateShiftsForEvent", () => {
  it("creates the planned staff and student slot mix from sport config", async () => {
    const event = {
      id: "event-1",
      sportCode: "FB",
      isHome: true,
      startsAt: new Date("2026-04-01T18:00:00Z"),
      endsAt: new Date("2026-04-01T21:00:00Z"),
      shiftGroup: null,
    };
    vi.mocked(db.calendarEvent.findUnique).mockResolvedValue(calendarEvent(event));
    vi.mocked(db.sportConfig.findUnique).mockResolvedValue(sportConfig({
      sportCode: "FB",
      active: true,
      shiftStartOffset: 60,
      shiftEndOffset: 30,
      shiftConfigs: [
        {
          area: "VIDEO",
          homeCount: 3,
          awayCount: 1,
          homeStaffCount: 1,
          homeStudentCount: 2,
          awayStaffCount: 0,
          awayStudentCount: 1,
        },
      ],
    }));
    mockTx.calendarEvent.findUnique.mockResolvedValue({ ...event, shiftGroup: null });
    mockTx.shiftGroup.create.mockResolvedValue({ id: "shift-group-1" });
    mockTx.shift.createMany.mockResolvedValue({ count: 3 });

    const result = await generateShiftsForEvent("event-1");

    expect(result).toEqual({ created: true, shiftGroupId: "shift-group-1", shiftCount: 3 });
    expect(mockTx.shift.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ area: "VIDEO", workerType: "FT" }),
        expect.objectContaining({ area: "VIDEO", workerType: "ST" }),
        expect.objectContaining({ area: "VIDEO", workerType: "ST" }),
      ]),
    });
  });
});
