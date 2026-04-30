import { withAuth } from "@/lib/api";
import { HttpError, ok } from "@/lib/http";
import { validateImage, deleteImage, isBlobUrl } from "@/lib/blob";
import { put } from "@vercel/blob";
import { db } from "@/lib/db";
import { createAuditEntry } from "@/lib/audit";

function assertCanManage(actorId: string, actorRole: string, targetId: string) {
  if (actorId === targetId) return;
  if (actorRole === "ADMIN") return;
  throw new HttpError(403, "Only admins can manage other users' avatars");
}

/**
 * POST /api/users/[id]/avatar — admin/staff (or self) upload avatar for a user
 */
export const POST = withAuth<{ id: string }>(async (req, { user, params }) => {
  const { id } = params;
  assertCanManage(user.id, user.role, id);

  const target = await db.user.findUnique({
    where: { id },
    select: { id: true, role: true, avatarUrl: true },
  });
  if (!target) throw new HttpError(404, "User not found");

  if (user.role === "STAFF" && user.id !== id && target.role !== "STUDENT") {
    throw new HttpError(403, "Staff can only edit student profiles");
  }

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    throw new HttpError(400, "Expected multipart file field named 'file'");
  }

  const validationError = validateImage(file);
  if (validationError) {
    throw new HttpError(400, validationError);
  }

  const ext = file.name.split(".").pop() || "jpg";
  const pathname = `avatars/${id}/${Date.now()}.${ext}`;
  const blob = await put(pathname, file.stream(), {
    access: "public",
    contentType: file.type,
  });

  // params is provided synchronously by the withAuth wrapper
  if (target.avatarUrl && isBlobUrl(target.avatarUrl)) {
    await deleteImage(target.avatarUrl).catch(() => {});
  }

  const updated = await db.user.update({
    where: { id },
    data: { avatarUrl: blob.url },
    select: { id: true, avatarUrl: true },
  });

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "user_avatar",
    entityId: id,
    action: "avatar_uploaded",
    after: { avatarUrl: updated.avatarUrl },
  });

  return ok({ data: { avatarUrl: updated.avatarUrl } });
});

/**
 * DELETE /api/users/[id]/avatar — admin/staff (or self) remove a user's avatar
 */
export const DELETE = withAuth<{ id: string }>(async (_req, { user, params }) => {
  const { id } = params;
  assertCanManage(user.id, user.role, id);

  const target = await db.user.findUnique({
    where: { id },
    select: { id: true, role: true, avatarUrl: true },
  });
  if (!target) throw new HttpError(404, "User not found");

  if (user.role === "STAFF" && user.id !== id && target.role !== "STUDENT") {
    throw new HttpError(403, "Staff can only edit student profiles");
  }

  if (!target.avatarUrl) {
    throw new HttpError(400, "No avatar to remove");
  }

  if (isBlobUrl(target.avatarUrl)) {
    await deleteImage(target.avatarUrl).catch(() => {});
  }

  await db.user.update({
    where: { id },
    data: { avatarUrl: null },
  });

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "user_avatar",
    entityId: id,
    action: "avatar_deleted",
    before: { avatarUrl: target.avatarUrl },
  });

  return ok({ data: { avatarUrl: null } });
});
