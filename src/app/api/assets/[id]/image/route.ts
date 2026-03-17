import { withAuth } from "@/lib/api";
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

  return ok(updated);
});
