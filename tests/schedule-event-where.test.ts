import { describe, expect, it } from "vitest";
import { buildScheduleEventWhere } from "@/lib/schedule-event-where";

describe("buildScheduleEventWhere", () => {
  const now = new Date("2026-07-01T12:00:00Z");

  it("defaults to visible, active, unarchived events from the app day boundary", () => {
    const where = buildScheduleEventWhere({
      parsedStartDate: null,
      parsedEndDate: null,
      includePast: false,
      includeArchived: false,
      sportCode: null,
      now,
    });

    expect(where.status).toEqual({ not: "CANCELLED" });
    expect(where.isHidden).toBe(false);
    expect(where.archivedAt).toBeNull();
    expect(where.endsAt).toEqual({ gt: new Date("2026-07-01T05:00:00.000Z") });
  });

  it("uses explicit dates as an overlap window", () => {
    const start = new Date("2026-08-01T00:00:00Z");
    const end = new Date("2026-08-07T23:59:59Z");

    const where = buildScheduleEventWhere({
      parsedStartDate: start,
      parsedEndDate: end,
      includePast: true,
      includeArchived: false,
      sportCode: "VB",
      now,
    });

    expect(where.startsAt).toEqual({ lte: end });
    expect(where.endsAt).toEqual({ gt: start });
    expect(where.sportCode).toBe("VB");
  });

  it("allows staff/admin callers to include hidden and archived rows when the route permits it", () => {
    const where = buildScheduleEventWhere({
      parsedStartDate: null,
      parsedEndDate: null,
      includePast: true,
      includeHidden: true,
      includeArchived: true,
      sportCode: null,
      now,
    });

    expect(where).not.toHaveProperty("isHidden");
    expect(where).not.toHaveProperty("archivedAt");
    expect(where).not.toHaveProperty("startsAt");
    expect(where).not.toHaveProperty("endsAt");
  });

  it("composes unmapped and sport filters with the shared visibility rules", () => {
    const where = buildScheduleEventWhere({
      parsedStartDate: new Date("2026-09-01T00:00:00Z"),
      parsedEndDate: null,
      includePast: false,
      includeArchived: false,
      unmappedOnly: true,
      sportCode: "MSOC",
      now,
    });

    expect(where.locationId).toBeNull();
    expect(where.sportCode).toBe("MSOC");
    expect(where.isHidden).toBe(false);
    expect(where.archivedAt).toBeNull();
    expect(where.endsAt).toEqual({ gt: new Date("2026-09-01T00:00:00Z") });
  });
});
