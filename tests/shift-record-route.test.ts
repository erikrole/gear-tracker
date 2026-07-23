import { beforeEach, describe, expect, it, vi } from "vitest";
import { Role } from "@prisma/client";

vi.mock("@/lib/auth", () => ({ requireAuth: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));
vi.mock("@/lib/services/shift-records", () => ({
  getShiftRecordStats: vi.fn(),
}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { GET } from "@/app/api/users/[id]/shift-record/route";
import { getShiftRecordStats } from "@/lib/services/shift-records";

const staff = {
  id: "staff-1",
  email: "staff@example.com",
  name: "Staff",
  role: Role.STAFF,
  avatarUrl: null,
};

function request() {
  return new Request("https://app.example.com/api/users/user-1/shift-record", {
    headers: { host: "app.example.com" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireAuth).mockResolvedValue(staff);
  vi.mocked(db.user.findUnique).mockResolvedValue({
    id: "user-1",
    role: Role.STUDENT,
    hiddenFromRoster: false,
  } as never);
  vi.mocked(getShiftRecordStats).mockResolvedValue({
    shiftCount: 3,
    resultEventCount: 2,
    wins: 2,
    losses: 0,
    bySport: [],
  });
});

describe("GET /api/users/[id]/shift-record", () => {
  it("returns the internal profile's record to staff", async () => {
    const response = await GET(request(), {
      params: Promise.resolve({ id: "user-1" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: { shiftCount: 3, resultEventCount: 2, wins: 2, losses: 0 },
    });
    expect(getShiftRecordStats).toHaveBeenCalledWith("user-1");
  });

  it("prevents students from reading another person's record", async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      ...staff,
      id: "student-2",
      email: "student@example.com",
      role: Role.STUDENT,
    });

    const response = await GET(request(), {
      params: Promise.resolve({ id: "user-1" }),
    });

    expect(response.status).toBe(403);
    expect(db.user.findUnique).not.toHaveBeenCalled();
    expect(getShiftRecordStats).not.toHaveBeenCalled();
  });

  it("does not expose records to collaborator callers", async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      ...staff,
      id: "collaborator-1",
      email: "collaborator@example.com",
      role: Role.COLLABORATOR,
    });

    const response = await GET(request(), {
      params: Promise.resolve({ id: "user-1" }),
    });

    expect(response.status).toBe(403);
    expect(db.user.findUnique).not.toHaveBeenCalled();
  });

  it("does not expose collaborator target profiles", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({
      id: "user-1",
      role: Role.COLLABORATOR,
      hiddenFromRoster: false,
    } as never);

    const response = await GET(request(), {
      params: Promise.resolve({ id: "user-1" }),
    });

    expect(response.status).toBe(404);
    expect(getShiftRecordStats).not.toHaveBeenCalled();
  });

  it("preserves hidden-profile denial", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({
      id: "user-1",
      role: Role.STUDENT,
      hiddenFromRoster: true,
    } as never);

    const response = await GET(request(), {
      params: Promise.resolve({ id: "user-1" }),
    });

    expect(response.status).toBe(404);
    expect(getShiftRecordStats).not.toHaveBeenCalled();
  });
});
