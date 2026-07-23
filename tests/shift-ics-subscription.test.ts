import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function source(relativeFile: string) {
  return readFileSync(path.join(process.cwd(), relativeFile), "utf8");
}

// The shift ICS feed is a live subscription — a direct mirror of a user's
// assigned schedule that Apple Calendar re-polls. These guard the properties
// that keep it a faithful, current mirror rather than a stale one-off. Gear
// checkouts are deliberately NOT in this feed and have no calendar surface;
// they live in-app and via push.
describe("shift subscription feed", () => {
  it("tells subscribed clients how often to refresh", () => {
    const route = source("src/app/api/shifts/ics/[token]/route.ts");

    // Apple Calendar's own default for a subscription can be as slow as once a
    // day, which is useless for a schedule where shifts get traded same-day.
    expect(route).toContain('const REFRESH_INTERVAL = "PT1H"');
    expect(route).toContain("`REFRESH-INTERVAL;VALUE=DURATION:${REFRESH_INTERVAL}`");
    // Older clients read only the X- spelling.
    expect(route).toContain("`X-PUBLISHED-TTL:${REFRESH_INTERVAL}`");
  });

  it("computes the feed window without month-overflow arithmetic", () => {
    const route = source("src/app/api/shifts/ics/[token]/route.ts");

    expect(route).toContain("const HISTORY_WINDOW_MS =");
    expect(route).toContain("const FUTURE_WINDOW_MS =");
    expect(route).toContain("new Date(now.getTime() - HISTORY_WINDOW_MS)");
    expect(route).toContain("new Date(now.getTime() + FUTURE_WINDOW_MS)");
    // `setMonth(getMonth() - 1)` on the 29th-31st overflows a short month and
    // silently shrinks the history window on exactly those days.
    expect(route).not.toContain("setMonth(windowStart.getMonth() - 1)");
    expect(route).not.toContain("setFullYear(windowEnd.getFullYear() + 1)");
  });

  it("drops shifts from the mirror the moment they leave the schedule", () => {
    const route = source("src/app/api/shifts/ics/[token]/route.ts");

    // The mirror stays faithful because removals fall out of the query: only
    // live assignments on confirmed, unarchived events are emitted, so a
    // cancelled game, an unassigned shift, or a completed trade (old row goes
    // SWAPPED) simply vanishes from the feed and the calendar clears it.
    expect(route).toContain('status: { in: ["DIRECT_ASSIGNED", "APPROVED"] }');
    expect(route).toContain('shiftGroup: { event: { status: "CONFIRMED", archivedAt: null } }');
    // SEQUENCE/LAST-MODIFIED bump on any change so moved call times re-render.
    expect(route).toContain("const sequence = Math.floor(lastModified.getTime() / 1000)");
    expect(route).toContain("a.callStartsAt ?? shift.callStartsAt ?? shift.startsAt");
  });

  it("keeps the feed private and unguessable", () => {
    const route = source("src/app/api/shifts/ics/[token]/route.ts");
    const tokenRoute = source("src/app/api/shifts/ics-token/route.ts");

    expect(route).toContain("const TOKEN_RE = /^[a-f0-9]{48}$/i");
    expect(route).toContain("checkRateLimit(`shifts:ics:token:${token}`");
    expect(route).toContain("checkRateLimit(`shifts:ics:ip:${ip}`");
    expect(route).toContain("active: true");
    // Rotation is the recovery path for a leaked feed URL.
    expect(tokenRoute).toContain('randomBytes(24).toString("hex")');
    expect(tokenRoute).toContain('action: "ics_token_rotated"');
  });
});
