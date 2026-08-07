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
    systemConfig: {
      findUnique: vi.fn(),
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
  vi.mocked(db.systemConfig.findUnique).mockResolvedValue(null);
});

describe("generateShiftsForEvent", () => {
  it("uses Away defaults for a neutral-site game with an opponent", async () => {
    const event = {
      id: "event-neutral",
      sportCode: "FB",
      opponent: "Iowa",
      isHome: null,
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
      shiftConfigs: [{
        area: "VIDEO",
        homeCount: 3,
        awayCount: 1,
        homeStaffCount: 2,
        homeStudentCount: 1,
        awayStaffCount: 0,
        awayStudentCount: 1,
      }],
    }));
    mockTx.calendarEvent.findUnique.mockResolvedValue({ ...event, shiftGroup: null });
    mockTx.shiftGroup.create.mockResolvedValue({ id: "shift-group-neutral" });
    mockTx.shift.createMany.mockResolvedValue({ count: 1 });

    await expect(generateShiftsForEvent("event-neutral")).resolves.toEqual({
      created: true,
      shiftGroupId: "shift-group-neutral",
      shiftCount: 1,
    });
    expect(mockTx.shift.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({
        workerType: "ST",
        startsAt: new Date("2026-04-01T17:00:00Z"),
        endsAt: new Date("2026-04-01T21:30:00Z"),
      })],
    });
  });

  it("creates the planned staff and student slot mix from sport config", async () => {
    const event = {
      id: "event-1",
      sportCode: "FB",
      opponent: "Iowa",
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
        expect.objectContaining({
          area: "VIDEO",
          workerType: "FT",
          startsAt: new Date("2026-04-01T18:00:00Z"),
          endsAt: new Date("2026-04-01T21:00:00Z"),
        }),
        expect.objectContaining({
          area: "VIDEO",
          workerType: "ST",
          startsAt: new Date("2026-04-01T17:00:00Z"),
          endsAt: new Date("2026-04-01T21:30:00Z"),
        }),
        expect.objectContaining({
          area: "VIDEO",
          workerType: "ST",
          startsAt: new Date("2026-04-01T17:00:00Z"),
          endsAt: new Date("2026-04-01T21:30:00Z"),
        }),
      ]),
    });
  });

  it("preserves date-only boundaries for all-day events", async () => {
    const event = {
      id: "event-all-day",
      sportCode: "FB",
      opponent: "Iowa",
      isHome: true,
      allDay: true,
      startsAt: new Date("2026-04-02T00:00:00Z"),
      endsAt: new Date("2026-04-03T00:00:00Z"),
      shiftGroup: null,
    };
    vi.mocked(db.calendarEvent.findUnique).mockResolvedValue(calendarEvent(event));
    vi.mocked(db.sportConfig.findUnique).mockResolvedValue(sportConfig({
      sportCode: "FB",
      active: true,
      shiftStartOffset: 120,
      shiftEndOffset: 120,
      shiftConfigs: [{
        area: "VIDEO",
        homeCount: 1,
        awayCount: 0,
        homeStaffCount: 0,
        homeStudentCount: 1,
        awayStaffCount: 0,
        awayStudentCount: 0,
      }],
    }));
    mockTx.calendarEvent.findUnique.mockResolvedValue({ ...event, shiftGroup: null });
    mockTx.shiftGroup.create.mockResolvedValue({ id: "shift-group-all-day" });
    mockTx.shift.createMany.mockResolvedValue({ count: 1 });

    await expect(generateShiftsForEvent("event-all-day")).resolves.toEqual({
      created: true,
      shiftGroupId: "shift-group-all-day",
      shiftCount: 1,
    });
    expect(mockTx.shift.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({
        startsAt: new Date("2026-04-02T00:00:00Z"),
        endsAt: new Date("2026-04-03T00:00:00Z"),
      })],
    });
  });

  it("creates configured Staff and Student slots for a non-game event", async () => {
    const event = {
      id: "event-non-game",
      sportCode: null,
      opponent: null,
      isHome: null,
      allDay: false,
      startsAt: new Date("2026-04-04T18:00:00Z"),
      endsAt: new Date("2026-04-04T20:00:00Z"),
      shiftGroup: null,
    };
    vi.mocked(db.calendarEvent.findUnique).mockResolvedValue(calendarEvent(event));
    vi.mocked(db.systemConfig.findUnique).mockResolvedValue({
      key: "schedule_non_game_defaults",
      value: {
        shiftStartOffset: 30,
        shiftEndOffset: 15,
        shiftConfigs: [{ area: "PHOTO", staffCount: 1, studentCount: 1 }],
      },
      updatedAt: new Date(),
    });
    mockTx.calendarEvent.findUnique.mockResolvedValue({ ...event, shiftGroup: null });
    mockTx.shiftGroup.create.mockResolvedValue({ id: "shift-group-non-game" });
    mockTx.shift.createMany.mockResolvedValue({ count: 2 });

    await expect(generateShiftsForEvent(event.id)).resolves.toEqual({
      created: true,
      shiftGroupId: "shift-group-non-game",
      shiftCount: 2,
    });
    expect(mockTx.shift.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          workerType: "FT",
          startsAt: event.startsAt,
          endsAt: event.endsAt,
        }),
        expect.objectContaining({
          workerType: "ST",
          startsAt: new Date("2026-04-04T17:30:00Z"),
          endsAt: new Date("2026-04-04T20:15:00Z"),
        }),
      ]),
    });
  });
});
