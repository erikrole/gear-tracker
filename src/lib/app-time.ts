import { env } from "@/lib/env";

/**
 * Timezone-aware "today" helpers for the app's institution timezone
 * (`env.appTimezone`, default America/Chicago).
 *
 * Why this exists: server runtimes (Vercel) run in UTC, so `new Date()` +
 * `setHours(0,0,0,0)` gives *UTC* midnight, not the local day boundary the
 * staff actually experience. For "is this event today?" style filters that
 * difference shifts evening events onto the wrong day. Compute the day window
 * in the app timezone instead.
 */

/** Minutes/ms the given instant is offset from UTC in `timeZone`. */
function zoneOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return asUtc - date.getTime();
}

/** The app-timezone calendar date (year/month/day) of an instant. */
function appTzYmd(instant: Date, timeZone: string): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

/**
 * The UTC instant of midnight that begins `today + dayOffset` in the app
 * timezone. DST-correct: the offset is applied to the calendar date, then the
 * zone offset is resolved at that target day. `dayOffset: 1` is start of
 * tomorrow.
 */
export function startOfDayInAppTz(
  now: Date = new Date(),
  dayOffset = 0,
  timeZone: string = env.appTimezone,
): Date {
  const { year, month, day } = appTzYmd(now, timeZone);
  const utcGuess = Date.UTC(year, month - 1, day + dayOffset, 0, 0, 0, 0);
  return new Date(utcGuess - zoneOffsetMs(new Date(utcGuess), timeZone));
}

/**
 * The UTC instant of the start of "today" (midnight) in the app timezone.
 *
 * Use as an event lower bound: `endsAt > startOfTodayInAppTz()` keeps every
 * event that occurs today visible until the day actually ends at local
 * midnight — a 7pm game stays listed all evening instead of vanishing the
 * moment it ends — while dropping events that ended yesterday or earlier.
 */
export function startOfTodayInAppTz(now: Date = new Date(), timeZone: string = env.appTimezone): Date {
  return startOfDayInAppTz(now, 0, timeZone);
}

/**
 * Canonicalize an all-day event boundary to UTC midnight of its calendar date.
 *
 * All-day events are *dates*, not instants, but they reach us two ways:
 *   - ICS sync stores UTC midnight (`Date.UTC(y,m,d)`), already canonical.
 *   - Manual creation historically stored *local* (Central) midnight
 *     (e.g. `2026-06-17T05:00Z`), which makes the instant's UTC date ambiguous
 *     across timezones.
 *
 * This returns UTC midnight of the intended date so every reader can treat
 * all-day events as plain dates. Idempotent: an instant already at UTC midnight
 * is returned unchanged (so re-saving an ICS event never shifts it); a
 * local-midnight instant is mapped to UTC midnight of its app-timezone date.
 */
export function normalizeAllDayToUtcMidnight(instant: Date, timeZone: string = env.appTimezone): Date {
  const alreadyUtcMidnight =
    instant.getUTCHours() === 0 &&
    instant.getUTCMinutes() === 0 &&
    instant.getUTCSeconds() === 0 &&
    instant.getUTCMilliseconds() === 0;
  if (alreadyUtcMidnight) {
    return new Date(Date.UTC(instant.getUTCFullYear(), instant.getUTCMonth(), instant.getUTCDate()));
  }
  const { year, month, day } = appTzYmd(instant, timeZone);
  return new Date(Date.UTC(year, month - 1, day));
}
