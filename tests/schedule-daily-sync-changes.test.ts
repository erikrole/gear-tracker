import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildScheduleSyncChangesState,
  MAX_DAILY_SCHEDULE_SYNC_CHANGES,
  MAX_TRACKED_MISSING_EVENTS_PER_SOURCE,
} from "@/lib/services/schedule-sync-changes";
import type { CalendarSyncChange } from "@/lib/schedule-sync-changes-types";

function change(
  kind: CalendarSyncChange["kind"],
  eventId: string,
  summary = `Event ${eventId}`,
): CalendarSyncChange {
  return {
    kind,
    eventId,
    externalId: `external-${eventId}`,
    summary,
    startsAt: "2026-09-01T18:00:00.000Z",
    changedFields: kind === "modified" ? ["date_time"] : [],
  };
}

function sourceResult(overrides: {
  changes?: CalendarSyncChange[];
  missingEventIds?: string[];
  error?: string;
} = {}) {
  return {
    sourceId: "source-1",
    sourceName: "UW Badgers",
    result: {
      added: overrides.changes?.filter((item) => item.kind === "added").length ?? 0,
      updated: overrides.changes?.filter((item) => item.kind === "modified").length ?? 0,
      cancelled: 0,
      skipped: 0,
      errors: [],
      changes: overrides.changes ?? [],
      missingEventIds: overrides.missingEventIds ?? [],
      error: overrides.error,
    },
  };
}

describe("daily Schedule sync change digest", () => {
  it("stores exact additions, modifications, and newly missing events", () => {
    const state = buildScheduleSyncChangesState(null, {
      runAt: new Date("2026-07-23T08:00:00.000Z"),
      sources: [sourceResult({
        changes: [
          change("added", "added"),
          change("modified", "modified"),
          change("removed", "removed"),
        ],
        missingEventIds: ["removed"],
      })],
    });

    expect(state.latestRun).toMatchObject({
      runAt: "2026-07-23T08:00:00.000Z",
      totals: { added: 1, modified: 1, removed: 1 },
      truncated: false,
    });
    expect(state.latestRun?.changes.map((item) => item.kind)).toEqual([
      "added",
      "modified",
      "removed",
    ]);
    expect(state.missingEventIdsBySource["source-1"]).toEqual(["removed"]);
  });

  it("does not report the same missing event as newly removed every day", () => {
    const prior = {
      version: 1,
      latestRun: null,
      missingEventIdsBySource: { "source-1": ["removed"] },
    };
    const state = buildScheduleSyncChangesState(prior, {
      runAt: new Date("2026-07-24T08:00:00.000Z"),
      sources: [sourceResult({
        changes: [change("removed", "removed")],
        missingEventIds: ["removed"],
      })],
    });

    expect(state.latestRun?.totals.removed).toBe(0);
    expect(state.latestRun?.changes).toEqual([]);
  });

  it("allows an event to be reported removed again after it reappears", () => {
    const missing = {
      version: 1,
      latestRun: null,
      missingEventIdsBySource: { "source-1": ["event-1"] },
    };
    const reappeared = buildScheduleSyncChangesState(missing, {
      runAt: new Date("2026-07-24T08:00:00.000Z"),
      sources: [sourceResult({ missingEventIds: [] })],
    });
    const removedAgain = buildScheduleSyncChangesState(reappeared, {
      runAt: new Date("2026-07-25T08:00:00.000Z"),
      sources: [sourceResult({
        changes: [change("removed", "event-1")],
        missingEventIds: ["event-1"],
      })],
    });

    expect(removedAgain.latestRun?.totals.removed).toBe(1);
  });

  it("retains missing-state memory when a source fetch fails", () => {
    const prior = {
      version: 1,
      latestRun: null,
      missingEventIdsBySource: { "source-1": ["event-1"] },
    };
    const state = buildScheduleSyncChangesState(prior, {
      runAt: new Date("2026-07-24T08:00:00.000Z"),
      sources: [sourceResult({ error: "HTTP 500" })],
    });

    expect(state.missingEventIdsBySource["source-1"]).toEqual(["event-1"]);
    expect(state.latestRun?.sourceErrors).toEqual([
      expect.objectContaining({ sourceName: "UW Badgers", error: "HTTP 500" }),
    ]);
  });

  it("bounds stored rows while keeping full totals", () => {
    const changes = Array.from(
      { length: MAX_DAILY_SCHEDULE_SYNC_CHANGES + 3 },
      (_, index) => change("added", String(index)),
    );
    const state = buildScheduleSyncChangesState(null, {
      runAt: new Date("2026-07-23T08:00:00.000Z"),
      sources: [sourceResult({ changes })],
    });

    expect(state.latestRun?.changes).toHaveLength(MAX_DAILY_SCHEDULE_SYNC_CHANGES);
    expect(state.latestRun?.totals.added).toBe(MAX_DAILY_SCHEDULE_SYNC_CHANGES + 3);
    expect(state.latestRun?.truncated).toBe(true);
  });

  it("bounds missing-event memory and source error text", () => {
    const missingEventIds = Array.from(
      { length: MAX_TRACKED_MISSING_EVENTS_PER_SOURCE + 2 },
      (_, index) => `event-${index}`,
    );
    const state = buildScheduleSyncChangesState(null, {
      runAt: new Date("2026-07-23T08:00:00.000Z"),
      sources: [sourceResult({
        missingEventIds,
        error: `Failure ${"x".repeat(400)}`,
      })],
    });

    expect(state.missingEventIdsBySource["source-1"]).toBeUndefined();
    expect(state.latestRun?.sourceErrors[0]?.error.length).toBeLessThanOrEqual(280);

    const successfulState = buildScheduleSyncChangesState(null, {
      runAt: new Date("2026-07-24T08:00:00.000Z"),
      sources: [sourceResult({ missingEventIds })],
    });
    expect(successfulState.missingEventIdsBySource["source-1"]).toHaveLength(
      MAX_TRACKED_MISSING_EVENTS_PER_SOURCE,
    );
  });
});

describe("daily Schedule sync change source contracts", () => {
  it("keeps the digest admin-only and renders it inside the Schedule rail", () => {
    const route = readFileSync("src/app/api/schedule/sync-changes/route.ts", "utf8");
    const page = readFileSync("src/app/(app)/schedule/page.tsx", "utf8");
    const readiness = readFileSync(
      "src/app/(app)/schedule/_components/ScheduleReadiness.tsx",
      "utf8",
    );
    const syncService = readFileSync("src/lib/services/calendar-sync.ts", "utf8");
    const component = readFileSync(
      "src/app/(app)/schedule/_components/ScheduleDailyChanges.tsx",
      "utf8",
    );
    const rail = readFileSync("src/components/OperationalStatusRail.tsx", "utf8");

    expect(route).toContain("[Role.ADMIN]");
    expect(route).not.toContain("Role.STAFF");
    expect(route).not.toContain("Role.COLLABORATOR");
    expect(page).toContain("isAdmin={isAdmin}");
    expect(page).not.toContain("<ScheduleDailyChanges");
    expect(readiness).toContain("enabled: isAdmin");
    expect(readiness).toContain("orientation={isAdmin");
    expect(readiness).toContain('tone: "change"');
    expect(readiness).toContain("<ScheduleDailyChanges");
    expect(component).toContain("Daily calendar changes");
    expect(component).toContain("Removed from feed");
    expect(component).toContain('href={`/events/${change.eventId}`}');
    expect(rail).toContain('orientation?.tone === "change"');
    expect(rail).toContain("text-[var(--purple-text)]");
    expect(syncService).toContain("let updated = 0");
    expect(syncService).not.toContain("toUpdate.length + unchanged.length");
  });
});
