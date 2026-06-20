import { beforeEach, describe, expect, it, vi } from "vitest";
import { Role } from "@prisma/client";

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/audit", () => ({
  createAuditEntry: vi.fn(),
}));

vi.mock("@/lib/blob", () => ({
  validateImage: vi.fn(() => null),
  deleteImage: vi.fn(async () => undefined),
  isBlobUrl: vi.fn(() => true),
}));

vi.mock("@vercel/blob", () => ({
  put: vi.fn(async () => ({ url: "https://blob.example.com/new-avatar.webp" })),
}));

vi.mock("@/lib/rate-limit", () => ({
  enforceRateLimit: vi.fn(async () => undefined),
  getClientIp: vi.fn(() => "203.0.113.10"),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createAuditEntry } from "@/lib/audit";
import { deleteImage } from "@/lib/blob";
import { enforceRateLimit } from "@/lib/rate-limit";
import { put } from "@vercel/blob";
import { DELETE, POST } from "@/app/api/users/[id]/avatar/route";

const adminUser = {
  id: "admin-1",
  email: "admin@example.com",
  name: "Admin",
  role: Role.ADMIN,
  avatarUrl: null,
};

const staffUser = {
  id: "staff-1",
  email: "staff@example.com",
  name: "Staff",
  role: Role.STAFF,
  avatarUrl: null,
};

function userResult(row: unknown) {
  return row as Awaited<ReturnType<typeof db.user.findUnique>>;
}

function userUpdate(row: unknown) {
  return row as Awaited<ReturnType<typeof db.user.update>>;
}

const targetId = "student-1";
const oldAvatarUrl = "https://old.public.blob.vercel-storage.com/avatar.webp";

function params(id = targetId) {
  return { params: Promise.resolve({ id }) };
}

function avatarPostRequest(pathId = targetId) {
  const form = new FormData();
  form.set("file", new File(["image"], "avatar.webp", { type: "image/webp" }));

  return new Request(`https://app.example.com/api/users/${pathId}/avatar`, {
    method: "POST",
    headers: {
      host: "app.example.com",
      origin: "https://app.example.com",
    },
    body: form,
  });
}

function avatarDeleteRequest(pathId = targetId) {
  return new Request(`https://app.example.com/api/users/${pathId}/avatar`, {
    method: "DELETE",
    headers: {
      host: "app.example.com",
      origin: "https://app.example.com",
    },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireAuth).mockResolvedValue(adminUser);
  vi.mocked(db.user.findUnique).mockResolvedValue(userResult({
    id: targetId,
    avatarUrl: oldAvatarUrl,
  }));
  vi.mocked(db.user.update).mockResolvedValue(userUpdate({
    id: targetId,
    avatarUrl: "https://blob.example.com/new-avatar.webp",
  }));
});

describe("/api/users/[id]/avatar", () => {
  it("lets an admin upload another user's profile photo", async () => {
    const res = await POST(avatarPostRequest(), params());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.avatarUrl).toBe("https://blob.example.com/new-avatar.webp");
    expect(enforceRateLimit).toHaveBeenCalledWith("avatar:ip:203.0.113.10", { max: 60, windowMs: 60 * 60_000 });
    expect(enforceRateLimit).toHaveBeenCalledWith("avatar:admin-1", { max: 10, windowMs: 60 * 60_000 });
    expect(put).toHaveBeenCalled();
    expect(deleteImage).toHaveBeenCalledWith(oldAvatarUrl);
    expect(db.user.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: targetId },
      data: { avatarUrl: "https://blob.example.com/new-avatar.webp" },
    }));
    expect(createAuditEntry).toHaveBeenCalledWith(expect.objectContaining({
      actorId: "admin-1",
      actorRole: "ADMIN",
      entityType: "user_avatar",
      entityId: targetId,
      action: "avatar_uploaded",
    }));
  });

  it("lets an admin remove another user's profile photo", async () => {
    const res = await DELETE(avatarDeleteRequest(), params());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.avatarUrl).toBeNull();
    expect(deleteImage).toHaveBeenCalledWith(oldAvatarUrl);
    expect(db.user.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: targetId },
      data: { avatarUrl: null },
    }));
    expect(createAuditEntry).toHaveBeenCalledWith(expect.objectContaining({
      actorId: "admin-1",
      actorRole: "ADMIN",
      entityType: "user_avatar",
      entityId: targetId,
      action: "avatar_deleted",
      before: { avatarUrl: oldAvatarUrl },
    }));
  });

  it("blocks staff from changing another user's profile photo", async () => {
    vi.mocked(requireAuth).mockResolvedValue(staffUser);

    const res = await POST(avatarPostRequest(), params());
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toContain("Only admins");
    expect(enforceRateLimit).not.toHaveBeenCalled();
    expect(db.user.findUnique).not.toHaveBeenCalled();
    expect(db.user.update).not.toHaveBeenCalled();
  });
});
