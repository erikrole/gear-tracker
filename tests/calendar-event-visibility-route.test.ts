import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    $transaction: vi.fn(),
  },
}));

import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { PATCH } from "@/app/api/calendar-events/[id]/visibility/route";

const staffUser = {
  id: "staff-1",
  email: "staff@example.com",
  name: "Staff One",
  role: "STAFF" as any,
  avatarUrl: null,
};

const studentUser = {
  ...staffUser,
  id: "student-1",
  email: "student@example.com",
  name: "Student One",
  role: "STUDENT" as any,
};

function patch(body: unknown) {
  return new Request("https://app.example.com/api/calendar-events/event-1/visibility", {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      host: "app.example.com",
      origin: "https://app.example.com",
    },
    body: JSON.stringify(body),
  });
}

function txMock(existing: { id: string; summary: string; isHidden: boolean } | null = {
  id: "event-1",
  summary: "Softball vs Baylor",
  isHidden: false,
}) {
  const tx = {
    calendarEvent: {
      findUnique: vi.fn().mockResolvedValue(existing),
      update: vi.fn().mockResolvedValue({
        id: "event-1",
        summary: "Softball vs Baylor",
        isHidden: true,
      }),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({ id: "audit-1" }),
    },
  };
  vi.mocked(db.$transaction).mockImplementation(async (fn: any) => fn(tx));
  return tx;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireAuth).mockResolvedValue(staffUser);
});

describe("PATCH /api/calendar-events/[id]/visibility", () => {
  it("updates visibility and writes audit inside the same transaction", async () => {
    const tx = txMock();

    const res = await PATCH(patch({ isHidden: true }), {
      params: Promise.resolve({ id: "event-1" }),
    });

    expect(res.status).toBe(200);
    expect(db.$transaction).toHaveBeenCalledOnce();
    expect(tx.calendarEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "event-1" },
        data: { isHidden: true },
      }),
    );
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorUserId: "staff-1",
          entityType: "calendar_event",
          entityId: "event-1",
          action: "calendar_event_visibility_updated",
        }),
      }),
    );
  });

  it("rejects non-staff users", async () => {
    vi.mocked(requireAuth).mockResolvedValue(studentUser);

    const res = await PATCH(patch({ isHidden: true }), {
      params: Promise.resolve({ id: "event-1" }),
    });

    expect(res.status).toBe(403);
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("rejects malformed visibility payloads", async () => {
    const res = await PATCH(patch({ isHidden: "true" }), {
      params: Promise.resolve({ id: "event-1" }),
    });

    expect(res.status).toBe(400);
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("returns 404 when the event does not exist", async () => {
    txMock(null);

    const res = await PATCH(patch({ isHidden: true }), {
      params: Promise.resolve({ id: "event-1" }),
    });

    expect(res.status).toBe(404);
  });
});
