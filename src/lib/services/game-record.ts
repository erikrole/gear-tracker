import { db } from "@/lib/db";
import { ACTIVE_ASSIGNMENT_STATUSES } from "@/lib/shift-constants";
import type { CalendarEventSite, Prisma } from "@prisma/client";

/** Wins and losses over some slice of games. */
export type WinLoss = {
  wins: number;
  losses: number;
};

/** Win-loss totals plus the dimensions worth counting them by. */
export type GameRecord = WinLoss & {
  bySport: Array<WinLoss & { sportCode: string | null }>;
  bySite: Array<WinLoss & { site: CalendarEventSite | null }>;
};

export const EMPTY_GAME_RECORD: GameRecord = { wins: 0, losses: 0, bySport: [], bySite: [] };

/** Fixed display order; `null` is unknown and sorts last. */
const SITE_ORDER: Array<CalendarEventSite | null> = ["HOME", "AWAY", "NEUTRAL", null];

/**
 * Games that count toward a record: a real, visible event that carries a
 * source-derived outcome. Mirrors `buildScheduleEventWhere`'s definition of a
 * countable event so a profile record never disagrees with the schedule.
 */
export function gameRecordEventWhere(userId: string): Prisma.CalendarEventWhereInput {
  return {
    result: { not: null },
    status: { not: "CANCELLED" },
    isHidden: false,
    archivedAt: null,
    shiftGroup: {
      shifts: {
        some: {
          assignments: {
            some: { userId, status: { in: ACTIVE_ASSIGNMENT_STATUSES } },
          },
        },
      },
    },
  };
}

function addTo<T extends WinLoss>(bucket: T, result: string | null, count: number): void {
  if (result === "WIN") bucket.wins += count;
  else if (result === "LOSS") bucket.losses += count;
}

/**
 * Tally wins and losses across every game the user held a shift assignment on,
 * broken down by sport and by where the game was played.
 *
 * Grouped by event rather than by assignment: a user working two shifts on one
 * game is one game, not two. Declined and swapped-away assignments are not
 * assignments, so they are excluded via `ACTIVE_ASSIGNMENT_STATUSES`. Site
 * comes from `site`, not `isHome`, so a neutral game is counted as neutral
 * rather than lumped in with games we could not classify.
 */
export async function getGameRecordForUser(userId: string): Promise<GameRecord> {
  const grouped = await db.calendarEvent.groupBy({
    by: ["result", "sportCode", "site"],
    where: gameRecordEventWhere(userId),
    _count: { _all: true },
  });

  const record: GameRecord = { wins: 0, losses: 0, bySport: [], bySite: [] };
  const sports = new Map<string | null, WinLoss & { sportCode: string | null }>();
  const sites = new Map<CalendarEventSite | null, WinLoss & { site: CalendarEventSite | null }>();

  for (const row of grouped) {
    const count = row._count._all;
    addTo(record, row.result, count);

    const sport = sports.get(row.sportCode) ?? { sportCode: row.sportCode, wins: 0, losses: 0 };
    addTo(sport, row.result, count);
    sports.set(row.sportCode, sport);

    const site = sites.get(row.site) ?? { site: row.site, wins: 0, losses: 0 };
    addTo(site, row.result, count);
    sites.set(row.site, site);
  }

  record.bySport = [...sports.values()].sort((a, b) => {
    const played = b.wins + b.losses - (a.wins + a.losses);
    if (played !== 0) return played;
    return (a.sportCode ?? "￿").localeCompare(b.sportCode ?? "￿");
  });
  record.bySite = [...sites.values()].sort(
    (a, b) => SITE_ORDER.indexOf(a.site) - SITE_ORDER.indexOf(b.site),
  );

  return record;
}
