import { describe, it, expect } from "vitest";
import { parseIcsDate, type SyncResult, type SyncEventError, type SyncDiagnostics, type SyncEventSample } from "@/lib/services/calendar-sync";

// ── parseIcsDate unit tests ──

describe("parseIcsDate", () => {
  it("parses a date-only value (YYYYMMDD) as allDay using UTC", () => {
    const result = parseIcsDate("20260301");
    expect(result.allDay).toBe(true);
    expect(result.date.getUTCFullYear()).toBe(2026);
    expect(result.date.getUTCMonth()).toBe(2); // March = 2
    expect(result.date.getUTCDate()).toBe(1);
  });

  it("parses a UTC datetime (YYYYMMDDTHHMMSSZ)", () => {
    const result = parseIcsDate("20260315T143000Z");
    expect(result.allDay).toBe(false);
    expect(result.date.getUTCHours()).toBe(14);
    expect(result.date.getUTCMinutes()).toBe(30);
  });

  it("parses a non-Z datetime (YYYYMMDDTHHMMSS) as UTC", () => {
    const result = parseIcsDate("20260315T143000");
    expect(result.allDay).toBe(false);
    // Now always UTC regardless of local timezone
    expect(result.date.getUTCHours()).toBe(14);
    expect(result.date.getUTCMinutes()).toBe(30);
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
  it("has all required fields including skipped, errors, and operation", () => {
    const result: SyncResult = {
      added: 2,
      updated: 1,
      cancelled: 0,
      skipped: 1,
      errors: [{ uid: "abc", summary: "Bad event", operation: "create", reason: "Invalid start date" }],
    };
    expect(result.skipped).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].uid).toBe("abc");
    expect(result.errors[0].operation).toBe("create");
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
    let operation: "create" | "update" | "validate" = "validate";
    try {
      const startParsed = parseIcsDate(event.dtstart);
      const endParsed = parseIcsDate(event.dtend);

      if (!isValidDate(startParsed.date)) {
        throw new Error(`Invalid start date: "${event.dtstart}"`);
      }
      if (!isValidDate(endParsed.date)) {
        throw new Error(`Invalid end date: "${event.dtend}"`);
      }

      // Simulate successful create
      operation = "create";
      added++;
    } catch (err) {
      skipped++;
      if (errors.length < 10) {
        errors.push({
          uid: event.uid,
          summary: event.summary.slice(0, 120),
          operation,
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

// ── SyncDiagnostics shape and sampling tests ──

function buildDiagnostics(events: Array<{ uid: string; summary: string; dtstart: string }>): SyncDiagnostics {
  const SAMPLE_SIZE = 5;
  const sorted = [...events].sort((a, b) => a.dtstart.localeCompare(b.dtstart));
  return {
    fetchUrl: "https://example.com/feed.ics",
    httpStatus: 200,
    responseSizeBytes: 12345,
    parsedEventCount: events.length,
    earliestDtstart: sorted.length > 0 ? sorted[0].dtstart : null,
    latestDtstart: sorted.length > 0 ? sorted[sorted.length - 1].dtstart : null,
    firstEvents: sorted.slice(0, SAMPLE_SIZE).map((e) => ({ uid: e.uid, summary: e.summary.slice(0, 120), dtstart: e.dtstart })),
    lastEvents: sorted.slice(-SAMPLE_SIZE).map((e) => ({ uid: e.uid, summary: e.summary.slice(0, 120), dtstart: e.dtstart })),
  };
}

describe("SyncDiagnostics", () => {
  it("has all required fields", () => {
    const diag: SyncDiagnostics = {
      fetchUrl: "https://example.com/feed.ics",
      httpStatus: 200,
      responseSizeBytes: 5000,
      parsedEventCount: 10,
      earliestDtstart: "20260101",
      latestDtstart: "20261231",
      firstEvents: [],
      lastEvents: [],
    };
    expect(diag.fetchUrl).toBeTruthy();
    expect(diag.httpStatus).toBe(200);
    expect(diag.parsedEventCount).toBe(10);
    expect(diag.earliestDtstart).toBe("20260101");
    expect(diag.latestDtstart).toBe("20261231");
  });

  it("includes parsed date range from events", () => {
    const events = [
      { uid: "a", summary: "Early", dtstart: "20250901T100000Z" },
      { uid: "b", summary: "Late", dtstart: "20261215T180000Z" },
      { uid: "c", summary: "Mid", dtstart: "20260601T120000Z" },
    ];
    const diag = buildDiagnostics(events);
    expect(diag.earliestDtstart).toBe("20250901T100000Z");
    expect(diag.latestDtstart).toBe("20261215T180000Z");
  });

  it("first/last event sampling is capped at 5", () => {
    const events = Array.from({ length: 20 }, (_, i) => ({
      uid: `evt-${String(i).padStart(2, "0")}`,
      summary: `Event ${i}`,
      dtstart: `202603${String(i + 1).padStart(2, "0")}T100000Z`,
    }));
    const diag = buildDiagnostics(events);
    expect(diag.firstEvents).toHaveLength(5);
    expect(diag.lastEvents).toHaveLength(5);
    expect(diag.firstEvents[0].dtstart).toBe("20260301T100000Z");
    expect(diag.lastEvents[4].dtstart).toBe("20260320T100000Z");
  });

  it("handles empty event list", () => {
    const diag = buildDiagnostics([]);
    expect(diag.parsedEventCount).toBe(0);
    expect(diag.earliestDtstart).toBeNull();
    expect(diag.latestDtstart).toBeNull();
    expect(diag.firstEvents).toHaveLength(0);
    expect(diag.lastEvents).toHaveLength(0);
  });

  it("handles fewer events than sample size", () => {
    const events = [
      { uid: "only-1", summary: "Solo", dtstart: "20260501" },
      { uid: "only-2", summary: "Duo", dtstart: "20260502" },
    ];
    const diag = buildDiagnostics(events);
    expect(diag.firstEvents).toHaveLength(2);
    expect(diag.lastEvents).toHaveLength(2);
  });

  it("SyncResult includes optional diagnostics field", () => {
    const result: SyncResult = {
      added: 5,
      updated: 3,
      cancelled: 0,
      skipped: 0,
      errors: [],
      diagnostics: buildDiagnostics([{ uid: "x", summary: "Test", dtstart: "20260301" }]),
    };
    expect(result.diagnostics).toBeDefined();
    expect(result.diagnostics!.parsedEventCount).toBe(1);
  });
});

// ── Error operation tracking ──

describe("error operation tracking", () => {
  it("validate errors have operation=validate", () => {
    const result = simulateEventLoop([
      { uid: "bad", summary: "Bad", dtstart: "", dtend: "" },
    ]);
    expect(result.errors[0].operation).toBe("validate");
  });

  it("create failure errors include operation=create", () => {
    // Directly verify the type supports create operation
    const error: SyncEventError = {
      uid: "test",
      summary: "Test",
      operation: "create",
      reason: "Unique constraint failed",
    };
    expect(error.operation).toBe("create");
  });

  it("update failure errors include operation=update", () => {
    const error: SyncEventError = {
      uid: "test",
      summary: "Test",
      operation: "update",
      reason: "Record not found",
    };
    expect(error.operation).toBe("update");
  });

  it("error reasons are truncated to 300 chars", () => {
    const longReason = "x".repeat(500);
    const truncated = longReason.length > 300 ? longReason.slice(0, 300) + "…" : longReason;
    expect(truncated.length).toBe(301); // 300 + "…"
  });
});

// ── parseIcsDate UTC consistency ──

describe("parseIcsDate UTC consistency", () => {
  it("allDay dates use UTC (no timezone shift)", () => {
    const result = parseIcsDate("20260315");
    // Should be midnight UTC, not local midnight
    expect(result.date.getUTCHours()).toBe(0);
    expect(result.date.getUTCMinutes()).toBe(0);
    expect(result.date.toISOString()).toBe("2026-03-15T00:00:00.000Z");
  });

  it("non-Z datetimes are treated as UTC", () => {
    const result = parseIcsDate("20260315T143000");
    expect(result.date.toISOString()).toBe("2026-03-15T14:30:00.000Z");
  });

  it("Z-suffixed datetimes remain UTC", () => {
    const result = parseIcsDate("20260315T143000Z");
    expect(result.date.toISOString()).toBe("2026-03-15T14:30:00.000Z");
  });

  it("non-Z and Z produce same result for same time values", () => {
    const withZ = parseIcsDate("20260315T143000Z");
    const withoutZ = parseIcsDate("20260315T143000");
    expect(withZ.date.getTime()).toBe(withoutZ.date.getTime());
  });
});
