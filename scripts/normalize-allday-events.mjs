// Normalize all-day calendar events to canonical UTC midnight.
//
// Why: all-day events are *dates*, not instants, but historically the manual
// "New event" form stored them at LOCAL (Central) midnight, e.g.
// 2026-06-17T05:00:00Z, while ICS sync stored UTC midnight (2026-06-17T00:00Z).
// The mixed encoding is the root of the all-day/timezone bugs (events showing
// on the wrong day, phantom "Day 1/2", disappearing from "today"). Readers now
// tolerate both, but this canonicalizes existing rows so all-day truly stops
// caring about timezone. New events are already normalized on create.
//
// Usage:
//   node --env-file=.env scripts/normalize-allday-events.mjs            # dry run
//   node --env-file=.env scripts/normalize-allday-events.mjs --apply    # execute
//
// Requires DATABASE_URL in the environment. With --apply, every change is
// logged to .tmp/allday-normalize-<ts>.json (old -> new) so it is reversible.
//
// Note: this normalizes the *event* startsAt/endsAt only. Associated shift /
// call-window times are derived & displayed via the shift-call-window helpers
// and are not rewritten here — review the dry run before applying.

import { writeFileSync, mkdirSync } from "node:fs";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";

const APPLY = process.argv.includes("--apply");
const TZ = process.env.APP_TIMEZONE || "America/Chicago";

function appTzYmd(instant, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const get = (type) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

// Mirrors src/lib/app-time.ts#normalizeAllDayToUtcMidnight (idempotent).
function normalizeAllDay(instant, timeZone) {
  if (
    instant.getUTCHours() === 0 &&
    instant.getUTCMinutes() === 0 &&
    instant.getUTCSeconds() === 0 &&
    instant.getUTCMilliseconds() === 0
  ) {
    return new Date(Date.UTC(instant.getUTCFullYear(), instant.getUTCMonth(), instant.getUTCDate()));
  }
  const { year, month, day } = appTzYmd(instant, timeZone);
  return new Date(Date.UTC(year, month - 1, day));
}

async function main() {
  const db = new PrismaClient({
    adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }),
  });
  try {
    const events = await db.calendarEvent.findMany({
      where: { allDay: true },
      select: { id: true, summary: true, startsAt: true, endsAt: true },
      orderBy: { startsAt: "asc" },
    });

    const changes = [];
    for (const e of events) {
      const newStart = normalizeAllDay(e.startsAt, TZ);
      const newEnd = normalizeAllDay(e.endsAt, TZ);
      if (newStart.getTime() !== e.startsAt.getTime() || newEnd.getTime() !== e.endsAt.getTime()) {
        changes.push({
          id: e.id,
          summary: e.summary,
          oldStart: e.startsAt.toISOString(),
          newStart: newStart.toISOString(),
          oldEnd: e.endsAt.toISOString(),
          newEnd: newEnd.toISOString(),
        });
      }
    }

    console.log(`Timezone: ${TZ}`);
    console.log(`All-day events: ${events.length}. Needing normalization: ${changes.length}.\n`);
    for (const c of changes) {
      console.log(`  ${c.id}  "${c.summary}"`);
      console.log(`    start  ${c.oldStart}  ->  ${c.newStart}`);
      console.log(`    end    ${c.oldEnd}  ->  ${c.newEnd}`);
    }

    if (!APPLY) {
      console.log(`\nDry run — no changes written. Re-run with --apply to update ${changes.length} row(s).`);
      return;
    }

    if (changes.length === 0) {
      console.log("\nNothing to apply.");
      return;
    }

    mkdirSync(".tmp", { recursive: true });
    const logPath = `.tmp/allday-normalize-${Date.now()}.json`;
    writeFileSync(logPath, JSON.stringify(changes, null, 2));

    for (const c of changes) {
      await db.calendarEvent.update({
        where: { id: c.id },
        data: { startsAt: new Date(c.newStart), endsAt: new Date(c.newEnd) },
      });
    }

    console.log(`\nApplied ${changes.length} update(s). Reversible log: ${logPath}`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
