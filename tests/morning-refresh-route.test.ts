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
    shiftGroup: { findMany: vi.fn(), updateMany: vi.fn() },
  },
}));

vi.mock("@/lib/services/calendar-sync", () => ({
  syncCalendarSource: vi.fn(),
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
import { expireOpenTrades } from "@/lib/services/shift-trades";
import { expirePendingPickupCheckouts } from "@/lib/services/pending-pickup-expiry";
import { GET } from "@/app/api/cron/morning-refresh/route";

const mockDb = db as unknown as {
  calendarSource: { findMany: ReturnType<typeof vi.fn> };
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
    mockDb.shiftGroup.findMany.mockResolvedValue([]);
    mockDb.shiftGroup.updateMany.mockResolvedValue({ count: 0 });
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
});
