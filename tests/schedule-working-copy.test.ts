import { describe, expect, it } from "vitest";
import {
  applyWorkingScheduleCommand,
  summarizeWorkingScheduleChanges,
  type WorkingSchedulePayload,
} from "@/lib/schedule-working-copy";

function payload(overrides: Partial<WorkingSchedulePayload> = {}): WorkingSchedulePayload {
  return {
    eventStartsAt: "2026-10-06T18:00:00.000Z",
    eventEndsAt: "2026-10-06T21:00:00.000Z",
    slots: [
      {
        key: "shift-1",
        sourceShiftId: "shift-1",
        area: "VIDEO",
        workerType: "ST",
        startsAt: "2026-10-06T18:00:00.000Z",
        endsAt: "2026-10-06T21:00:00.000Z",
        callStartsAt: "2026-10-06T17:00:00.000Z",
        callEndsAt: "2026-10-06T22:00:00.000Z",
        notes: null,
        assignmentHistoryCount: 0,
        assignment: null,
      },
    ],
    ...overrides,
  };
}

describe("working schedule commands", () => {
  it("adds a same-class slot with its peer's call window", () => {
    const result = applyWorkingScheduleCommand(
      payload(),
      { type: "adjustSlots", area: "VIDEO", workerType: "ST", delta: 1 },
      () => "draft:new",
    );

    expect(result.slots).toHaveLength(2);
    expect(result.slots[1]).toMatchObject({
      key: "draft:new",
      sourceShiftId: null,
      workerType: "ST",
      callStartsAt: "2026-10-06T17:00:00.000Z",
      assignmentHistoryCount: 0,
    });
  });

  it("subtracts only an open slot with no assignment history", () => {
    const historyBearing = payload().slots[0]!;
    expect(() => applyWorkingScheduleCommand(
      payload({ slots: [{ ...historyBearing, assignmentHistoryCount: 1 }] }),
      { type: "adjustSlots", area: "VIDEO", workerType: "ST", delta: -1 },
      () => "unused",
    )).toThrow("UNASSIGN_BEFORE_REDUCING");
  });

  it("removes the selected untouched slot instead of another matching opening", () => {
    const baseSlot = payload().slots[0]!;
    const result = applyWorkingScheduleCommand(
      payload({
        slots: [
          baseSlot,
          { ...baseSlot, key: "draft:second", sourceShiftId: null },
        ],
      }),
      { type: "removeSlot", slotKey: "shift-1" },
      () => "unused",
    );

    expect(result.slots.map((slot) => slot.key)).toEqual(["draft:second"]);
  });

  it("converts an empty slot but protects assigned slots", () => {
    const converted = applyWorkingScheduleCommand(
      payload(),
      { type: "convertSlot", slotKey: "shift-1", workerType: "FT" },
      () => "unused",
    );
    expect(converted.slots[0]!.workerType).toBe("FT");

    const baseSlot = payload().slots[0]!;
    const assigned = payload({
      slots: [{
        ...baseSlot,
        assignmentHistoryCount: 1,
        assignment: {
          sourceAssignmentId: "assignment-1",
          userId: "user-1",
          status: "DIRECT_ASSIGNED",
          callStartsAt: null,
          callEndsAt: null,
          callNote: null,
          activeTradeId: null,
          bookingCount: 0,
        },
      }],
    });
    expect(() => applyWorkingScheduleCommand(
      assigned,
      { type: "convertSlot", slotKey: "shift-1", workerType: "FT" },
      () => "unused",
    )).toThrow("UNASSIGN_BEFORE_CONVERTING");
  });

  it("stages assignment and removal without mutating a published row", () => {
    const assigned = applyWorkingScheduleCommand(
      payload(),
      { type: "assign", slotKey: "shift-1", userId: "user-1" },
      () => "unused",
    );
    expect(assigned.slots[0]!.assignment).toMatchObject({
      sourceAssignmentId: null,
      userId: "user-1",
      status: "DIRECT_ASSIGNED",
    });

    const unassigned = applyWorkingScheduleCommand(
      assigned,
      { type: "unassign", slotKey: "shift-1" },
      () => "unused",
    );
    expect(unassigned.slots[0]!.assignment).toBeNull();
  });

  it("stages a slot call window and includes it in publish review", () => {
    const published = payload();
    const working = applyWorkingScheduleCommand(
      published,
      {
        type: "setCallWindow",
        slotKey: "shift-1",
        callStartsAt: "2026-10-06T16:30:00.000Z",
        callEndsAt: "2026-10-06T21:30:00.000Z",
      },
      () => "unused",
    );

    expect(working.slots[0]).toMatchObject({
      callStartsAt: "2026-10-06T16:30:00.000Z",
      callEndsAt: "2026-10-06T21:30:00.000Z",
    });
    expect(summarizeWorkingScheduleChanges(published, working)).toMatchObject({
      callWindowChanges: 1,
      total: 1,
    });
  });

  it("summarizes additions, removals, and conversions for publish review", () => {
    const baseSlot = payload().slots[0]!;
    const published = payload({
      slots: [
        baseSlot,
        { ...baseSlot, key: "shift-2", sourceShiftId: "shift-2", area: "PHOTO" },
      ],
    });
    const working = payload({
      slots: [
        { ...baseSlot, workerType: "FT" },
        { ...baseSlot, key: "draft:new", sourceShiftId: null, area: "GRAPHICS" },
      ],
    });

    expect(summarizeWorkingScheduleChanges(published, working)).toEqual({
      addedSlots: 1,
      removedSlots: 1,
      convertedSlots: 1,
      assignmentChanges: 0,
      callWindowChanges: 0,
      total: 3,
    });
  });
});
