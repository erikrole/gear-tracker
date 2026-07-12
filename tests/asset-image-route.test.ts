import { beforeEach, describe, expect, it, vi } from "vitest";
import { Role } from "@prisma/client";

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    asset: {
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
  uploadImage: vi.fn(async () => "https://new.public.blob.vercel-storage.com/assets/asset-1/1.webp"),
  deleteImage: vi.fn(async () => undefined),
  downloadImageToBlob: vi.fn(async () => "https://mirrored.public.blob.vercel-storage.com/assets/asset-1/2.jpg"),
  isBlobUrl: vi.fn((url: string) => url.includes(".public.blob.vercel-storage.com")),
}));

vi.mock("@/lib/rate-limit", () => ({
  enforceRateLimit: vi.fn(async () => undefined),
  IMAGE_MUTATION_LIMIT: { max: 60, windowMs: 60 * 60_000 },
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { deleteImage, downloadImageToBlob } from "@/lib/blob";
import { enforceRateLimit } from "@/lib/rate-limit";
import { DELETE, POST, PUT } from "@/app/api/assets/[id]/image/route";

const staffUser = {
  id: "staff-1",
  email: "staff@example.com",
  name: "Staff",
  role: Role.STAFF,
  avatarUrl: null,
};

const assetId = "asset-1";
const oldImageUrl = "https://old.public.blob.vercel-storage.com/assets/asset-1/0.jpg";
const newImageUrl = "https://new.public.blob.vercel-storage.com/assets/asset-1/1.webp";

function assetRow(row: unknown) {
  return row as Awaited<ReturnType<typeof db.asset.findUnique>>;
}

function assetUpdateRow(row: unknown) {
  return row as Awaited<ReturnType<typeof db.asset.update>>;
}

function params(id = assetId) {
  return { params: Promise.resolve({ id }) };
}

function imagePostRequest() {
  const form = new FormData();
  form.set("file", new File(["image"], "item.webp", { type: "image/webp" }));
  return new Request(`https://app.example.com/api/assets/${assetId}/image`, {
    method: "POST",
    headers: { host: "app.example.com", origin: "https://app.example.com" },
    body: form,
  });
}

function imagePutRequest(url = "https://static.bhphoto.com/images/item.jpg") {
  return new Request(`https://app.example.com/api/assets/${assetId}/image`, {
    method: "PUT",
    headers: {
      host: "app.example.com",
      origin: "https://app.example.com",
      "content-type": "application/json",
    },
    body: JSON.stringify({ url }),
  });
}

function imageDeleteRequest() {
  return new Request(`https://app.example.com/api/assets/${assetId}/image`, {
    method: "DELETE",
    headers: { host: "app.example.com", origin: "https://app.example.com" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireAuth).mockResolvedValue(staffUser);
  vi.mocked(db.asset.findUnique).mockResolvedValue(assetRow({ id: assetId, imageUrl: oldImageUrl }));
  vi.mocked(db.asset.update).mockResolvedValue(assetUpdateRow({ id: assetId, imageUrl: newImageUrl }));
});

describe("/api/assets/[id]/image", () => {
  it("rate limits image writes per user and replaces the old blob after the update", async () => {
    const res = await POST(imagePostRequest(), params());

    expect(res.status).toBe(200);
    expect(enforceRateLimit).toHaveBeenCalledWith("image-mutation:staff-1", { max: 60, windowMs: 60 * 60_000 });
    expect(db.asset.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { imageUrl: newImageUrl },
    }));
    expect(deleteImage).toHaveBeenCalledWith(oldImageUrl);
  });

  it("keeps the old blob and removes the new one when the upload update fails", async () => {
    vi.mocked(db.asset.update).mockRejectedValueOnce(new Error("db down"));

    const res = await POST(imagePostRequest(), params());

    expect(res.status).toBe(500);
    expect(deleteImage).toHaveBeenCalledWith(newImageUrl);
    expect(deleteImage).not.toHaveBeenCalledWith(oldImageUrl);
  });

  it("mirrors external URLs to blob storage before saving", async () => {
    vi.mocked(db.asset.update).mockResolvedValue(assetUpdateRow({
      id: assetId,
      imageUrl: "https://mirrored.public.blob.vercel-storage.com/assets/asset-1/2.jpg",
    }));

    const res = await PUT(imagePutRequest(), params());

    expect(res.status).toBe(200);
    expect(enforceRateLimit).toHaveBeenCalledWith("image-mutation:staff-1", { max: 60, windowMs: 60 * 60_000 });
    expect(downloadImageToBlob).toHaveBeenCalledWith("https://static.bhphoto.com/images/item.jpg", assetId, 5000);
    expect(db.asset.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { imageUrl: "https://mirrored.public.blob.vercel-storage.com/assets/asset-1/2.jpg" },
    }));
    expect(deleteImage).toHaveBeenCalledWith(oldImageUrl);
  });

  it("rejects non-https URLs without fetching", async () => {
    const res = await PUT(imagePutRequest("http://internal/img.jpg"), params());

    expect(res.status).toBe(400);
    expect(downloadImageToBlob).not.toHaveBeenCalled();
  });

  it("clears the record before deleting the blob on remove", async () => {
    vi.mocked(db.asset.update).mockRejectedValueOnce(new Error("db down"));

    const res = await DELETE(imageDeleteRequest(), params());

    expect(res.status).toBe(500);
    expect(deleteImage).not.toHaveBeenCalled();
  });
});
