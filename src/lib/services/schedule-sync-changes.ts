import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { SyncResult } from "@/lib/services/calendar-sync";
import type {
  ScheduleSyncChangesDigest,
  ScheduleSyncSourceResult,
} from "@/lib/schedule-sync-changes-types";

export const SCHEDULE_SYNC_CHANGES_CONFIG_KEY = "schedule_sync_changes";
export const MAX_DAILY_SCHEDULE_SYNC_CHANGES = 200;
export const MAX_TRACKED_MISSING_EVENTS_PER_SOURCE = 5_000;

type StoredScheduleSyncChanges = {
  version: 1;
  latestRun: ScheduleSyncChangesDigest | null;
  missingEventIdsBySource: Record<string, string[]>;
};

type RecordScheduleSyncChangesInput = {
  runAt: Date;
  sources: Array<{
    sourceId: string;
    sourceName: string;
    result: SyncResult;
  }>;
};

const EMPTY_STATE: StoredScheduleSyncChanges = {
  version: 1,
  latestRun: null,
  missingEventIdsBySource: {},
};

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function normalizeStoredState(value: unknown): StoredScheduleSyncChanges {
  if (!value || typeof value !== "object" || Array.isArray(value)) return EMPTY_STATE;
  const record = value as Record<string, unknown>;
  const rawMissing = record.missingEventIdsBySource;
  const missingEventIdsBySource =
    rawMissing && typeof rawMissing === "object" && !Array.isArray(rawMissing)
      ? Object.fromEntries(
          Object.entries(rawMissing)
            .filter((entry): entry is [string, string[]] => isStringArray(entry[1]))
            .map(([sourceId, eventIds]) => [
              sourceId,
              eventIds.slice(0, MAX_TRACKED_MISSING_EVENTS_PER_SOURCE),
            ]),
        )
      : {};
  const latestRun =
    record.latestRun && typeof record.latestRun === "object" && !Array.isArray(record.latestRun)
      ? record.latestRun as ScheduleSyncChangesDigest
      : null;

  return { version: 1, latestRun, missingEventIdsBySource };
}

function truncate(value: string, max: number) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function sourceResult(args: RecordScheduleSyncChangesInput["sources"][number]): ScheduleSyncSourceResult {
  return {
    sourceId: args.sourceId,
    sourceName: truncate(args.sourceName, 120),
    error: args.result.error?.trim() ? truncate(args.result.error.trim(), 280) : null,
    missingEventIds: args.result.error
      ? null
      : (args.result.missingEventIds ?? []).slice(0, MAX_TRACKED_MISSING_EVENTS_PER_SOURCE),
    changes: (args.result.changes ?? []).map((change) => ({
      ...change,
      externalId: truncate(change.externalId, 240),
      summary: truncate(change.summary, 180),
    })),
  };
}

function sortChanges(
  left: ScheduleSyncChangesDigest["changes"][number],
  right: ScheduleSyncChangesDigest["changes"][number],
) {
  const kindOrder = { added: 0, modified: 1, removed: 2 };
  return kindOrder[left.kind] - kindOrder[right.kind]
    || left.startsAt.localeCompare(right.startsAt)
    || left.summary.localeCompare(right.summary);
}

export function buildScheduleSyncChangesState(
  currentValue: unknown,
  input: RecordScheduleSyncChangesInput,
): StoredScheduleSyncChanges {
  const current = normalizeStoredState(currentValue);
  const missingEventIdsBySource = { ...current.missingEventIdsBySource };
  const allChanges: ScheduleSyncChangesDigest["changes"] = [];
  const sourceErrors: ScheduleSyncChangesDigest["sourceErrors"] = [];

  for (const source of input.sources.map(sourceResult)) {
    if (source.error) {
      sourceErrors.push({
        sourceId: source.sourceId,
        sourceName: source.sourceName,
        error: source.error,
      });
    }

    const previouslyMissing = new Set(current.missingEventIdsBySource[source.sourceId] ?? []);
    for (const change of source.changes) {
      if (change.kind === "removed" && previouslyMissing.has(change.eventId)) continue;
      allChanges.push({
        ...change,
        sourceId: source.sourceId,
        sourceName: source.sourceName,
      });
    }

    if (source.missingEventIds !== null) {
      missingEventIdsBySource[source.sourceId] = [...new Set(source.missingEventIds)]
        .slice(0, MAX_TRACKED_MISSING_EVENTS_PER_SOURCE);
    }
  }

  allChanges.sort(sortChanges);
  const totals = allChanges.reduce<ScheduleSyncChangesDigest["totals"]>(
    (counts, change) => {
      counts[change.kind] += 1;
      return counts;
    },
    { added: 0, modified: 0, removed: 0 },
  );
  const changes = allChanges.slice(0, MAX_DAILY_SCHEDULE_SYNC_CHANGES);

  return {
    version: 1,
    latestRun: {
      runAt: input.runAt.toISOString(),
      totals,
      changes,
      sourceErrors,
      truncated: changes.length < allChanges.length,
    },
    missingEventIdsBySource,
  };
}

export async function recordScheduleSyncChanges(
  input: RecordScheduleSyncChangesInput,
): Promise<ScheduleSyncChangesDigest> {
  const existing = await db.systemConfig.findUnique({
    where: { key: SCHEDULE_SYNC_CHANGES_CONFIG_KEY },
    select: { value: true },
  });
  const next = buildScheduleSyncChangesState(existing?.value, input);

  await db.systemConfig.upsert({
    where: { key: SCHEDULE_SYNC_CHANGES_CONFIG_KEY },
    update: { value: next as unknown as Prisma.InputJsonValue },
    create: {
      key: SCHEDULE_SYNC_CHANGES_CONFIG_KEY,
      value: next as unknown as Prisma.InputJsonValue,
    },
  });

  return next.latestRun!;
}

export async function getLatestScheduleSyncChanges(): Promise<ScheduleSyncChangesDigest | null> {
  const row = await db.systemConfig.findUnique({
    where: { key: SCHEDULE_SYNC_CHANGES_CONFIG_KEY },
    select: { value: true },
  });
  return normalizeStoredState(row?.value).latestRun;
}
