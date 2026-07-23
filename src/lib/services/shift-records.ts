import { db } from "@/lib/db";
import { ACTIVE_ASSIGNMENT_STATUSES } from "@/lib/shift-constants";
import type {
  ShiftRecordSportStats,
  ShiftRecordStats,
} from "@/lib/shift-record-types";
import { sportLabel } from "@/lib/sports";

export async function getShiftRecordStats(
  userId: string,
  now: Date = new Date(),
): Promise<ShiftRecordStats> {
  const assignments = await db.shiftAssignment.findMany({
    where: {
      userId,
      status: { in: ACTIVE_ASSIGNMENT_STATUSES },
      shift: {
        shiftGroup: {
          publishedAt: { not: null },
          event: {
            status: "CONFIRMED",
            endsAt: { lte: now },
          },
        },
      },
    },
    select: {
      id: true,
      shift: {
        select: {
          shiftGroup: {
            select: {
              event: {
                select: {
                  id: true,
                  result: true,
                  sportCode: true,
                },
              },
            },
          },
        },
      },
    },
  });

  let wins = 0;
  let losses = 0;
  const countedEvents = new Set<string>();
  const sportStats = new Map<string, ShiftRecordSportStats & { countedEvents: Set<string> }>();

  for (const assignment of assignments) {
    const event = assignment.shift.shiftGroup.event;
    const sportCode = event.sportCode;
    let sport = sportCode ? sportStats.get(sportCode) : undefined;

    if (sportCode && !sport) {
      sport = {
        sportCode,
        sportLabel: sportLabel(sportCode),
        shiftCount: 0,
        resultEventCount: 0,
        wins: 0,
        losses: 0,
        countedEvents: new Set<string>(),
      };
      sportStats.set(sportCode, sport);
    }

    if (sport) sport.shiftCount += 1;
    if (!event.result) continue;

    if (!countedEvents.has(event.id)) {
      countedEvents.add(event.id);
      if (event.result === "WIN") wins += 1;
      else losses += 1;
    }

    if (sport && !sport.countedEvents.has(event.id)) {
      sport.countedEvents.add(event.id);
      sport.resultEventCount += 1;
      if (event.result === "WIN") sport.wins += 1;
      else sport.losses += 1;
    }
  }

  const bySport = [...sportStats.values()]
    .map((sport) => ({
      sportCode: sport.sportCode,
      sportLabel: sport.sportLabel,
      shiftCount: sport.shiftCount,
      resultEventCount: sport.resultEventCount,
      wins: sport.wins,
      losses: sport.losses,
    }))
    .sort(
      (left, right) =>
        right.resultEventCount - left.resultEventCount
        || left.sportLabel.localeCompare(right.sportLabel),
    );

  return {
    shiftCount: assignments.length,
    resultEventCount: wins + losses,
    wins,
    losses,
    bySport,
  };
}
