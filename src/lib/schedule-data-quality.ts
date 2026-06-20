export type ScheduleDataQualityEvent = {
  id: string;
  startsAt: Date | string;
  endsAt: Date | string;
  sportCode: string | null;
  opponent: string | null;
  isHome: boolean | null;
  locationId?: string | null;
  location?: { id: string; name: string } | null;
  shiftGroup?: { shifts: unknown[] } | null;
  archivedAt?: Date | string | null;
};

export type ScheduleDataQualityReason =
  | "missing_sport"
  | "missing_opponent"
  | "missing_venue"
  | "missing_home_venue_mapping"
  | "future_archived"
  | "shifts_without_sport";

export type ScheduleDataQualityIssue = {
  eventId: string;
  reason: ScheduleDataQualityReason;
};

export type ScheduleDataQualitySummary = {
  count: number;
  eventCount: number;
  eventIds: string[];
  issues: ScheduleDataQualityIssue[];
};

function hasValue(value: string | null | undefined) {
  return Boolean(value?.trim());
}

function isFutureArchived(event: ScheduleDataQualityEvent, now: Date) {
  if (!event.archivedAt) return false;
  const endsAt = new Date(event.endsAt);
  return !Number.isNaN(endsAt.getTime()) && endsAt.getTime() >= now.getTime();
}

export function getScheduleDataQuality(event: ScheduleDataQualityEvent, now = new Date()): ScheduleDataQualityIssue[] {
  const issues: ScheduleDataQualityIssue[] = [];
  const hasSport = hasValue(event.sportCode);
  const hasOpponent = hasValue(event.opponent);
  const hasLocation = Boolean(event.locationId ?? event.location?.id);
  const shiftCount = event.shiftGroup?.shifts.length ?? 0;

  if (!hasSport && (hasOpponent || event.isHome !== null || shiftCount > 0)) {
    issues.push({ eventId: event.id, reason: "missing_sport" });
  }

  if (hasSport && !hasOpponent) {
    issues.push({ eventId: event.id, reason: "missing_opponent" });
  }

  if (hasSport && event.isHome === null && !hasLocation) {
    issues.push({ eventId: event.id, reason: "missing_venue" });
  }

  if (hasSport && event.isHome !== null && !hasLocation) {
    issues.push({ eventId: event.id, reason: "missing_home_venue_mapping" });
  }

  if (!hasSport && shiftCount > 0) {
    issues.push({ eventId: event.id, reason: "shifts_without_sport" });
  }

  if (isFutureArchived(event, now)) {
    issues.push({ eventId: event.id, reason: "future_archived" });
  }

  return issues;
}

export function summarizeScheduleDataQuality(
  events: ScheduleDataQualityEvent[],
  now = new Date(),
): ScheduleDataQualitySummary {
  const issues = events.flatMap((event) => getScheduleDataQuality(event, now));
  const eventIds = [...new Set(issues.map((issue) => issue.eventId))];
  return {
    count: issues.length,
    eventCount: eventIds.length,
    eventIds,
    issues,
  };
}
