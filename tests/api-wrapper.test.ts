import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock @/lib/auth ────────────────────────────────────────────────────────
vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn(),
}));

// ─── Mock @sentry/nextjs ────────────────────────────────────────────────────
vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

import { withAuth, withHandler } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { HttpError } from "@/lib/http";

const mockUser = {
  id: "user-1",
  email: "test@test.com",
  name: "Test User",
  role: "ADMIN" as const,
  avatarUrl: null,
};

beforeEach(() => {
  vi.mocked(requireAuth).mockResolvedValue(mockUser);
});

function makeRequest(method: string, headers: Record<string, string> = {}) {
  return new Request("https://app.example.com/api/test", {
    method,
    headers: {
      host: "app.example.com",
      ...headers,
    },
  });
}

describe("withAuth", () => {
  it("calls handler with authenticated user", async () => {
    const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
    const wrapped = withAuth(handler);

    const res = await wrapped(
      makeRequest("GET"),
      { params: Promise.resolve({}) }
    );

    expect(handler).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ user: mockUser })
    );
    expect(res.status).toBe(200);
  });

  it("returns 401 on auth failure", async () => {
    vi.mocked(requireAuth).mockRejectedValue(new HttpError(401, "Unauthorized"));
    const handler = vi.fn();
    const wrapped = withAuth(handler);

    const res = await wrapped(
      makeRequest("GET"),
      { params: Promise.resolve({}) }
    );

    expect(res.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it("resolves dynamic params", async () => {
    const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
    const wrapped = withAuth<{ id: string }>(handler);

    await wrapped(
      makeRequest("GET"),
      { params: Promise.resolve({ id: "123" }) }
    );

    expect(handler).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ params: { id: "123" } })
    );
  });

  it("returns proper status for HttpError", async () => {
    const handler = vi.fn().mockRejectedValue(new HttpError(409, "Conflict"));
    const wrapped = withAuth(handler);

    const res = await wrapped(
      makeRequest("GET"),
      { params: Promise.resolve({}) }
    );

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("Conflict");
  });

  it("returns 500 for unknown errors", async () => {
    const handler = vi.fn().mockRejectedValue(new Error("unexpected"));
    const wrapped = withAuth(handler);

    const res = await wrapped(
      makeRequest("GET"),
      { params: Promise.resolve({}) }
    );

    expect(res.status).toBe(500);
  });

  // ── CSRF tests ──────────────────────────────────────────────────────────
  it("blocks POST with mismatched Origin header", async () => {
    const handler = vi.fn();
    const wrapped = withAuth(handler);

    const res = await wrapped(
      makeRequest("POST", { origin: "https://evil.com" }),
      { params: Promise.resolve({}) }
    );

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain("Cross-origin");
    expect(handler).not.toHaveBeenCalled();
  });

  it("allows POST with matching Origin header", async () => {
    const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
    const wrapped = withAuth(handler);

    const res = await wrapped(
      makeRequest("POST", { origin: "https://app.example.com" }),
      { params: Promise.resolve({}) }
    );

    expect(res.status).toBe(200);
  });

  it("BUG: allows POST when Origin header is absent (CSRF bypass)", async () => {
    const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
    const wrapped = withAuth(handler);

    // No origin header at all — the CSRF check is skipped entirely
    const res = await wrapped(
      makeRequest("POST"),
      { params: Promise.resolve({}) }
    );

    // BUG: This should arguably be blocked for security, but the current
    // implementation allows it. Missing Origin means no CSRF protection.
    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalled();
  });

  it("skips CSRF check for GET requests", async () => {
    const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
    const wrapped = withAuth(handler);

    const res = await wrapped(
      makeRequest("GET", { origin: "https://evil.com" }),
      { params: Promise.resolve({}) }
    );

    expect(res.status).toBe(200);
  });
});

describe("withHandler", () => {
  it("calls handler without auth", async () => {
    const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
    const wrapped = withHandler(handler);

    const res = await wrapped(
      makeRequest("GET"),
      { params: Promise.resolve({}) }
    );

    expect(res.status).toBe(200);
    expect(requireAuth).not.toHaveBeenCalled();
  });

  it("resolves params", async () => {
    const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
    const wrapped = withHandler<{ id: string }>(handler);

    await wrapped(
      makeRequest("GET"),
      { params: Promise.resolve({ id: "456" }) }
    );

    expect(handler).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ params: { id: "456" } })
    );
  });
});
