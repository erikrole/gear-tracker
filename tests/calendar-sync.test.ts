import { describe, it, expect } from "vitest";
import { parseIcsDate, type SyncResult, type SyncEventError } from "@/lib/services/calendar-sync";

// ── parseIcsDate unit tests ──

describe("parseIcsDate", () => {
  it("parses a date-only value (YYYYMMDD) as allDay", () => {
    const result = parseIcsDate("20260301");
    expect(result.allDay).toBe(true);
    expect(result.date.getFullYear()).toBe(2026);
    expect(result.date.getMonth()).toBe(2); // March = 2
    expect(result.date.getDate()).toBe(1);
  });

  it("parses a UTC datetime (YYYYMMDDTHHMMSSZ)", () => {
    const result = parseIcsDate("20260315T143000Z");
    expect(result.allDay).toBe(false);
    expect(result.date.getUTCHours()).toBe(14);
    expect(result.date.getUTCMinutes()).toBe(30);
  });

  it("parses a local datetime (YYYYMMDDTHHMMSS)", () => {
    const result = parseIcsDate("20260315T143000");
    expect(result.allDay).toBe(false);
    expect(result.date.getHours()).toBe(14);
    expect(result.date.getMinutes()).toBe(30);
  });

  it("returns Invalid Date for empty string", () => {
    const result = parseIcsDate("");
    expect(isNaN(result.date.getTime())).toBe(true);
  });

  it("returns Invalid Date for garbage input", () => {
    const result = parseIcsDate("not-a-date");
    expect(isNaN(result.date.getTime())).toBe(true);
  });

  it("returns Invalid Date for truncated date string", () => {
    const result = parseIcsDate("2026");
    // Only 4 digits cleaned — doesn't match 8-digit or datetime patterns
    expect(isNaN(result.date.getTime())).toBe(true);
  });
});

// ── isValidDate logic (mirrors the guard in syncCalendarSource) ──

function isValidDate(d: Date): boolean {
  return d instanceof Date && !isNaN(d.getTime());
}

describe("date validation guard", () => {
  it("accepts a valid parsed date", () => {
    const { date } = parseIcsDate("20260301");
    expect(isValidDate(date)).toBe(true);
  });

  it("rejects an empty dtstart", () => {
    const { date } = parseIcsDate("");
    expect(isValidDate(date)).toBe(false);
  });

  it("rejects garbage dtstart", () => {
    const { date } = parseIcsDate("INVALID");
    expect(isValidDate(date)).toBe(false);
  });
});

// ── SyncResult type contract tests ──
// Ensures the shape stays stable for consumers (API route, UI, syncAll)

describe("SyncResult type shape", () => {
  it("has all required fields including skipped and errors", () => {
    const result: SyncResult = {
      added: 2,
      updated: 1,
      cancelled: 0,
      skipped: 1,
      errors: [{ uid: "abc", summary: "Bad event", reason: "Invalid start date" }],
    };
    expect(result.skipped).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].uid).toBe("abc");
  });

  it("allows optional error field for fetch-level failures", () => {
    const result: SyncResult = {
      added: 0,
      updated: 0,
      cancelled: 0,
      skipped: 0,
      errors: [],
      error: "HTTP 503: Service Unavailable",
    };
    expect(result.error).toBeTruthy();
  });
});

// ── Per-event error isolation logic (simulation) ──
// These tests verify the algorithm that the hardened sync loop uses,
// without needing Prisma or fetch mocks.

type ParsedIcsEvent = {
  uid: string;
  summary: string;
  dtstart: string;
  dtend: string;
};

function simulateEventLoop(events: ParsedIcsEvent[]): Pick<SyncResult, "added" | "skipped" | "errors"> {
  let added = 0;
  let skipped = 0;
  const errors: SyncEventError[] = [];

  for (const event of events) {
    try {
      const startParsed = parseIcsDate(event.dtstart);
      const endParsed = parseIcsDate(event.dtend);

      if (!isValidDate(startParsed.date)) {
        throw new Error(`Invalid start date: "${event.dtstart}"`);
      }
      if (!isValidDate(endParsed.date)) {
        throw new Error(`Invalid end date: "${event.dtend}"`);
      }

      // Simulate successful upsert
      added++;
    } catch (err) {
      skipped++;
      if (errors.length < 10) {
        errors.push({
          uid: event.uid,
          summary: event.summary.slice(0, 120),
          reason: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }
  }

  return { added, skipped, errors };
}

describe("per-event error isolation", () => {
  it("malformed event with invalid date does not crash full sync", () => {
    const events: ParsedIcsEvent[] = [
      { uid: "good-1", summary: "Game Day", dtstart: "20260315T100000Z", dtend: "20260315T120000Z" },
      { uid: "bad-1", summary: "Corrupt Event", dtstart: "", dtend: "20260316T100000Z" },
      { uid: "good-2", summary: "Practice", dtstart: "20260317T080000Z", dtend: "20260317T100000Z" },
    ];

    const result = simulateEventLoop(events);
    expect(result.added).toBe(2);
    expect(result.skipped).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].uid).toBe("bad-1");
    expect(result.errors[0].reason).toContain("Invalid start date");
  });

  it("good events still sync when one event has bad end date", () => {
    const events: ParsedIcsEvent[] = [
      { uid: "ok-1", summary: "OK Event", dtstart: "20260301", dtend: "20260301" },
      { uid: "bad-end", summary: "Bad End", dtstart: "20260301", dtend: "garbage" },
      { uid: "ok-2", summary: "Another OK", dtstart: "20260302", dtend: "20260302" },
    ];

    const result = simulateEventLoop(events);
    expect(result.added).toBe(2);
    expect(result.skipped).toBe(1);
    expect(result.errors[0].uid).toBe("bad-end");
    expect(result.errors[0].reason).toContain("Invalid end date");
  });

  it("error summary contains uid and reason", () => {
    const events: ParsedIcsEvent[] = [
      { uid: "bad-uid-123", summary: "Broken", dtstart: "not-a-date", dtend: "also-bad" },
    ];

    const result = simulateEventLoop(events);
    expect(result.errors[0].uid).toBe("bad-uid-123");
    expect(result.errors[0].summary).toBe("Broken");
    expect(result.errors[0].reason).toBeTruthy();
  });

  it("all valid events produce zero errors", () => {
    const events: ParsedIcsEvent[] = [
      { uid: "a", summary: "A", dtstart: "20260301T090000Z", dtend: "20260301T110000Z" },
      { uid: "b", summary: "B", dtstart: "20260302", dtend: "20260302" },
    ];

    const result = simulateEventLoop(events);
    expect(result.added).toBe(2);
    expect(result.skipped).toBe(0);
    expect(result.errors).toHaveLength(0);
  });

  it("caps stored errors at 10", () => {
    const events: ParsedIcsEvent[] = Array.from({ length: 15 }, (_, i) => ({
      uid: `bad-${i}`,
      summary: `Bad Event ${i}`,
      dtstart: "",
      dtend: "",
    }));

    const result = simulateEventLoop(events);
    expect(result.skipped).toBe(15);
    expect(result.errors).toHaveLength(10);
  });
});
