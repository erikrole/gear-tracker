import { describe, expect, it } from "vitest";
import {
  availabilityConflictNote,
  findAvailabilityConflict,
} from "@/lib/student-availability";
import { effectiveCallWindow } from "@/lib/shift-call-windows";

describe("student availability conflict helpers", () => {
  it("matches weekly class blocks inside semester date bounds", () => {
    const note = availabilityConflictNote([
      {
        kind: "WEEKLY",
        dayOfWeek: 2,
        startsAt: "09:00",
        endsAt: "10:30",
        label: "COMM 201",
        semesterStartsOn: "2026-08-24",
        semesterEndsOn: "2026-12-18",
      },
    ], {
      startsAt: new Date("2026-09-01T14:15:00.000Z"),
      endsAt: new Date("2026-09-01T15:00:00.000Z"),
    });

    expect(note).toBe("Conflicts with COMM 201 (09:00-10:30)");
  });

  it("ignores weekly class blocks outside semester date bounds", () => {
    const conflict = findAvailabilityConflict([
      {
        kind: "WEEKLY",
        dayOfWeek: 2,
        startsAt: "09:00",
        endsAt: "10:30",
        label: "COMM 201",
        semesterStartsOn: "2026-08-24",
        semesterEndsOn: "2026-12-18",
      },
    ], {
      startsAt: new Date("2027-01-05T14:15:00.000Z"),
      endsAt: new Date("2027-01-05T15:00:00.000Z"),
    });

    expect(conflict).toBeNull();
  });

  it("matches one-time ad hoc conflicts only on the exact local date", () => {
    const blocks = [{
      kind: "AD_HOC" as const,
      date: "2026-10-06",
      startsAt: "10:00",
      endsAt: "11:00",
      label: "Exam",
    }];

    expect(availabilityConflictNote(blocks, {
      startsAt: new Date("2026-10-06T15:15:00.000Z"),
      endsAt: new Date("2026-10-06T15:45:00.000Z"),
    })).toBe("Conflicts with Exam (10:00-11:00)");

    expect(findAvailabilityConflict(blocks, {
      startsAt: new Date("2026-10-07T15:15:00.000Z"),
      endsAt: new Date("2026-10-07T15:45:00.000Z"),
    })).toBeNull();
  });

  it("keeps call-window precedence unchanged for conflict checks", () => {
    const window = effectiveCallWindow({
      startsAt: "2026-10-06T14:00:00.000Z",
      endsAt: "2026-10-06T17:00:00.000Z",
      callStartsAt: "2026-10-06T14:30:00.000Z",
      callEndsAt: "2026-10-06T16:00:00.000Z",
    }, {
      callStartsAt: "2026-10-06T15:15:00.000Z",
      callEndsAt: "2026-10-06T15:45:00.000Z",
    });

    expect(window.source).toBe("assignment");
    expect(availabilityConflictNote([{
      kind: "AD_HOC",
      date: "2026-10-06",
      startsAt: "10:00",
      endsAt: "11:00",
      label: "Exam",
    }], {
      startsAt: new Date(window.startsAt),
      endsAt: new Date(window.endsAt),
    })).toBe("Conflicts with Exam (10:00-11:00)");
  });
});
