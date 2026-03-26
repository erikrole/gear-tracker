import { withAuth } from "@/lib/api";
import { HttpError, ok } from "@/lib/http";
import { validateImage, deleteImage, isBlobUrl } from "@/lib/blob";
import { put } from "@vercel/blob";
import { db } from "@/lib/db";
import { createAuditEntry } from "@/lib/audit";

/**
 * POST /api/profile/avatar — upload or replace current user's avatar
 */
export const POST = withAuth(async (req, { user }) => {
  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    throw new HttpError(400, "Expected multipart file field named 'file'");
  }

  const validationError = validateImage(file);
  if (validationError) {
    throw new HttpError(400, validationError);
  }

  // Upload to Vercel Blob
  const ext = file.name.split(".").pop() || "jpg";
  const pathname = `avatars/${user.id}/${Date.now()}.${ext}`;
  const blob = await put(pathname, file, {
    access: "public",
    contentType: file.type,
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });

  // Delete previous avatar if it was a blob URL
  const current = await db.user.findUnique({
    where: { id: user.id },
    select: { avatarUrl: true },
  });
  if (current?.avatarUrl && isBlobUrl(current.avatarUrl)) {
    await deleteImage(current.avatarUrl).catch(() => {});
  }

  const updated = await db.user.update({
    where: { id: user.id },
    data: { avatarUrl: blob.url },
    select: { id: true, avatarUrl: true },
  });

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "user_avatar",
    entityId: user.id,
    action: "avatar_uploaded",
    after: { avatarUrl: updated.avatarUrl },
  });

  return ok({ data: { avatarUrl: updated.avatarUrl } });
});

/**
 * DELETE /api/profile/avatar — remove current user's avatar
 */
export const DELETE = withAuth(async (_req, { user }) => {
  const current = await db.user.findUnique({
    where: { id: user.id },
    select: { avatarUrl: true },
  });

  if (!current?.avatarUrl) {
    throw new HttpError(400, "No avatar to remove");
  }

  if (isBlobUrl(current.avatarUrl)) {
    await deleteImage(current.avatarUrl).catch(() => {});
  }

  await db.user.update({
    where: { id: user.id },
    data: { avatarUrl: null },
  });

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "user_avatar",
    entityId: user.id,
    action: "avatar_deleted",
    before: { avatarUrl: current.avatarUrl },
  });

  return ok({ data: { avatarUrl: null } });
});
