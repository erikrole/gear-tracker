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
    expirePickupNoShows: vi.fn(),
  };
});

vi.mock("@/lib/services/firmware-watch", () => ({
  pollFirmwareWatchTargets: vi.fn(),
}));

vi.mock("@/lib/services/schedule-automation", () => ({
  getScheduleAutomationDigest: vi.fn(),
}));

import { db } from "@/lib/db";
import { syncCalendarSource } from "@/lib/services/calendar-sync";
import { updateCalendarSyncHealth } from "@/lib/services/calendar-sync-health";
import { generateShiftsForNewEvents } from "@/lib/services/shift-generation";
import { expireOpenTrades } from "@/lib/services/shift-trades";
import { expirePickupNoShows } from "@/lib/services/pending-pickup-expiry";
import { pollFirmwareWatchTargets } from "@/lib/services/firmware-watch";
import { getScheduleAutomationDigest } from "@/lib/services/schedule-automation";
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
    vi.mocked(expirePickupNoShows).mockResolvedValue({
      scanned: 2,
      expired: 1,
      failed: 0,
      cutoff: new Date("2026-05-11T12:00:00.000Z"),
      errors: {},
    });
    vi.mocked(pollFirmwareWatchTargets).mockResolvedValue({
      checked: 1,
      changed: 1,
      baselined: 0,
      failed: 0,
      notificationsCreated: 2,
      errors: [],
    });
    vi.mocked(getScheduleAutomationDigest).mockResolvedValue({
      generatedAt: "2026-05-13T12:00:00.000Z",
      window: {
        startsAt: null,
        endsAt: null,
        includePast: false,
        includeArchived: false,
        sportCode: null,
      },
      metrics: {
        openSlots: 0,
        eventsWithoutCrew: 0,
        pendingRequests: 0,
        conflicts: 0,
        gearGaps: 0,
        readyToPublish: 0,
        autoFillCandidates: 0,
        staleSources: 0,
        sourceErrors: 0,
        staleTrades: 0,
        syncEventsAdded: 0,
        syncEventsUpdated: 0,
        syncGroupsCreated: 0,
        syncShiftsCreated: 0,
        shiftGroupsArchived: 0,
        eventsArchived: 0,
        tradesExpired: 1,
        pendingPickupsExpired: 1,
      },
      cards: [],
      partialFailures: [],
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
    expect(body.firmwareWatch).toMatchObject({ checked: 1, changed: 1, notificationsCreated: 2 });
    expect(body.scheduleAutomation).toMatchObject({
      metrics: expect.objectContaining({ tradesExpired: 1, pendingPickupsExpired: 1 }),
    });
    expect(body.maintenanceFailures).toEqual([]);
    expect(getScheduleAutomationDigest).toHaveBeenCalledWith(expect.objectContaining({
      maintenance: expect.objectContaining({
        tradesExpired: 1,
        pendingPickupsExpired: 1,
      }),
    }));
  });

  it("reports maintenance failures without throwing away the cron response", async () => {
    vi.mocked(expirePickupNoShows).mockRejectedValue(new Error("expiry failed"));

    const res = await GET(request(), { params: Promise.resolve({}) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(false);
    expect(body.tradesExpired).toBe(1);
    expect(body.pendingPickups).toMatchObject({ scanned: 0, expired: 0, failed: 1 });
    expect(body.maintenanceFailures).toEqual(["pendingPickups"]);
  });

  it("reports firmware watch failures without blocking other daily maintenance", async () => {
    vi.mocked(pollFirmwareWatchTargets).mockRejectedValue(new Error("firmware source failed"));

    const res = await GET(request(), { params: Promise.resolve({}) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(false);
    expect(body.tradesExpired).toBe(1);
    expect(body.pendingPickups).toMatchObject({ scanned: 2, expired: 1, failed: 0 });
    expect(body.firmwareWatch).toMatchObject({ checked: 0, failed: 1, notificationsCreated: 0 });
    expect(body.maintenanceFailures).toEqual(["firmwareWatch"]);
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

  it("reports automation digest failures without blocking other daily maintenance", async () => {
    vi.mocked(getScheduleAutomationDigest).mockRejectedValue(new Error("automation read failed"));

    const res = await GET(request(), { params: Promise.resolve({}) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(false);
    expect(body.scheduleAutomation).toBeNull();
    expect(body.tradesExpired).toBe(1);
    expect(body.pendingPickups).toMatchObject({ scanned: 2, expired: 1, failed: 0 });
    expect(body.maintenanceFailures).toEqual(["scheduleAutomation"]);
  });
});
