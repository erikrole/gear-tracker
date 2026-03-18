import { withAuth } from "@/lib/api";
import { createAuditEntry } from "@/lib/audit";
import { requirePermission } from "@/lib/rbac";
import { HttpError, ok } from "@/lib/http";
import { validateImage, uploadImage, deleteImage } from "@/lib/blob";
import { db } from "@/lib/db";

/**
 * POST /api/assets/:id/image — upload or replace an asset image
 */
export const POST = withAuth<{ id: string }>(async (req, { user, params }) => {
  requirePermission(user.role, "asset", "edit");

  const { id } = params;

  const asset = await db.asset.findUnique({
    where: { id },
    select: { id: true, imageUrl: true },
  });
  if (!asset) throw new HttpError(404, "Asset not found");

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    throw new HttpError(400, "Expected multipart file field named 'file'");
  }

  const validationError = validateImage(file);
  if (validationError) {
    throw new HttpError(400, validationError);
  }

  // Upload new image
  const imageUrl = await uploadImage(file, id);

  // Delete previous image if it was a blob URL
  if (asset.imageUrl?.includes(".public.blob.vercel-storage.com")) {
    await deleteImage(asset.imageUrl).catch(() => {
      // Non-fatal — old blob will be cleaned up eventually
    });
  }

  // Update asset record
  const updated = await db.asset.update({
    where: { id },
    data: { imageUrl },
    select: { id: true, imageUrl: true },
  });

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "asset",
    entityId: id,
    action: "asset_image_uploaded",
    before: { imageUrl: asset.imageUrl },
    after: { imageUrl },
  });

  return ok(updated);
});

/**
 * PUT /api/assets/:id/image — set image from an external URL
 */
export const PUT = withAuth<{ id: string }>(async (req, { user, params }) => {
  requirePermission(user.role, "asset", "edit");

  const { id } = params;
  const body = await req.json();
  const url = typeof body?.url === "string" ? body.url.trim() : "";

  if (!url || !url.startsWith("https://")) {
    throw new HttpError(400, "A valid HTTPS image URL is required");
  }
  if (url.length > 2048) {
    throw new HttpError(400, "URL is too long");
  }

  const asset = await db.asset.findUnique({
    where: { id },
    select: { id: true, imageUrl: true },
  });
  if (!asset) throw new HttpError(404, "Asset not found");

  // Delete previous blob image if applicable
  if (asset.imageUrl?.includes(".public.blob.vercel-storage.com")) {
    await deleteImage(asset.imageUrl).catch(() => {});
  }

  const updated = await db.asset.update({
    where: { id },
    data: { imageUrl: url },
    select: { id: true, imageUrl: true },
  });

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "asset",
    entityId: id,
    action: "asset_image_set",
    before: { imageUrl: asset.imageUrl },
    after: { imageUrl: url },
  });

  return ok(updated);
});

/**
 * DELETE /api/assets/:id/image — remove an asset image
 */
export const DELETE = withAuth<{ id: string }>(async (req, { user, params }) => {
  requirePermission(user.role, "asset", "edit");

  const { id } = params;

  const asset = await db.asset.findUnique({
    where: { id },
    select: { id: true, imageUrl: true },
  });
  if (!asset) throw new HttpError(404, "Asset not found");
  if (!asset.imageUrl) throw new HttpError(400, "Asset has no image");

  // Delete from blob storage if applicable
  if (asset.imageUrl.includes(".public.blob.vercel-storage.com")) {
    await deleteImage(asset.imageUrl).catch(() => {});
  }

  const updated = await db.asset.update({
    where: { id },
    data: { imageUrl: null },
    select: { id: true, imageUrl: true },
  });

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "asset",
    entityId: id,
    action: "asset_image_removed",
    before: { imageUrl: asset.imageUrl },
    after: { imageUrl: null },
  });

  return ok(updated);
});
