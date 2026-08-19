import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  automaticMeasuredRuleKeys,
  shiftAutomaticRuleCounts,
  type ShiftBadgeEvidence,
} from "@/lib/badges/automatic-rules";

const TZ = "America/Chicago";

function source(relativeFile: string) {
  return readFileSync(path.join(process.cwd(), relativeFile), "utf8");
}

function assignment(overrides: {
  start: string;
  end: string;
  callStart?: string | null;
  callEnd?: string | null;
  area?: string;
  sportCode?: string | null;
  isHome?: boolean | null;
}): ShiftBadgeEvidence {
  return {
    callStartsAt: overrides.callStart ? new Date(overrides.callStart) : null,
    callEndsAt: overrides.callEnd ? new Date(overrides.callEnd) : null,
    shift: {
      startsAt: new Date(overrides.start),
      endsAt: new Date(overrides.end),
      callStartsAt: null,
      callEndsAt: null,
      area: overrides.area ?? "VIDEO",
      shiftGroup: {
        event: {
          isHome: overrides.isHome ?? true,
          sportCode: overrides.sportCode ?? null,
        },
      },
    },
  };
}

describe("shift breadth rule counts", () => {
  it("counts distinct sports without splitting on case or padding", () => {
    const counts = shiftAutomaticRuleCounts([
      assignment({ start: "2026-08-10T18:00:00.000Z", end: "2026-08-10T22:00:00.000Z", sportCode: "MBB" }),
      assignment({ start: "2026-09-10T18:00:00.000Z", end: "2026-09-10T22:00:00.000Z", sportCode: " mbb " }),
      assignment({ start: "2026-10-10T18:00:00.000Z", end: "2026-10-10T22:00:00.000Z", sportCode: "WVB" }),
      assignment({ start: "2026-11-10T18:00:00.000Z", end: "2026-11-10T22:00:00.000Z", sportCode: null }),
    ], TZ);

    expect(counts.get("shift_sports")).toBe(2);
  });

  it("counts distinct crew areas", () => {
    const counts = shiftAutomaticRuleCounts([
      assignment({ start: "2026-08-10T18:00:00.000Z", end: "2026-08-10T22:00:00.000Z", area: "VIDEO" }),
      assignment({ start: "2026-09-10T18:00:00.000Z", end: "2026-09-10T22:00:00.000Z", area: "VIDEO" }),
      assignment({ start: "2026-10-10T18:00:00.000Z", end: "2026-10-10T22:00:00.000Z", area: "PHOTO" }),
      assignment({ start: "2026-11-10T18:00:00.000Z", end: "2026-11-10T22:00:00.000Z", area: "LIVE_PRODUCTION" }),
    ], TZ);

    expect(counts.get("shift_areas")).toBe(3);
  });

  it("groups doubleheader days in institution time, not UTC", () => {
    // 23:00Z and 02:00Z the next UTC day are 6 p.m. and 9 p.m. the same local
    // evening. Grouping on the UTC date would score this as two single days.
    const counts = shiftAutomaticRuleCounts([
      assignment({ start: "2026-08-10T23:00:00.000Z", end: "2026-08-11T01:00:00.000Z" }),
      assignment({ start: "2026-08-11T02:00:00.000Z", end: "2026-08-11T04:00:00.000Z" }),
      assignment({ start: "2026-09-15T18:00:00.000Z", end: "2026-09-15T20:00:00.000Z" }),
    ], TZ);

    expect(counts.get("shift_doubleheader_days")).toBe(1);
  });

  it("counts a night that reached 10 p.m. local and one that crossed midnight", () => {
    const counts = shiftAutomaticRuleCounts([
      // 10:30 p.m. local.
      assignment({ start: "2026-08-10T23:00:00.000Z", end: "2026-08-11T03:30:00.000Z" }),
      // Ends 12:30 a.m. local the next day, so the end hour never reaches 22.
      assignment({ start: "2026-09-10T23:00:00.000Z", end: "2026-09-11T05:30:00.000Z" }),
      // Wraps at 5 p.m. local.
      assignment({ start: "2026-10-10T18:00:00.000Z", end: "2026-10-10T22:00:00.000Z" }),
    ], TZ);

    expect(counts.get("shift_after_22")).toBe(2);
  });

  it("prefers the assignment call window over the shift window", () => {
    const counts = shiftAutomaticRuleCounts([
      assignment({
        start: "2026-08-10T18:00:00.000Z",
        end: "2026-08-11T04:00:00.000Z",
        callEnd: "2026-08-10T22:00:00.000Z",
      }),
    ], TZ);

    // The shift row would have qualified at 11 p.m. local; this person's own
    // call ended at 5 p.m.
    expect(counts.get("shift_after_22")).toBe(0);
  });

  it("reports zero rather than nothing when a person has no assignments", () => {
    // A missing key would leave the profile with no progress row at all, which
    // renders as an unknowable goal instead of 0/8.
    const counts = shiftAutomaticRuleCounts([], TZ);

    expect(counts.get("shift_sports")).toBe(0);
    expect(counts.get("shift_areas")).toBe(0);
    expect(counts.get("shift_doubleheader_days")).toBe(0);
    expect(counts.get("shift_after_22")).toBe(0);
  });

  it("registers every new rule as measured so profile progress can derive it", () => {
    for (const ruleKey of ["shift_sports", "shift_areas", "shift_doubleheader_days", "shift_after_22"]) {
      expect(automaticMeasuredRuleKeys.has(ruleKey)).toBe(true);
    }
  });
});

describe("shift breadth catalog", () => {
  const migration = source("prisma/migrations/0117_badge_shift_breadth/migration.sql");
  const seed = source("prisma/seed.mjs");

  it("seeds four definitions the evaluator can award", () => {
    for (const [key, ruleKey] of [
      ["season_pass", "shift_sports"],
      ["utility_crew", "shift_areas"],
      ["doubleheader", "shift_doubleheader_days"],
      ["under_the_lights", "shift_after_22"],
    ]) {
      expect(migration).toContain(`'${key}'`);
      expect(migration).toContain(`'${ruleKey}'`);
      expect(seed).toContain(`key: "${key}"`);
      expect(seed).toContain(`ruleKey: "${ruleKey}"`);
    }

    // `awardMeasuredRuleBadges` only looks at MILESTONE definitions carrying a
    // threshold on this trigger. Any other triple is unearnable.
    expect(migration).toContain("'MILESTONE'::\"BadgeCategory\"");
    expect(migration).toContain("'shift:completed'");
    expect(migration).not.toContain("'manual'");
  });

  it("backfills historical qualifiers from the same scope the evaluator uses", () => {
    expect(migration).toContain("'DIRECT_ASSIGNED'::\"ShiftAssignmentStatus\"");
    expect(migration).toContain("'CONFIRMED'::\"CalendarEventStatus\"");
    expect(migration).toContain('e."ends_at" < CURRENT_TIMESTAMP');
    expect(migration).toContain("ON CONFLICT (\"user_id\", \"definition_id\") DO NOTHING");
    // Archived events still count, matching onShiftsWorked.
    expect(migration).not.toContain("archived_at");
  });
});

describe("shift breadth evidence selects", () => {
  const evaluator = source("src/lib/badges/evaluator.ts");
  const queries = source("src/lib/badges/queries.ts");

  it("selects the same new columns for awards and for profile progress", () => {
    // Two hand-written selects feed one derivation. If they drift, a badge
    // awards but shows no progress, or shows progress it can never complete.
    for (const field of ["callEndsAt: true", "endsAt: true", "area: true", "sportCode: true"]) {
      expect(evaluator).toContain(field);
      expect(queries).toContain(field);
    }
  });
});
