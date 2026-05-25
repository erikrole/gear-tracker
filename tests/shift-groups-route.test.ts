import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    shiftGroup: {
      count: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { POST } from "@/app/api/shift-groups/route";

const staffUser = {
  id: "staff-1",
  email: "staff@example.com",
  name: "Staff One",
  role: "STAFF" as const,
  avatarUrl: null,
  forcePasswordChange: false,
};

function postRequest(body: string) {
  return new Request("https://app.example.com/api/shift-groups", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      host: "app.example.com",
      origin: "https://app.example.com",
    },
    body,
  });
}

describe("POST /api/shift-groups", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuth).mockResolvedValue(staffUser);
  });

  it("rejects malformed JSON before creating a shift group", async () => {
    const res = await POST(postRequest("{not-json"), { params: Promise.resolve({}) });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Request body must be valid JSON");
    expect(db.shiftGroup.create).not.toHaveBeenCalled();
  });

  it("rejects missing eventId before creating a shift group", async () => {
    const res = await POST(postRequest(JSON.stringify({})), { params: Promise.resolve({}) });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("eventId required");
    expect(db.shiftGroup.create).not.toHaveBeenCalled();
  });
});
