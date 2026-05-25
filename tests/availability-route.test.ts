import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {},
}));

vi.mock("@/lib/services/availability", () => ({
  checkAvailability: vi.fn(),
  getBulkAvailability: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

import { requireAuth } from "@/lib/auth";
import { checkAvailability } from "@/lib/services/availability";
import { POST } from "@/app/api/availability/check/route";

const adminUser = {
  id: "admin-1",
  email: "admin@example.com",
  name: "Admin One",
  role: "ADMIN" as const,
  avatarUrl: null,
};

function malformedPost() {
  return new Request("https://app.example.com/api/availability/check", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      host: "app.example.com",
      origin: "https://app.example.com",
    },
    body: "{not-json",
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireAuth).mockResolvedValue(adminUser);
});

describe("POST /api/availability/check", () => {
  it("rejects malformed JSON before checking availability", async () => {
    const res = await POST(malformedPost(), { params: Promise.resolve({}) });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Request body must be valid JSON");
    expect(checkAvailability).not.toHaveBeenCalled();
  });
});
