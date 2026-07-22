import { beforeEach, describe, expect, it, vi } from "vitest";

const { tx } = vi.hoisted(() => ({
  tx: {
    sportConfig: { findMany: vi.fn() },
    calendarEvent: { findMany: vi.fn() },
    shiftGroup: { create: vi.fn() },
    shift: { createMany: vi.fn(), deleteMany: vi.fn(), updateMany: vi.fn() },
  },
}));

vi.mock("@/lib/db", () => ({
  db: {
    $transaction: vi.fn(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
  },
}));

import { rebaseUpcomingShiftsForSportCodes } from "@/lib/services/shift-generation";

const eventTime = new Date("2026-09-01T18:00:00Z");
const untouchedAt = new Date("2026-07-01T12:00:00Z");

beforeEach(() => {
  vi.clearAllMocks();
  tx.sportConfig.findMany.mockResolvedValue([{
    sportCode: "FB",
    active: true,
    shiftStartOffset: 60,
    shiftEndOffset: 30,
    shiftConfigs: [{
      area: "VIDEO",
      homeCount: 2,
      awayCount: 0,
      homeStaffCount: 1,
      homeStudentCount: 1,
      awayStaffCount: 0,
      awayStudentCount: 0,
    }],
  }]);
  tx.shift.createMany.mockImplementation(async ({ data }: { data: unknown[] }) => ({ count: data.length }));
  tx.shift.deleteMany.mockImplementation(async ({ where }: { where: { id: { in: string[] } } }) => ({ count: where.id.in.length }));
  tx.shift.updateMany.mockResolvedValue({ count: 0 });
});

describe("sport default rebasing", () => {
  it("adds missing slots and removes only untouched generated openings", async () => {
    tx.calendarEvent.findMany.mockResolvedValue([{
      id: "event-1",
      sportCode: "FB",
      isHome: true,
      startsAt: eventTime,
      endsAt: new Date("2026-09-01T21:00:00Z"),
      shiftGroup: {
        id: "group-1",
        publishedAt: null,
        workingCopy: null,
        shifts: [
          {
            id: "student-occupied",
            area: "VIDEO",
            workerType: "ST",
            startsAt: eventTime,
            endsAt: new Date("2026-09-01T21:00:00Z"),
            callStartsAt: null,
            callEndsAt: null,
            notes: null,
            templateManaged: true,
            createdAt: untouchedAt,
            updatedAt: untouchedAt,
            assignments: [{ id: "assignment-1" }],
          },
          {
            id: "student-extra",
            area: "VIDEO",
            workerType: "ST",
            startsAt: eventTime,
            endsAt: new Date("2026-09-01T21:00:00Z"),
            callStartsAt: null,
            callEndsAt: null,
            notes: null,
            templateManaged: true,
            createdAt: untouchedAt,
            updatedAt: untouchedAt,
            assignments: [],
          },
          {
            id: "manual-extra",
            area: "PHOTO",
            workerType: "ST",
            startsAt: eventTime,
            endsAt: new Date("2026-09-01T21:00:00Z"),
            callStartsAt: null,
            callEndsAt: null,
            notes: null,
            templateManaged: false,
            createdAt: untouchedAt,
            updatedAt: untouchedAt,
            assignments: [],
          },
        ],
      },
    }]);

    const result = await rebaseUpcomingShiftsForSportCodes(["FB"]);

    expect(tx.shift.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["student-extra"] }, assignments: { none: {} } },
    });
    expect(tx.shift.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({
        shiftGroupId: "group-1",
        area: "VIDEO",
        workerType: "FT",
        templateManaged: true,
      })],
    });
    expect(result).toMatchObject({
      groupsRebased: 1,
      slotsAdded: 1,
      slotsRemoved: 1,
      protectedSlots: 2,
      protectedOverageSlots: 1,
    });
  });

  it("leaves published schedules and active working copies for explicit review", async () => {
    tx.calendarEvent.findMany.mockResolvedValue([
      {
        id: "published",
        sportCode: "FB",
        isHome: true,
        startsAt: eventTime,
        endsAt: eventTime,
        shiftGroup: { id: "group-p", publishedAt: untouchedAt, workingCopy: null, shifts: [] },
      },
      {
        id: "editing",
        sportCode: "FB",
        isHome: true,
        startsAt: eventTime,
        endsAt: eventTime,
        shiftGroup: { id: "group-w", publishedAt: null, workingCopy: { shiftGroupId: "group-w" }, shifts: [] },
      },
    ]);

    await expect(rebaseUpcomingShiftsForSportCodes(["FB"])).resolves.toMatchObject({
      publishedSkipped: 1,
      workingCopiesSkipped: 1,
      groupsRebased: 0,
    });
    expect(tx.shift.createMany).not.toHaveBeenCalled();
    expect(tx.shift.deleteMany).not.toHaveBeenCalled();
  });
});
