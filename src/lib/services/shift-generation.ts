import { Prisma, ShiftArea, ShiftWorkerType } from "@prisma/client";
import { db } from "@/lib/db";

const WRITE_CHUNK_SIZE = 500;

type ShiftToCreate = {
  shiftGroupId: string;
  area: ShiftArea;
  workerType: ShiftWorkerType;
  startsAt: Date;
  endsAt: Date;
};

type TemplateShiftConfig = {
  area: ShiftArea;
  homeCount: number;
  awayCount: number;
  homeStaffCount?: number | null;
  homeStudentCount?: number | null;
  awayStaffCount?: number | null;
  awayStudentCount?: number | null;
};

function templateCounts(sc: TemplateShiftConfig, isHome: boolean): Record<ShiftWorkerType, number> {
  if (isHome) {
    return {
      FT: sc.homeStaffCount ?? 0,
      ST: sc.homeStudentCount ?? sc.homeCount,
    };
  }
  return {
    FT: sc.awayStaffCount ?? 0,
    ST: sc.awayStudentCount ?? sc.awayCount,
  };
}

function addTemplateShifts(
  target: Omit<ShiftToCreate, "shiftGroupId">[],
  sc: TemplateShiftConfig,
  isHome: boolean,
  startsAt: Date,
  endsAt: Date,
) {
  const counts = templateCounts(sc, isHome);
  for (const workerType of ["FT", "ST"] as const) {
    for (let i = 0; i < counts[workerType]; i++) {
      target.push({
        area: sc.area,
        workerType,
        startsAt,
        endsAt,
      });
    }
  }
}

/**
 * Generate shifts for a single calendar event based on sport config.
 * Idempotent: skips events that already have a ShiftGroup.
 */
export async function generateShiftsForEvent(eventId: string): Promise<{
  created: boolean;
  shiftGroupId: string | null;
  shiftCount: number;
}> {
  const event = await db.calendarEvent.findUnique({
    where: { id: eventId },
    include: { shiftGroup: true },
  });

  if (!event || !event.sportCode) {
    return { created: false, shiftGroupId: null, shiftCount: 0 };
  }

  // Skip if already has a ShiftGroup (never overwrite manual edits)
  if (event.shiftGroup) {
    return { created: false, shiftGroupId: event.shiftGroup.id, shiftCount: 0 };
  }

  const sportConfig = await db.sportConfig.findUnique({
    where: { sportCode: event.sportCode },
    include: { shiftConfigs: true },
  });

  if (!sportConfig || !sportConfig.active || sportConfig.shiftConfigs.length === 0) {
    return { created: false, shiftGroupId: null, shiftCount: 0 };
  }

  // Create ShiftGroup + Shifts in one transaction
  const isHome = event.isHome ?? true; // Default to home if unknown

  const shiftsData: Omit<ShiftToCreate, "shiftGroupId">[] = [];
  for (const sc of sportConfig.shiftConfigs) {
    addTemplateShifts(
      shiftsData,
      sc,
      isHome,
      new Date(event.startsAt.getTime() - sportConfig.shiftStartOffset * 60_000),
      new Date(event.endsAt.getTime() + sportConfig.shiftEndOffset * 60_000),
    );
  }

  if (shiftsData.length === 0) {
    return { created: false, shiftGroupId: null, shiftCount: 0 };
  }

  const group = await db.$transaction(async (tx) => {
    // Re-check inside transaction to prevent race condition (two concurrent requests)
    const recheck = await tx.calendarEvent.findUnique({
      where: { id: eventId },
      include: { shiftGroup: true },
    });
    if (recheck?.shiftGroup) {
      return { sg: recheck.shiftGroup, alreadyExisted: true };
    }

    const sg = await tx.shiftGroup.create({
      data: {
        eventId: event.id,
        generatedAt: new Date(),
      },
    });

    await tx.shift.createMany({
      data: shiftsData.map((s) => ({
        shiftGroupId: sg.id,
        area: s.area,
        workerType: s.workerType,
        startsAt: s.startsAt,
        endsAt: s.endsAt,
      })),
    });

    return { sg, alreadyExisted: false };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  if (group.alreadyExisted) {
    return { created: false, shiftGroupId: group.sg.id, shiftCount: 0 };
  }
  return { created: true, shiftGroupId: group.sg.id, shiftCount: shiftsData.length };
}

/**
 * Maximum events to process per invocation. Prevents Vercel serverless
 * timeout (10s Hobby / 60s Pro) when the backlog is large. Callers that
 * need to process more should call in a loop or via a cron job.
 */
const EVENT_BATCH_LIMIT = 200;

/**
 * Batch generate shifts for calendar events matching a WHERE clause.
 *
 * Performance: 2 DB reads (events + sport configs) + 1 transaction for
 * all writes. No N+1 — sport configs are pre-loaded into a Map before
 * the event loop. Writes are chunked in groups of WRITE_CHUNK_SIZE.
 *
 * The event query is capped at EVENT_BATCH_LIMIT to stay within Vercel
 * serverless timeouts. The `hasMore` flag signals whether another call
 * is needed to finish processing.
 *
 * Used by both the backfill route and the post-sync hook.
 */
export async function generateShiftsForEvents(opts: {
  where: Prisma.CalendarEventWhereInput;
  limit?: number;
}): Promise<{
  eventsMatched: number;
  groupsCreated: number;
  shiftsCreated: number;
  hasMore: boolean;
}> {
  const take = Math.min(opts.limit ?? EVENT_BATCH_LIMIT, EVENT_BATCH_LIMIT);

  const events = await db.calendarEvent.findMany({
    where: opts.where,
    select: {
      id: true,
      sportCode: true,
      isHome: true,
      startsAt: true,
      endsAt: true,
    },
    orderBy: { startsAt: "asc" },
    take: take + 1, // fetch one extra to detect whether more remain
  });

  const hasMore = events.length > take;
  if (hasMore) events.pop(); // remove the extra sentinel row

  if (events.length === 0) {
    return { eventsMatched: 0, groupsCreated: 0, shiftsCreated: 0, hasMore: false };
  }

  // Load all active sport configs in one query
  const sportCodes = [...new Set(events.filter((e) => e.sportCode).map((e) => e.sportCode!))];
  const sportConfigs = await db.sportConfig.findMany({
    where: { sportCode: { in: sportCodes }, active: true },
    include: { shiftConfigs: true },
  });
  const configMap = new Map(sportConfigs.map((c) => [c.sportCode, c]));

  // Build all shift groups and shifts to create
  const groupsToCreate: Array<{ eventId: string; generatedAt: Date }> = [];
  const pendingShifts: Array<{
    eventIndex: number;
    area: ShiftArea;
    workerType: ShiftWorkerType;
    startsAt: Date;
    endsAt: Date;
  }> = [];

  for (let i = 0; i < events.length; i++) {
    const event = events[i]!; // in-bounds by loop condition
    const config = event.sportCode ? configMap.get(event.sportCode) : undefined;
    if (!config || config.shiftConfigs.length === 0) continue;

    const isHome = event.isHome ?? true;

    let hasShifts = false;
    const shiftStart = new Date(event.startsAt.getTime() - config.shiftStartOffset * 60_000);
    const shiftEnd = new Date(event.endsAt.getTime() + config.shiftEndOffset * 60_000);
    for (const sc of config.shiftConfigs) {
      const counts = templateCounts(sc, isHome);
      for (const workerType of ["FT", "ST"] as const) {
        for (let j = 0; j < counts[workerType]; j++) {
          pendingShifts.push({
            eventIndex: groupsToCreate.length,
            area: sc.area,
            workerType,
            startsAt: shiftStart,
            endsAt: shiftEnd,
          });
          hasShifts = true;
        }
      }
    }

    if (hasShifts) {
      groupsToCreate.push({ eventId: event.id, generatedAt: new Date() });
    }
  }

  if (groupsToCreate.length === 0) {
    return { eventsMatched: events.length, groupsCreated: 0, shiftsCreated: 0, hasMore };
  }

  // Create all shift groups and shifts in a transaction
  const result = await db.$transaction(async (tx) => {
    // Create groups one by one to get their IDs (createMany doesn't return IDs)
    const createdGroups: string[] = [];
    for (let i = 0; i < groupsToCreate.length; i += WRITE_CHUNK_SIZE) {
      const chunk = groupsToCreate.slice(i, i + WRITE_CHUNK_SIZE);
      for (const g of chunk) {
        const sg = await tx.shiftGroup.create({ data: g });
        createdGroups.push(sg.id);
      }
    }

    // Map pendingShifts to actual shift group IDs
    const allShifts = pendingShifts.map((s) => ({
      shiftGroupId: createdGroups[s.eventIndex]!, // eventIndex is set to groupsToCreate.length at push time
      area: s.area,
      workerType: s.workerType,
      startsAt: s.startsAt,
      endsAt: s.endsAt,
    }));

    // Batch create shifts
    for (let i = 0; i < allShifts.length; i += WRITE_CHUNK_SIZE) {
      const chunk = allShifts.slice(i, i + WRITE_CHUNK_SIZE);
      await tx.shift.createMany({ data: chunk });
    }

    return { groupsCreated: createdGroups.length, shiftsCreated: allShifts.length };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  return { eventsMatched: events.length, ...result, hasMore };
}

/**
 * Generate shifts for all calendar events from a source that don't have shifts yet.
 * Called as a post-sync hook after ICS sync completes.
 */
export async function generateShiftsForNewEvents(sourceId: string): Promise<{
  groupsCreated: number;
  shiftsCreated: number;
}> {
  const result = await generateShiftsForEvents({
    where: {
      sourceId,
      sportCode: { not: null },
      shiftGroup: null,
      startsAt: { gte: new Date() },
    },
  });
  return { groupsCreated: result.groupsCreated, shiftsCreated: result.shiftsCreated };
}

/**
 * Regenerate shifts for an event from its sport config template.
 * Only adds missing area positions — does not remove existing shifts with assignments.
 */
export async function regenerateShiftsForEvent(eventId: string): Promise<{
  added: number;
}> {
  const event = await db.calendarEvent.findUnique({
    where: { id: eventId },
    include: {
      shiftGroup: {
        include: { shifts: true },
      },
    },
  });

  if (!event || !event.sportCode || !event.shiftGroup) {
    return { added: 0 };
  }

  // Skip regeneration for manually-edited shift groups
  if (event.shiftGroup.manuallyEdited) {
    return { added: 0 };
  }

  const sportConfig = await db.sportConfig.findUnique({
    where: { sportCode: event.sportCode },
    include: { shiftConfigs: true },
  });

  if (!sportConfig || !sportConfig.active) {
    return { added: 0 };
  }

  const isHome = event.isHome ?? true;
  const existingShifts = event.shiftGroup.shifts;

  // Count existing shifts per area and planned worker kind.
  const existingCounts = new Map<string, number>();
  for (const shift of existingShifts) {
    const key = `${shift.area}:${shift.workerType}`;
    existingCounts.set(key, (existingCounts.get(key) ?? 0) + 1);
  }

  // Add missing positions
  const newShifts: Array<{
    shiftGroupId: string;
    area: ShiftArea;
    workerType: ShiftWorkerType;
    startsAt: Date;
    endsAt: Date;
  }> = [];

  for (const sc of sportConfig.shiftConfigs) {
    const counts = templateCounts(sc, isHome);
    for (const workerType of ["FT", "ST"] as const) {
      const currentCount = existingCounts.get(`${sc.area}:${workerType}`) ?? 0;
      const toAdd = Math.max(0, counts[workerType] - currentCount);

      for (let i = 0; i < toAdd; i++) {
        newShifts.push({
          shiftGroupId: event.shiftGroup.id,
          area: sc.area,
          workerType,
          startsAt: new Date(event.startsAt.getTime() - sportConfig.shiftStartOffset * 60_000),
          endsAt: new Date(event.endsAt.getTime() + sportConfig.shiftEndOffset * 60_000),
        });
      }
    }
  }

  if (newShifts.length === 0) {
    return { added: 0 };
  }

  await db.shift.createMany({ data: newShifts });

  return { added: newShifts.length };
}
