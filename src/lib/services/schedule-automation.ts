import { Prisma, ShiftTradeStatus } from "@prisma/client";
import { db } from "@/lib/db";
import {
  getCalendarSourceFreshness,
  type CalendarSourceFreshnessInput,
} from "@/lib/calendar-source-freshness";
import { buildScheduleEventWhere } from "@/lib/schedule-event-where";
import { getScheduleHealth } from "@/lib/services/schedule-health";
import { getSchedulePublicationState } from "@/lib/services/schedule-publication";
import { ACTIVE_ASSIGNMENT_STATUSES } from "@/lib/shift-constants";
import type { ScheduleAutomationDigest, ScheduleAutomationCard } from "@/lib/schedule-automation-types";

type ScheduleAutomationInput = {
  userId: string;
  parsedStartDate?: Date | null;
  parsedEndDate?: Date | null;
  includePast: boolean;
  includeArchived: boolean;
  sportCode: string | null;
  now?: Date;
  maintenance?: {
    syncResults?: Array<{
      eventsAdded?: number;
      eventsUpdated?: number;
      groupsCreated?: number;
      shiftsCreated?: number;
      error?: string;
    }>;
    shiftGroupsArchived?: number;
    eventsArchived?: number;
    tradesExpired?: number;
    pendingPickupsExpired?: number;
  };
};

const ACTIVE_STATUS_SET = new Set<string>(ACTIVE_ASSIGNMENT_STATUSES);

function countMissingShifts(event: AutomationEvent) {
  const shifts = event.shiftGroup?.shifts ?? [];
  return shifts.filter((shift) =>
    !shift.assignments.some((assignment) => ACTIVE_STATUS_SET.has(assignment.status)),
  ).length;
}

function hasActiveAssignment(event: AutomationEvent) {
  return Boolean(event.shiftGroup?.shifts.some((shift) =>
    shift.assignments.some((assignment) => ACTIVE_STATUS_SET.has(assignment.status)),
  ));
}

function eventPublicationStatus(event: AutomationEvent) {
  if (!event.shiftGroup) return null;
  return getSchedulePublicationState(event.shiftGroup);
}

function firstHref(eventIds: string[]) {
  return eventIds[0] ? `/events/${eventIds[0]}` : undefined;
}

function sumSync(results: NonNullable<ScheduleAutomationInput["maintenance"]>["syncResults"], key: "eventsAdded" | "eventsUpdated" | "groupsCreated" | "shiftsCreated") {
  return (results ?? []).reduce((sum, result) => sum + (result[key] ?? 0), 0);
}

function card(args: ScheduleAutomationCard): ScheduleAutomationCard {
  return args;
}

type AutomationEvent = Awaited<ReturnType<typeof loadAutomationEvents>>[number];

async function loadAutomationEvents(where: Prisma.CalendarEventWhereInput) {
  return db.calendarEvent.findMany({
    where,
    orderBy: { startsAt: "asc" },
    take: 200,
    select: {
      id: true,
      sourceId: true,
      startsAt: true,
      endsAt: true,
      shiftGroup: {
        select: {
          publishedAt: true,
          publishedById: true,
          lastPublishedSnapshot: true,
          shifts: {
            select: {
              id: true,
              area: true,
              workerType: true,
              startsAt: true,
              endsAt: true,
              callStartsAt: true,
              callEndsAt: true,
              assignments: {
                select: {
                  id: true,
                  userId: true,
                  status: true,
                  callStartsAt: true,
                  callEndsAt: true,
                  callNote: true,
                  acknowledgedAt: true,
                  hasConflict: true,
                },
              },
            },
          },
        },
      },
    },
  });
}

async function loadCalendarSources(now: Date) {
  const sources = await db.calendarSource.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      enabled: true,
      lastFetchedAt: true,
      lastError: true,
    },
  });
  const staleSourceIds = new Set<string>();
  let staleSources = 0;
  let sourceErrors = 0;

  for (const source of sources satisfies CalendarSourceFreshnessInput[]) {
    const state = getCalendarSourceFreshness(source, now);
    if (state === "stale" || state === "never-synced") {
      staleSources += 1;
      staleSourceIds.add(source.id);
    }
    if (state === "error") {
      sourceErrors += 1;
      staleSourceIds.add(source.id);
    }
  }

  return { staleSourceIds, staleSources, sourceErrors };
}

export async function getScheduleAutomationDigest(input: ScheduleAutomationInput): Promise<ScheduleAutomationDigest> {
  const now = input.now ?? new Date();
  const [health, events, sourceState, staleTradesResult] = await Promise.allSettled([
    getScheduleHealth({ ...input, now }),
    loadAutomationEvents(buildScheduleEventWhere({ ...input, now })),
    loadCalendarSources(now),
    db.shiftTrade.count({
      where: {
        status: { in: [ShiftTradeStatus.OPEN, ShiftTradeStatus.CLAIMED] },
        shiftAssignment: {
          shift: { startsAt: { lt: now } },
        },
      },
    }),
  ]);

  const partialFailures: string[] = [];
  const readSettled = <T>(result: PromiseSettledResult<T>, key: string, fallback: T) => {
    if (result.status === "fulfilled") return result.value;
    partialFailures.push(key);
    return fallback;
  };

  const healthSnapshot = readSettled(health, "scheduleHealth", null);
  const automationEvents = readSettled(events, "automationEvents", []);
  const sources = readSettled(sourceState, "sourceState", {
    staleSourceIds: new Set<string>(),
    staleSources: 0,
    sourceErrors: 0,
  });
  const staleTrades = readSettled(staleTradesResult, "staleTrades", 0);

  const readyToPublishEventIds: string[] = [];
  const autoFillCandidateEventIds: string[] = [];
  const staleSourceEventIds: string[] = [];

  for (const event of automationEvents) {
    const missing = countMissingShifts(event);
    const publication = eventPublicationStatus(event);
    if (
      event.shiftGroup &&
      missing === 0 &&
      hasActiveAssignment(event) &&
      publication &&
      publication.status !== "published"
    ) {
      readyToPublishEventIds.push(event.id);
    }
    if (event.shiftGroup && missing > 0 && event.endsAt >= now) {
      autoFillCandidateEventIds.push(event.id);
    }
    if (event.sourceId && sources.staleSourceIds.has(event.sourceId)) {
      staleSourceEventIds.push(event.id);
    }
  }

  const syncResults = input.maintenance?.syncResults ?? [];
  const metrics = {
    openSlots: healthSnapshot?.queues.openSlots.count ?? 0,
    eventsWithoutCrew: healthSnapshot?.queues.eventsWithoutCrew.count ?? 0,
    pendingRequests: healthSnapshot?.queues.pendingRequests.count ?? 0,
    conflicts: healthSnapshot?.queues.conflicts.count ?? 0,
    gearGaps: healthSnapshot?.queues.gearGaps.count ?? 0,
    readyToPublish: readyToPublishEventIds.length,
    autoFillCandidates: autoFillCandidateEventIds.length,
    staleSources: sources.staleSources,
    sourceErrors: sources.sourceErrors + syncResults.filter((result) => result.error).length,
    staleTrades,
    syncEventsAdded: sumSync(syncResults, "eventsAdded"),
    syncEventsUpdated: sumSync(syncResults, "eventsUpdated"),
    syncGroupsCreated: sumSync(syncResults, "groupsCreated"),
    syncShiftsCreated: sumSync(syncResults, "shiftsCreated"),
    shiftGroupsArchived: input.maintenance?.shiftGroupsArchived ?? null,
    eventsArchived: input.maintenance?.eventsArchived ?? null,
    tradesExpired: input.maintenance?.tradesExpired ?? null,
    pendingPickupsExpired: input.maintenance?.pendingPickupsExpired ?? null,
  };

  const cards = [
    card({
      id: "staffing",
      label: "Staffing review",
      value: metrics.openSlots + metrics.eventsWithoutCrew,
      detail: metrics.openSlots > 0
        ? `${metrics.openSlots} open slots across ${healthSnapshot?.queues.openSlots.eventCount ?? 0} events`
        : metrics.eventsWithoutCrew > 0
          ? `${metrics.eventsWithoutCrew} events need crew setup`
          : "No staffing gaps in this window",
      tone: metrics.openSlots + metrics.eventsWithoutCrew > 0 ? "critical" : "good",
      action: metrics.openSlots + metrics.eventsWithoutCrew > 0
        ? { label: "Open queue", queue: "needs-staffing" }
        : undefined,
      eventIds: [
        ...(healthSnapshot?.queues.openSlots.eventIds ?? []),
        ...(healthSnapshot?.queues.eventsWithoutCrew.eventIds ?? []),
      ],
    }),
    card({
      id: "auto-fill",
      label: "Auto-fill preview",
      value: metrics.autoFillCandidates,
      detail: metrics.autoFillCandidates > 0
        ? "Events have open slots ready for preview"
        : "No preview-ready staffing gaps",
      tone: metrics.autoFillCandidates > 0 ? "attention" : "neutral",
      action: metrics.autoFillCandidates > 0
        ? { label: "Open assign", href: "/schedule/assign" }
        : undefined,
      eventIds: autoFillCandidateEventIds,
    }),
    card({
      id: "publish",
      label: "Publish readiness",
      value: metrics.readyToPublish,
      detail: metrics.readyToPublish > 0
        ? "Covered events have draft or changed schedules"
        : "No covered draft schedules waiting",
      tone: metrics.readyToPublish > 0 ? "attention" : "good",
      action: metrics.readyToPublish > 0
        ? { label: "Review event", href: firstHref(readyToPublishEventIds) }
        : undefined,
      eventIds: readyToPublishEventIds,
    }),
    card({
      id: "risk",
      label: "Risk blockers",
      value: metrics.conflicts + metrics.gearGaps + metrics.pendingRequests,
      detail: `${metrics.conflicts} conflicts, ${metrics.pendingRequests} requests, ${metrics.gearGaps} gear gaps`,
      tone: metrics.conflicts > 0 ? "critical" : metrics.gearGaps + metrics.pendingRequests > 0 ? "attention" : "good",
      action: metrics.conflicts > 0
        ? { label: "Review conflicts", queue: "conflicts" }
        : metrics.pendingRequests > 0
          ? { label: "Review requests", queue: "pending-requests" }
          : metrics.gearGaps > 0
            ? { label: "Review gear", queue: "gear-gaps" }
            : undefined,
      eventIds: [
        ...(healthSnapshot?.queues.conflicts.eventIds ?? []),
        ...(healthSnapshot?.queues.pendingRequests.eventIds ?? []),
        ...(healthSnapshot?.queues.gearGaps.eventIds ?? []),
      ],
    }),
    card({
      id: "sources",
      label: "Source state",
      value: metrics.sourceErrors + metrics.staleSources,
      detail: metrics.sourceErrors > 0
        ? `${metrics.sourceErrors} source errors need attention`
        : metrics.staleSources > 0
          ? `${metrics.staleSources} stale or never-synced sources`
          : `${metrics.syncEventsAdded} added, ${metrics.syncEventsUpdated} updated in last run context`,
      tone: metrics.sourceErrors > 0 ? "critical" : metrics.staleSources > 0 ? "attention" : "good",
      action: metrics.sourceErrors + metrics.staleSources > 0
        ? { label: "Open sources", href: "/settings/calendar-sources" }
        : undefined,
      eventIds: staleSourceEventIds,
    }),
    card({
      id: "cleanup",
      label: "Daily cleanup",
      value: metrics.tradesExpired ?? metrics.staleTrades,
      detail: input.maintenance
        ? `${metrics.shiftGroupsArchived ?? 0} groups archived, ${metrics.tradesExpired ?? 0} trades expired, ${metrics.pendingPickupsExpired ?? 0} pickups expired`
        : metrics.staleTrades > 0
          ? `${metrics.staleTrades} stale trades will be cleaned up by morning refresh`
          : "No stale trades detected",
      tone: metrics.staleTrades > 0 || (metrics.tradesExpired ?? 0) > 0 ? "attention" : "neutral",
      action: metrics.staleTrades > 0
        ? { label: "Open board", openTradeBoard: true }
        : undefined,
    }),
  ];

  return {
    generatedAt: now.toISOString(),
    window: {
      startsAt: input.parsedStartDate?.toISOString() ?? null,
      endsAt: input.parsedEndDate?.toISOString() ?? null,
      includePast: input.includePast,
      includeArchived: input.includeArchived,
      sportCode: input.sportCode,
    },
    metrics,
    cards,
    partialFailures: [
      ...new Set([
        ...partialFailures,
        ...(healthSnapshot?.partialFailures ?? []),
      ]),
    ],
  };
}
