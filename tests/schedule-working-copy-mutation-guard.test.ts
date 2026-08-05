import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * While a private working copy exists, the live relational schedule must not be
 * mutated by any legacy path. When these guards were absent, staff could add a
 * shift and assign someone through Event detail while a draft was open; the
 * draft never saw those rows, and publish then reported them as "history-bearing
 * slots" it refused to remove — an error the editor gave no way to resolve
 * because the offending slots were not visible in it. Pin every guarded path so
 * that class of desync cannot silently return.
 */
const guardedRoutes = [
  "src/app/api/shifts/[id]/route.ts",
  "src/app/api/shift-groups/[id]/shifts/route.ts",
  "src/app/api/shift-groups/[id]/shifts/[shiftId]/route.ts",
  "src/app/api/shift-assignments/[id]/route.ts",
];

describe("working-copy mutation guard", () => {
  it.each(guardedRoutes)("guards live schedule mutations in %s", (path) => {
    const source = readFileSync(path, "utf8");
    expect(source).toContain("assertNoWorkingCopy");
    expect(source).toContain("workingCopy");
  });

  it("guards every live assignment mutation in the assignment service", () => {
    const source = readFileSync("src/lib/services/shift-assignments.ts", "utf8");
    // Direct assign, remove, swap, acknowledge, and decline all reach live rows.
    const guardCount = source.match(/assertNoWorkingCopy\(/g)?.length ?? 0;
    expect(guardCount).toBeGreaterThanOrEqual(6);
  });

  it("keeps reservation-backed assignment out of a group with an open draft", () => {
    const source = readFileSync("src/lib/services/reservation-schedule.ts", "utf8");
    expect(source).toContain("if (group.workingCopy) return null;");
  });

  it("rejects a live mutation with a recoverable 409, not a generic failure", () => {
    const guard = readFileSync("src/lib/schedule-working-copy-guard.ts", "utf8");
    expect(guard).toContain("new HttpError(409");
    expect(guard).toContain("Review or discard the private working schedule");
  });

  // The draft snapshot is taken when the working copy row is created, so a shift
  // created after that timestamp was never in the draft. Publish must tell those
  // apart from slots the user actually removed, or it reports the wrong problem
  // and offers advice that cannot resolve it.
  it("separates post-draft drift from user removals before publishing", () => {
    const source = readFileSync("src/lib/services/schedule-publication.ts", "utf8");
    expect(source).toContain("const draftStartedAt = group.workingCopy.createdAt;");
    expect(source).toContain("shift.createdAt > draftStartedAt");
    expect(source).toContain("shift.createdAt <= draftStartedAt");
    expect(source).toContain("Discard this draft to keep the live schedule");
    // The publish query has to actually load both timestamps for that to work.
    expect(source).toContain("createdAt: true,");
  });
});
