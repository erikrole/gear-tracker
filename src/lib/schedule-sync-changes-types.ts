export type CalendarSyncChangeKind = "added" | "modified" | "removed";

export type CalendarSyncChangedField =
  | "title"
  | "description"
  | "date_time"
  | "status"
  | "venue"
  | "event_details";

export type CalendarSyncChange = {
  kind: CalendarSyncChangeKind;
  eventId: string;
  externalId: string;
  summary: string;
  startsAt: string;
  changedFields: CalendarSyncChangedField[];
};

export type ScheduleSyncSourceResult = {
  sourceId: string;
  sourceName: string;
  error: string | null;
  missingEventIds: string[] | null;
  changes: CalendarSyncChange[];
};

export type ScheduleSyncChangesDigest = {
  runAt: string;
  totals: Record<CalendarSyncChangeKind, number>;
  changes: Array<CalendarSyncChange & {
    sourceId: string;
    sourceName: string;
  }>;
  sourceErrors: Array<{
    sourceId: string;
    sourceName: string;
    error: string;
  }>;
  truncated: boolean;
};
