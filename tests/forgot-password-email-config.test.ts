import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  randomHex: vi.fn(),
  tokenHash: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findUnique: vi.fn(),
    },
    passwordResetToken: {
      deleteMany: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(),
  getClientIp: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { POST } from "@/app/api/auth/forgot-password/route";

function forgotPasswordRequest() {
  return new Request("https://app.example.com/api/auth/forgot-password", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": "127.0.0.1",
    },
    body: JSON.stringify({ email: "user@example.com" }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.RESEND_API_KEY;
  vi.mocked(checkRateLimit).mockResolvedValue({
    allowed: true,
    remaining: 4,
    resetAt: Date.now() + 60_000,
  });
  vi.mocked(getClientIp).mockReturnValue("127.0.0.1");
});

describe("POST /api/auth/forgot-password", () => {
  it("does not create unusable reset tokens when email delivery is not configured", async () => {
    const res = await POST(forgotPasswordRequest(), { params: Promise.resolve({}) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.resetEmailConfigured).toBe(false);
    expect(body.message).toContain("not configured");
    expect(db.user.findUnique).not.toHaveBeenCalled();
    expect(db.passwordResetToken.create).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
