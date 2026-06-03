export type CalendarSourceSyncResult = {
  added?: number;
  updated?: number;
  cancelled?: number;
  skipped?: number;
  errors?: unknown[];
  error?: string | null;
  shiftGeneration?: {
    groupsCreated?: number;
    shiftsCreated?: number;
  } | null;
  shiftGenerationError?: string | null;
};

export type CalendarSourceSyncToast = {
  variant: "success" | "warning" | "error";
  message: string;
};

function count(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function plural(value: number, singular: string, pluralForm = `${singular}s`) {
  return `${value} ${value === 1 ? singular : pluralForm}`;
}

function eventSummary(result: CalendarSourceSyncResult) {
  const added = count(result.added);
  const refreshed = count(result.updated);
  const cancelled = count(result.cancelled);
  const skipped = count(result.skipped);
  const parts: string[] = [];

  if (added > 0) parts.push(plural(added, "event") + " added");
  if (refreshed > 0) parts.push(plural(refreshed, "event") + " refreshed");
  if (cancelled > 0) parts.push(plural(cancelled, "event") + " cancelled");
  if (skipped > 0) parts.push(plural(skipped, "event") + " skipped");

  return parts.length > 0 ? parts.join(", ") : "no event changes";
}

function shiftSummary(result: CalendarSourceSyncResult) {
  if (result.shiftGenerationError) {
    return "Shift generation failed after sync.";
  }

  const groupsCreated = count(result.shiftGeneration?.groupsCreated);
  const shiftsCreated = count(result.shiftGeneration?.shiftsCreated);
  if (groupsCreated === 0 && shiftsCreated === 0) {
    return "No new shifts needed.";
  }

  return `Created ${plural(groupsCreated, "shift group")} and ${plural(shiftsCreated, "shift")}.`;
}

export function calendarSourceSyncToast(
  sourceName: string,
  result: CalendarSourceSyncResult,
): CalendarSourceSyncToast {
  if (result.error) {
    return {
      variant: "error",
      message: `${sourceName} sync failed: ${result.error}`,
    };
  }

  const summary = eventSummary(result);
  const shift = shiftSummary(result);
  const hasSkippedEvents = count(result.skipped) > 0 || (result.errors?.length ?? 0) > 0;
  const hasShiftError = Boolean(result.shiftGenerationError);

  if (hasSkippedEvents || hasShiftError) {
    return {
      variant: "warning",
      message: `Synced ${sourceName} with warnings: ${summary}. ${shift}`,
    };
  }

  return {
    variant: "success",
    message: `Synced ${sourceName}: ${summary}. ${shift}`,
  };
}

export function calendarSourceHealthErrorFromSync(result: CalendarSourceSyncResult) {
  if (result.error) return result.error;
  const skipped = count(result.skipped);
  if (skipped > 0 || (result.errors?.length ?? 0) > 0) {
    return `${plural(skipped, "event")} skipped during the last sync.`;
  }
  return null;
}
