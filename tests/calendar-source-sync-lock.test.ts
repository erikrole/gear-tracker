import { beforeEach, describe, expect, it, vi } from "vitest";
import { Role } from "@prisma/client";

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    calendarSource: {
      updateMany: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/rate-limit", () => ({
  enforceRateLimit: vi.fn(),
}));

vi.mock("@/lib/services/calendar-sync", () => ({
  syncCalendarSource: vi.fn(),
}));

vi.mock("@/lib/services/shift-generation", () => ({
  generateShiftsForNewEvents: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { enforceRateLimit } from "@/lib/rate-limit";
import { syncCalendarSource } from "@/lib/services/calendar-sync";
import { generateShiftsForNewEvents } from "@/lib/services/shift-generation";
import { POST } from "@/app/api/calendar-sources/[id]/sync/route";

const params = { params: Promise.resolve({ id: "source-1" }) };

function updateManyResult(count: number) {
  return { count } as Awaited<ReturnType<typeof db.calendarSource.updateMany>>;
}

function calendarSource(row: unknown) {
  return row as Awaited<ReturnType<typeof db.calendarSource.findUnique>>;
}

function postRequest() {
  return new Request("https://app.example.com/api/calendar-sources/source-1/sync", {
    method: "POST",
    headers: {
      host: "app.example.com",
      origin: "https://app.example.com",
    },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireAuth).mockResolvedValue({
    id: "admin-1",
    email: "admin@example.com",
    name: "Admin One",
    role: Role.ADMIN,
    avatarUrl: null,
  });
  vi.mocked(enforceRateLimit).mockResolvedValue(undefined);
  vi.mocked(db.calendarSource.updateMany)
    .mockResolvedValueOnce(updateManyResult(1))
    .mockResolvedValue(updateManyResult(1));
  vi.mocked(db.calendarSource.findUnique).mockResolvedValue(null);
  vi.mocked(syncCalendarSource).mockResolvedValue({
    added: 1,
    updated: 0,
    cancelled: 0,
    skipped: 0,
    errors: [],
  });
  vi.mocked(generateShiftsForNewEvents).mockResolvedValue({
    groupsCreated: 1,
    shiftsCreated: 3,
  });
});

describe("calendar source sync lock", () => {
  it("acquires and releases a source-scoped lease around sync and shift generation", async () => {
    const res = await POST(postRequest(), params);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.shiftGeneration).toEqual({ groupsCreated: 1, shiftsCreated: 3 });
    expect(db.calendarSource.updateMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          id: "source-1",
          enabled: true,
          OR: [
            { syncLeaseUntil: null },
            { syncLeaseUntil: { lt: expect.any(Date) } },
          ],
        }),
        data: expect.objectContaining({
          syncLeaseUntil: expect.any(Date),
          syncLeaseOwner: expect.any(String),
        }),
      }),
    );
    const leaseOwner = vi.mocked(db.calendarSource.updateMany).mock.calls[0]![0].data.syncLeaseOwner;
    expect(syncCalendarSource).toHaveBeenCalledWith("source-1");
    expect(generateShiftsForNewEvents).toHaveBeenCalledWith("source-1");
    expect(db.calendarSource.updateMany).toHaveBeenLastCalledWith({
      where: { id: "source-1", syncLeaseOwner: leaseOwner },
      data: { syncLeaseUntil: null, syncLeaseOwner: null },
    });
  });

  it("returns 409 when another sync holds an active lease", async () => {
    vi.mocked(db.calendarSource.updateMany).mockReset();
    vi.mocked(db.calendarSource.updateMany).mockResolvedValue(updateManyResult(0));
    vi.mocked(db.calendarSource.findUnique).mockResolvedValue(calendarSource({
      enabled: true,
      syncLeaseUntil: new Date(Date.now() + 60_000),
    }));

    const res = await POST(postRequest(), params);
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toContain("already running");
    expect(syncCalendarSource).not.toHaveBeenCalled();
    expect(generateShiftsForNewEvents).not.toHaveBeenCalled();
  });

  it("releases the lease when shift generation fails after sync", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(generateShiftsForNewEvents).mockRejectedValue(new Error("template failed"));

    const res = await POST(postRequest(), params);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.shiftGenerationError).toBe("template failed");
    expect(db.calendarSource.updateMany).toHaveBeenCalledTimes(2);
    expect(db.calendarSource.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: { syncLeaseUntil: null, syncLeaseOwner: null },
      }),
    );
    consoleError.mockRestore();
  });
});
