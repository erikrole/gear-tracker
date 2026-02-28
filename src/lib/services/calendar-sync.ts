import { db } from "@/lib/db";
import type { CalendarEventStatus } from "@prisma/client";

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
function parseIcsDate(value: string): { date: Date; allDay: boolean } {
  const cleaned = value.replace(/[^0-9TZ]/g, "");

  if (cleaned.length === 8) {
    // Date only: YYYYMMDD
    const year = parseInt(cleaned.slice(0, 4));
    const month = parseInt(cleaned.slice(4, 6)) - 1;
    const day = parseInt(cleaned.slice(6, 8));
    return { date: new Date(year, month, day), allDay: true };
  }

  // Date-time: YYYYMMDDTHHMMSS or YYYYMMDDTHHMMSSZ
  const year = parseInt(cleaned.slice(0, 4));
  const month = parseInt(cleaned.slice(4, 6)) - 1;
  const day = parseInt(cleaned.slice(6, 8));
  const hour = parseInt(cleaned.slice(9, 11)) || 0;
  const minute = parseInt(cleaned.slice(11, 13)) || 0;
  const second = parseInt(cleaned.slice(13, 15)) || 0;

  const date = cleaned.endsWith("Z")
    ? new Date(Date.UTC(year, month, day, hour, minute, second))
    : new Date(year, month, day, hour, minute, second);

  return { date, allDay: false };
}

function mapIcsStatus(status: string): CalendarEventStatus {
  const normalized = status.toUpperCase().trim();
  if (normalized === "CANCELLED") return "CANCELLED";
  if (normalized === "TENTATIVE") return "TENTATIVE";
  return "CONFIRMED";
}

/**
 * Sync a single CalendarSource — fetches ICS, parses, upserts events.
 */
export async function syncCalendarSource(sourceId: string): Promise<{
  added: number;
  updated: number;
  cancelled: number;
  error?: string;
}> {
  const source = await db.calendarSource.findUnique({ where: { id: sourceId } });
  if (!source || !source.enabled) {
    return { added: 0, updated: 0, cancelled: 0, error: "Source not found or disabled" };
  }

  // Normalize webcal:// to https://
  const url = source.url.replace(/^webcal:\/\//, "https://");

  let icsText: string;
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "GearTracker/1.0" }
    });
    if (!response.ok) {
      const error = `HTTP ${response.status}: ${response.statusText}`;
      await db.calendarSource.update({
        where: { id: sourceId },
        data: { lastError: error, lastFetchedAt: new Date() }
      });
      return { added: 0, updated: 0, cancelled: 0, error };
    }
    icsText = await response.text();
  } catch (err) {
    const error = err instanceof Error ? err.message : "Fetch failed";
    await db.calendarSource.update({
      where: { id: sourceId },
      data: { lastError: error, lastFetchedAt: new Date() }
    });
    return { added: 0, updated: 0, cancelled: 0, error };
  }

  const events = parseIcs(icsText);

  // Load location mappings
  const mappings = await db.locationMapping.findMany({
    orderBy: { priority: "desc" }
  });

  let added = 0;
  let updated = 0;
  let cancelled = 0;

  for (const event of events) {
    const startParsed = parseIcsDate(event.dtstart);
    const endParsed = parseIcsDate(event.dtend);
    const status = mapIcsStatus(event.status);

    // Apply location mapping
    let locationId: string | null = null;
    const searchText = `${event.location} ${event.summary}`.toLowerCase();

    for (const mapping of mappings) {
      try {
        const regex = new RegExp(mapping.pattern, "i");
        if (regex.test(searchText)) {
          locationId = mapping.locationId;
          break;
        }
      } catch {
        // Invalid regex, try simple includes
        if (searchText.includes(mapping.pattern.toLowerCase())) {
          locationId = mapping.locationId;
          break;
        }
      }
    }

    const existing = await db.calendarEvent.findUnique({
      where: { sourceId_externalId: { sourceId, externalId: event.uid } }
    });

    if (existing) {
      await db.calendarEvent.update({
        where: { id: existing.id },
        data: {
          summary: event.summary,
          description: event.description || null,
          rawSummary: event.summary,
          rawLocationText: event.location || null,
          rawDescription: event.description || null,
          startsAt: startParsed.date,
          endsAt: endParsed.date,
          allDay: startParsed.allDay,
          status,
          locationId
        }
      });
      if (status === "CANCELLED") cancelled++;
      else updated++;
    } else {
      await db.calendarEvent.create({
        data: {
          sourceId,
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
          locationId
        }
      });
      added++;
    }
  }

  // Update source metadata
  await db.calendarSource.update({
    where: { id: sourceId },
    data: {
      lastFetchedAt: new Date(),
      lastError: null
    }
  });

  return { added, updated, cancelled };
}

/**
 * Sync all enabled calendar sources.
 */
export async function syncAllCalendarSources() {
  const sources = await db.calendarSource.findMany({ where: { enabled: true } });
  const results: Array<{ sourceId: string; name: string; added: number; updated: number; cancelled: number; error?: string }> = [];

  for (const source of sources) {
    const result = await syncCalendarSource(source.id);
    results.push({ sourceId: source.id, name: source.name, ...result });
  }

  return results;
}
