import { describe, expect, it } from "vitest";
import { getScheduleDataQuality, summarizeScheduleDataQuality } from "@/lib/schedule-data-quality";

function event(overrides: Partial<Parameters<typeof getScheduleDataQuality>[0]>) {
  return {
    id: "event-1",
    startsAt: new Date("2026-08-01T18:00:00Z"),
    endsAt: new Date("2026-08-01T21:00:00Z"),
    sportCode: "MSOC",
    opponent: "Drake",
    isHome: true,
    locationId: "loc-1",
    shiftGroup: null,
    archivedAt: null,
    ...overrides,
  };
}

describe("schedule data quality", () => {
  it("flags missing sport and shifts without sport", () => {
    expect(getScheduleDataQuality(event({
      sportCode: null,
      opponent: null,
      isHome: null,
      locationId: null,
      shiftGroup: { shifts: [{}] },
    })).map((issue) => issue.reason)).toEqual([
      "missing_sport",
      "shifts_without_sport",
    ]);
  });

  it("flags sport events missing opponent or venue mapping", () => {
    expect(getScheduleDataQuality(event({
      opponent: null,
      locationId: null,
    })).map((issue) => issue.reason)).toEqual([
      "missing_opponent",
      "missing_home_venue_mapping",
    ]);
  });

  it("flags neutral sport events without a venue", () => {
    expect(getScheduleDataQuality(event({
      isHome: null,
      locationId: null,
    })).map((issue) => issue.reason)).toEqual(["missing_venue"]);
  });

  it("does not flag a sport-tagged non-game as a missing opponent or venue", () => {
    expect(getScheduleDataQuality(event({
      opponent: null,
      isHome: null,
      locationId: null,
    }))).toEqual([]);
  });

  it("flags future archived events", () => {
    expect(getScheduleDataQuality(event({
      archivedAt: new Date("2026-06-01T00:00:00Z"),
    }), new Date("2026-07-01T00:00:00Z")).map((issue) => issue.reason)).toEqual(["future_archived"]);
  });

  it("flags active assignments whose user scheduling class disagrees with the planned slot", () => {
    expect(getScheduleDataQuality(event({
      shiftGroup: {
        shifts: [
          {
            id: "shift-1",
            workerType: "ST",
            assignments: [
              {
                id: "assignment-1",
                status: "DIRECT_ASSIGNED",
                user: { role: "STUDENT", staffingType: "FT" },
              },
            ],
          },
          {
            id: "shift-2",
            workerType: "FT",
            assignments: [
              {
                id: "assignment-2",
                status: "DECLINED",
                user: { role: "STUDENT" },
              },
            ],
          },
        ],
      },
    }))).toContainEqual({
      eventId: "event-1",
      reason: "role_slot_mismatch",
      shiftId: "shift-1",
      assignmentId: "assignment-1",
    });
  });

  it("summarizes issue count and unique event count", () => {
    const summary = summarizeScheduleDataQuality([
      event({ id: "event-1", sportCode: null, opponent: null, isHome: null, locationId: null, shiftGroup: { shifts: [{}] } }),
      event({ id: "event-2", opponent: null, locationId: null }),
    ]);

    expect(summary.count).toBe(4);
    expect(summary.eventCount).toBe(2);
    expect(summary.eventIds).toEqual(["event-1", "event-2"]);
  });
});
