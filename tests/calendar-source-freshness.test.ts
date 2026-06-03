import { describe, expect, it } from "vitest";
import {
  buildScheduleSourceSignal,
  calendarSourceFreshnessLabel,
  getCalendarSourceFreshness,
} from "@/lib/calendar-source-freshness";

const now = new Date("2026-06-03T18:00:00.000Z");

describe("calendar source freshness", () => {
  it("classifies enabled sources with a 30 hour stale threshold", () => {
    expect(getCalendarSourceFreshness({
      id: "source-1",
      name: "Football",
      enabled: true,
      lastFetchedAt: "2026-06-02T13:00:00.000Z",
      lastError: null,
    }, now)).toBe("healthy");

    expect(getCalendarSourceFreshness({
      id: "source-1",
      name: "Football",
      enabled: true,
      lastFetchedAt: "2026-06-01T12:30:00.000Z",
      lastError: null,
    }, now)).toBe("stale");
  });

  it("prioritizes disabled, error, and never synced states before stale math", () => {
    expect(getCalendarSourceFreshness({
      id: "source-1",
      name: "Football",
      enabled: false,
      lastFetchedAt: null,
      lastError: "HTTP 500",
    }, now)).toBe("disabled");

    expect(getCalendarSourceFreshness({
      id: "source-2",
      name: "Volleyball",
      enabled: true,
      lastFetchedAt: "2026-06-03T17:00:00.000Z",
      lastError: "HTTP 500",
    }, now)).toBe("error");

    expect(getCalendarSourceFreshness({
      id: "source-3",
      name: "Soccer",
      enabled: true,
      lastFetchedAt: null,
      lastError: null,
    }, now)).toBe("never-synced");
  });

  it("uses product labels for Settings and Schedule status surfaces", () => {
    expect(calendarSourceFreshnessLabel("healthy")).toBe("Healthy");
    expect(calendarSourceFreshnessLabel("stale")).toBe("Stale");
    expect(calendarSourceFreshnessLabel("never-synced")).toBe("Never synced");
  });

  it("summarizes manual and imported visible schedule rows", () => {
    const signal = buildScheduleSourceSignal(
      [
        { source: null },
        { source: { id: "source-1", name: "Football" } },
        { source: { id: "source-1", name: "Football" } },
      ],
      [{
        id: "source-1",
        name: "Football",
        enabled: true,
        lastFetchedAt: "2026-06-03T10:00:00.000Z",
        lastError: null,
      }],
      { now },
    );

    expect(signal.label).toBe("Manual + calendar");
    expect(signal.severity).toBe("ok");
    expect(signal.manualEvents).toBe(1);
    expect(signal.importedEvents).toBe(2);
    expect(signal.healthySourceCount).toBe(1);
    expect(signal.detail).toContain("1 manual event and 2 imported events visible");
  });

  it("flags source errors and stale sources without hiding visible rows", () => {
    const errorSignal = buildScheduleSourceSignal(
      [{ source: { id: "source-1", name: "Football" } }],
      [{
        id: "source-1",
        name: "Football",
        enabled: true,
        lastFetchedAt: "2026-06-03T10:00:00.000Z",
        lastError: "HTTP 500",
      }],
      { now },
    );

    expect(errorSignal.label).toBe("Calendar source error");
    expect(errorSignal.variant).toBe("red");
    expect(errorSignal.detail).toContain("1 imported event visible");

    const staleSignal = buildScheduleSourceSignal(
      [{ source: { id: "source-2", name: "Soccer" } }],
      [{
        id: "source-2",
        name: "Soccer",
        enabled: true,
        lastFetchedAt: "2026-06-01T12:00:00.000Z",
        lastError: null,
      }],
      { now },
    );

    expect(staleSignal.label).toBe("Calendar source stale");
    expect(staleSignal.variant).toBe("orange");
  });

  it("reports unavailable source metadata as attention instead of a false healthy state", () => {
    const signal = buildScheduleSourceSignal(
      [{ source: { id: "source-1", name: "Football" } }],
      [],
      { status: "unavailable", now },
    );

    expect(signal.status).toBe("unavailable");
    expect(signal.label).toBe("Source status unavailable");
    expect(signal.severity).toBe("attention");
    expect(signal.detail).toContain("Source metadata could not be checked");
  });
});
