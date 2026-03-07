import { db } from "@/lib/db";
import type { CalendarEventStatus } from "@prisma/client";

/** Max events per createMany / update batch — keeps Worker subrequests in check */
export const WRITE_CHUNK_SIZE = 50;

/**
 * Minimal ICS parser — extracts VEVENT blocks and their key properties.
 * Does not depend on any external library.
 */
function parseIcs(icsText: string) {
  const events: Array<{
    uid: string;
    summary: string;
    description: string;
    location: string;
    dtstart: string;
    dtend: string;
    status: string;
  }> = [];

  // Unfold continued lines (RFC 5545 §3.1)
  const unfolded = icsText.replace(/\r?\n[ \t]/g, "");
  const lines = unfolded.split(/\r?\n/);

  let inEvent = false;
  let current: Record<string, string> = {};

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      inEvent = true;
      current = {};
      continue;
    }

    if (line === "END:VEVENT") {
      inEvent = false;
      if (current.UID) {
        events.push({
          uid: current.UID,
          summary: current.SUMMARY ?? "",
          description: current.DESCRIPTION ?? "",
          location: current.LOCATION ?? "",
          dtstart: current.DTSTART ?? "",
          dtend: current.DTEND ?? current.DTSTART ?? "",
          status: current.STATUS ?? "CONFIRMED"
        });
      }
      continue;
    }

    if (!inEvent) continue;

    // Handle properties with parameters like DTSTART;VALUE=DATE:20260301
    const colonIdx = line.indexOf(":");
    if (colonIdx < 0) continue;

    const key = line.slice(0, colonIdx).split(";")[0].toUpperCase();
    const value = line.slice(colonIdx + 1);
    current[key] = value;
  }

  return events;
}

/** Parse ICS date strings: 20260301, 20260301T120000, 20260301T120000Z */
export function parseIcsDate(value: string): { date: Date; allDay: boolean } {
  const cleaned = value.replace(/[^0-9TZ]/g, "");

  if (cleaned.length === 8) {
    // Date only: YYYYMMDD — use UTC to avoid timezone ambiguity on edge
    const year = parseInt(cleaned.slice(0, 4));
    const month = parseInt(cleaned.slice(4, 6)) - 1;
    const day = parseInt(cleaned.slice(6, 8));
    return { date: new Date(Date.UTC(year, month, day)), allDay: true };
  }

  // Date-time: YYYYMMDDTHHMMSS or YYYYMMDDTHHMMSSZ
  const year = parseInt(cleaned.slice(0, 4));
  const month = parseInt(cleaned.slice(4, 6)) - 1;
  const day = parseInt(cleaned.slice(6, 8));
  const hour = parseInt(cleaned.slice(9, 11)) || 0;
  const minute = parseInt(cleaned.slice(11, 13)) || 0;
  const second = parseInt(cleaned.slice(13, 15)) || 0;

  // Always use Date.UTC — edge runtime has no reliable local timezone,
  // and all events in this system are in the same locale anyway
  const date = new Date(Date.UTC(year, month, day, hour, minute, second));

  return { date, allDay: false };
}

/** Returns true if the Date object represents a real, finite point in time. */
function isValidDate(d: Date): boolean {
  return d instanceof Date && !isNaN(d.getTime());
}

function mapIcsStatus(status: string): CalendarEventStatus {
  const normalized = status.toUpperCase().trim();
  if (normalized === "CANCELLED") return "CANCELLED";
  if (normalized === "TENTATIVE") return "TENTATIVE";
  return "CONFIRMED";
}

export type SyncEventError = {
  uid: string;
  summary: string;
  operation: "create" | "update" | "validate";
  reason: string;
};

export type SyncEventSample = {
  uid: string;
  summary: string;
  dtstart: string;
};

export type SyncDiagnostics = {
  fetchUrl: string;
  httpStatus: number;
  responseSizeBytes: number;
  parsedEventCount: number;
  earliestDtstart: string | null;
  latestDtstart: string | null;
  firstEvents: SyncEventSample[];
  lastEvents: SyncEventSample[];
};

export type SyncResult = {
  added: number;
  updated: number;
  cancelled: number;
  skipped: number;
  errors: SyncEventError[];
  diagnostics?: SyncDiagnostics;
  error?: string;
};

// ── Validated event shape for DB writes ──

type ValidatedEventData = {
  externalId: string;
  summary: string;
  description: string | null;
  rawSummary: string;
  rawLocationText: string | null;
  rawDescription: string | null;
  startsAt: Date;
  endsAt: Date;
  allDay: boolean;
  status: CalendarEventStatus;
  locationId: string | null;
};

export type ExistingEventRow = {
  id: string;
  externalId: string;
  summary: string;
  description: string | null;
  startsAt: Date;
  endsAt: Date;
  allDay: boolean;
  status: string;
  locationId: string | null;
};

export type ParsedIcsEvent = {
  uid: string;
  summary: string;
  description: string;
  location: string;
  dtstart: string;
  dtend: string;
  status: string;
};

/**
 * Pure function: validates parsed events, resolves locations, and splits
 * into create vs update sets by diffing against existing DB rows.
 * Exported for testing — no DB access.
 */
export function splitEventsForSync(
  parsedEvents: ParsedIcsEvent[],
  existingRows: ExistingEventRow[],
  mappings: Array<{ pattern: string; locationId: string }>,
) {
  const existingMap = new Map(existingRows.map((r) => [r.externalId, r]));

  const toCreate: ValidatedEventData[] = [];
  const toUpdate: Array<{ id: string; data: ValidatedEventData }> = [];
  const unchanged: string[] = [];
  const skippedErrors: SyncEventError[] = [];

  for (const event of parsedEvents) {
    try {
      const startParsed = parseIcsDate(event.dtstart);
      const endParsed = parseIcsDate(event.dtend);

      if (!isValidDate(startParsed.date)) throw new Error(`Invalid start date: "${event.dtstart}"`);
      if (!isValidDate(endParsed.date)) throw new Error(`Invalid end date: "${event.dtend}"`);

      const status = mapIcsStatus(event.status);
      let locationId: string | null = null;
      const searchText = `${event.location} ${event.summary}`.toLowerCase();

      for (const mapping of mappings) {
        try {
          if (new RegExp(mapping.pattern, "i").test(searchText)) { locationId = mapping.locationId; break; }
        } catch {
          if (searchText.includes(mapping.pattern.toLowerCase())) { locationId = mapping.locationId; break; }
        }
      }

      const data: ValidatedEventData = {
        externalId: event.uid,
        summary: event.summary,
        description: event.description || null,
        rawSummary: event.summary,
        rawLocationText: event.location || null,
        rawDescription: event.description || null,
        startsAt: startParsed.date,
        endsAt: endParsed.date,
        allDay: startParsed.allDay,
        status,
        locationId,
      };

      const existing = existingMap.get(event.uid);
      if (existing) {
        const changed =
          existing.summary !== data.summary ||
          existing.description !== data.description ||
          existing.startsAt.getTime() !== data.startsAt.getTime() ||
          existing.endsAt.getTime() !== data.endsAt.getTime() ||
          existing.allDay !== data.allDay ||
          existing.status !== data.status ||
          existing.locationId !== data.locationId;

        if (changed) {
          toUpdate.push({ id: existing.id, data });
        } else {
          unchanged.push(event.uid);
        }
      } else {
        toCreate.push(data);
      }
    } catch (err) {
      const reason = err instanceof Error ? err.message : "Unknown error";
      skippedErrors.push({
        uid: event.uid,
        summary: event.summary.slice(0, 120),
        operation: "validate",
        reason: reason.length > 300 ? reason.slice(0, 300) + "\u2026" : reason,
      });
    }
  }

  return { toCreate, toUpdate, unchanged, skippedErrors };
}

/**
 * Sync a single CalendarSource — fetches ICS, parses, upserts events.
 *
 * DB query budget (for ~274 events, well under Cloudflare Worker limits):
 *   1 findUnique (source) + 1 fetch + 1 findMany (mappings) + 1 findMany (existing)
 *   + ceil(creates/50) createMany + ceil(changedUpdates/50) update chunks
 *   + 1 source metadata update = ~8–12 queries total
 */
export async function syncCalendarSource(sourceId: string): Promise<SyncResult> {
  const source = await db.calendarSource.findUnique({ where: { id: sourceId } });
  const emptyResult: SyncResult = { added: 0, updated: 0, cancelled: 0, skipped: 0, errors: [] };

  if (!source || !source.enabled) {
    return { ...emptyResult, error: "Source not found or disabled" };
  }

  // Normalize webcal:// to https://
  const url = source.url.replace(/^webcal:\/\//, "https://");

  let icsText: string;
  let httpStatus = 0;
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "GearTracker/1.0" }
    });
    httpStatus = response.status;
    if (!response.ok) {
      const error = `HTTP ${response.status}: ${response.statusText}`;
      await db.calendarSource.update({
        where: { id: sourceId },
        data: { lastError: error, lastFetchedAt: new Date() }
      });
      return { ...emptyResult, error, diagnostics: { fetchUrl: url, httpStatus, responseSizeBytes: 0, parsedEventCount: 0, earliestDtstart: null, latestDtstart: null, firstEvents: [], lastEvents: [] } };
    }
    icsText = await response.text();
  } catch (err) {
    const error = err instanceof Error ? err.message : "Fetch failed";
    await db.calendarSource.update({
      where: { id: sourceId },
      data: { lastError: error, lastFetchedAt: new Date() }
    });
    return { ...emptyResult, error, diagnostics: { fetchUrl: url, httpStatus, responseSizeBytes: 0, parsedEventCount: 0, earliestDtstart: null, latestDtstart: null, firstEvents: [], lastEvents: [] } };
  }

  const responseSizeBytes = new TextEncoder().encode(icsText).length;
  const events = parseIcs(icsText);

  // Build diagnostics from parsed events (before any DB work)
  const SAMPLE_SIZE = 5;
  const sortedByStart = [...events].sort((a, b) => a.dtstart.localeCompare(b.dtstart));
  const diagnostics: SyncDiagnostics = {
    fetchUrl: url,
    httpStatus,
    responseSizeBytes,
    parsedEventCount: events.length,
    earliestDtstart: sortedByStart.length > 0 ? sortedByStart[0].dtstart : null,
    latestDtstart: sortedByStart.length > 0 ? sortedByStart[sortedByStart.length - 1].dtstart : null,
    firstEvents: sortedByStart.slice(0, SAMPLE_SIZE).map((e) => ({ uid: e.uid, summary: e.summary.slice(0, 120), dtstart: e.dtstart })),
    lastEvents: sortedByStart.slice(-SAMPLE_SIZE).map((e) => ({ uid: e.uid, summary: e.summary.slice(0, 120), dtstart: e.dtstart })),
  };

  // ── Phase 1: Bulk-load existing data (2 queries) ──

  let mappings: Array<{ pattern: string; locationId: string }> = [];
  try {
    mappings = await db.locationMapping.findMany({ orderBy: { priority: "desc" } });
  } catch { /* table may not exist */ }

  const existingRows = await db.calendarEvent.findMany({
    where: { sourceId },
    select: {
      id: true, externalId: true, summary: true, description: true,
      startsAt: true, endsAt: true, allDay: true, status: true, locationId: true,
    }
  });

  // ── Phase 2: In-memory validate + diff (0 queries) ──

  const { toCreate, toUpdate, unchanged, skippedErrors } = splitEventsForSync(events, existingRows, mappings);

  let added = 0;
  const updated = toUpdate.length + unchanged.length;
  const cancelled = 0; // TODO: count cancelled from status if needed
  let skipped = skippedErrors.length;
  const errors: SyncEventError[] = [...skippedErrors];
  const MAX_STORED_ERRORS = 10;

  // ── Phase 3: Batch writes in chunks ──

  // Batch create new events
  for (let i = 0; i < toCreate.length; i += WRITE_CHUNK_SIZE) {
    const chunk = toCreate.slice(i, i + WRITE_CHUNK_SIZE);
    try {
      await db.calendarEvent.createMany({
        data: chunk.map((c) => ({ sourceId, ...c })),
        skipDuplicates: true,
      });
      added += chunk.length;
    } catch (err) {
      skipped += chunk.length;
      if (errors.length < MAX_STORED_ERRORS) {
        const reason = err instanceof Error ? err.message : "Unknown error";
        errors.push({
          uid: chunk.map((e) => e.externalId).join(","),
          summary: `Batch create of ${chunk.length} events`,
          operation: "create",
          reason: reason.length > 300 ? reason.slice(0, 300) + "\u2026" : reason,
        });
      }
    }
  }

  // Batch update changed events (only rows that actually differ)
  for (let i = 0; i < toUpdate.length; i += WRITE_CHUNK_SIZE) {
    const chunk = toUpdate.slice(i, i + WRITE_CHUNK_SIZE);
    try {
      await Promise.all(
        chunk.map((item) =>
          db.calendarEvent.update({ where: { id: item.id }, data: item.data })
        )
      );
    } catch (err) {
      if (errors.length < MAX_STORED_ERRORS) {
        const reason = err instanceof Error ? err.message : "Unknown error";
        errors.push({
          uid: chunk.map((item) => item.data.externalId).join(","),
          summary: `Batch update of ${chunk.length} events`,
          operation: "update",
          reason: reason.length > 300 ? reason.slice(0, 300) + "\u2026" : reason,
        });
      }
    }
  }

  // ── Phase 4: Update source metadata ──

  const lastError = errors.length > 0
    ? `${skipped} of ${events.length} events failed. ${errors.map((e) => `[${e.uid}] ${e.reason}`).join("; ")}`
    : null;

  try {
    await db.calendarSource.update({
      where: { id: sourceId },
      data: { lastFetchedAt: new Date(), lastError }
    });
  } catch {
    // If we can't update source metadata, still return results
  }

  return { added, updated, cancelled, skipped, errors, diagnostics };
}

/**
 * Sync all enabled calendar sources.
 */
export async function syncAllCalendarSources() {
  const sources = await db.calendarSource.findMany({ where: { enabled: true } });
  const results: Array<{ sourceId: string; name: string } & SyncResult> = [];

  for (const source of sources) {
    const result = await syncCalendarSource(source.id);
    results.push({ sourceId: source.id, name: source.name, ...result });
  }

  return results;
}
