import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/cron", () => ({
  withCron:
    (handler: (req: Request) => Promise<Response>) =>
    (req: Request) =>
      handler(req),
}));

vi.mock("@/lib/db", () => ({
  db: {
    calendarSource: { findMany: vi.fn() },
    calendarEvent: { updateMany: vi.fn() },
    shiftGroup: { findMany: vi.fn(), updateMany: vi.fn() },
  },
}));

vi.mock("@/lib/services/calendar-sync", () => ({
  syncCalendarSource: vi.fn(),
}));

vi.mock("@/lib/services/calendar-sync-health", () => ({
  updateCalendarSyncHealth: vi.fn(),
}));

vi.mock("@/lib/services/shift-generation", () => ({
  generateShiftsForNewEvents: vi.fn(),
}));

vi.mock("@/lib/services/shift-trades", () => ({
  expireOpenTrades: vi.fn(),
}));

vi.mock("@/lib/services/pending-pickup-expiry", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/services/pending-pickup-expiry")>();
  return {
    ...actual,
    expirePendingPickupCheckouts: vi.fn(),
  };
});

import { db } from "@/lib/db";
import { syncCalendarSource } from "@/lib/services/calendar-sync";
import { updateCalendarSyncHealth } from "@/lib/services/calendar-sync-health";
import { generateShiftsForNewEvents } from "@/lib/services/shift-generation";
import { expireOpenTrades } from "@/lib/services/shift-trades";
import { expirePendingPickupCheckouts } from "@/lib/services/pending-pickup-expiry";
import { GET } from "@/app/api/cron/morning-refresh/route";

const mockDb = db as unknown as {
  calendarSource: { findMany: ReturnType<typeof vi.fn> };
  calendarEvent: { updateMany: ReturnType<typeof vi.fn> };
  shiftGroup: { findMany: ReturnType<typeof vi.fn>; updateMany: ReturnType<typeof vi.fn> };
};

function request() {
  return new Request("https://app.example.com/api/cron/morning-refresh");
}

describe("morning refresh cron route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockDb.calendarSource.findMany.mockResolvedValue([]);
    mockDb.calendarEvent.updateMany.mockResolvedValue({ count: 0 });
    mockDb.shiftGroup.findMany.mockResolvedValue([]);
    mockDb.shiftGroup.updateMany.mockResolvedValue({ count: 0 });
    vi.mocked(syncCalendarSource).mockResolvedValue({ added: 0, updated: 0, cancelled: 0, skipped: 0, errors: [] });
    vi.mocked(generateShiftsForNewEvents).mockResolvedValue({ groupsCreated: 0, shiftsCreated: 0 });
    vi.mocked(updateCalendarSyncHealth).mockResolvedValue({
      sourceId: "source-1",
      sourceName: "UW Badgers",
      consecutiveFailures: 0,
      failed: false,
      notificationsCreated: 0,
    });
    vi.mocked(expireOpenTrades).mockResolvedValue({ expired: 1 });
    vi.mocked(expirePendingPickupCheckouts).mockResolvedValue({
      scanned: 2,
      expired: 1,
      failed: 0,
      cutoff: new Date("2026-05-11T12:00:00.000Z"),
      errors: {},
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns stale trade and pending pickup maintenance results", async () => {
    const res = await GET(request(), { params: Promise.resolve({}) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.tradesExpired).toBe(1);
    expect(body.pendingPickups).toMatchObject({ scanned: 2, expired: 1, failed: 0 });
    expect(body.maintenanceFailures).toEqual([]);
  });

  it("reports maintenance failures without throwing away the cron response", async () => {
    vi.mocked(expirePendingPickupCheckouts).mockRejectedValue(new Error("expiry failed"));

    const res = await GET(request(), { params: Promise.resolve({}) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(false);
    expect(body.tradesExpired).toBe(1);
    expect(body.pendingPickups).toMatchObject({ scanned: 0, expired: 0, failed: 1 });
    expect(body.maintenanceFailures).toEqual(["pendingPickups"]);
  });

  it("reports returned calendar sync errors and records source health", async () => {
    mockDb.calendarSource.findMany.mockResolvedValue([
      { id: "source-1", name: "UW Badgers" },
    ]);
    vi.mocked(syncCalendarSource).mockResolvedValue({
      added: 0,
      updated: 0,
      cancelled: 0,
      skipped: 0,
      errors: [],
      error: "HTTP 500",
    });
    vi.mocked(updateCalendarSyncHealth).mockResolvedValue({
      sourceId: "source-1",
      sourceName: "UW Badgers",
      consecutiveFailures: 3,
      failed: true,
      notificationsCreated: 1,
    });

    const res = await GET(request(), { params: Promise.resolve({}) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.syncResults).toEqual([
      expect.objectContaining({
        sourceId: "source-1",
        sourceName: "UW Badgers",
        error: "HTTP 500",
        consecutiveFailures: 3,
        adminNotificationsCreated: 1,
      }),
    ]);
    expect(updateCalendarSyncHealth).toHaveBeenCalledWith(expect.objectContaining({
      sourceId: "source-1",
      sourceName: "UW Badgers",
      result: expect.objectContaining({ error: "HTTP 500" }),
    }));
  });
});
