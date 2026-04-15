import { z } from "zod";
import { withAuth } from "@/lib/api";
import { createAuditEntry } from "@/lib/audit";
import { requirePermission } from "@/lib/rbac";
import { HttpError, ok } from "@/lib/http";
import { validateImage, uploadImage, deleteImage, downloadImageToBlob, isBlobUrl } from "@/lib/blob";
import { db } from "@/lib/db";

const setImageUrlSchema = z.object({
  url: z.string().url().max(2048),
});

/**
 * POST /api/bulk-skus/:id/image — upload or replace a bulk SKU image
 */
export const POST = withAuth<{ id: string }>(async (req, { user, params }) => {
  requirePermission(user.role, "bulk_sku", "edit");

  const { id } = params;

  const sku = await db.bulkSku.findUnique({
    where: { id },
    select: { id: true, imageUrl: true },
  });
  if (!sku) throw new HttpError(404, "Bulk SKU not found");

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    throw new HttpError(400, "Expected multipart file field named 'file'");
  }

  const validationError = validateImage(file);
  if (validationError) {
    throw new HttpError(400, validationError);
  }

  const imageUrl = await uploadImage(file, id);

  if (sku.imageUrl && isBlobUrl(sku.imageUrl)) {
    await deleteImage(sku.imageUrl).catch(() => {});
  }

  const updated = await db.bulkSku.update({
    where: { id },
    data: { imageUrl },
    select: { id: true, imageUrl: true },
  });

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "bulk_sku",
    entityId: id,
    action: "bulk_sku_image_uploaded",
    before: { imageUrl: sku.imageUrl },
    after: { imageUrl },
  });

  return ok(updated);
});

/**
 * PUT /api/bulk-skus/:id/image — set image from an external URL
 */
export const PUT = withAuth<{ id: string }>(async (req, { user, params }) => {
  requirePermission(user.role, "bulk_sku", "edit");

  const { id } = params;

  let body: z.infer<typeof setImageUrlSchema>;
  try {
    body = setImageUrlSchema.parse(await req.json());
  } catch (err) {
    if (err instanceof z.ZodError) {
      throw new HttpError(400, err.errors.map((e) => e.message).join(", "));
    }
    throw err;
  }

  const url = body.url.trim();
  if (!url.startsWith("https://")) {
    throw new HttpError(400, "A valid HTTPS image URL is required");
  }

  const sku = await db.bulkSku.findUnique({
    where: { id },
    select: { id: true, imageUrl: true },
  });
  if (!sku) throw new HttpError(404, "Bulk SKU not found");

  const blobUrl = await downloadImageToBlob(url, id);
  if (!blobUrl) {
    throw new HttpError(400, "Could not download image from that URL");
  }

  if (sku.imageUrl && isBlobUrl(sku.imageUrl)) {
    await deleteImage(sku.imageUrl).catch(() => {});
  }

  const updated = await db.bulkSku.update({
    where: { id },
    data: { imageUrl: blobUrl },
    select: { id: true, imageUrl: true },
  });

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "bulk_sku",
    entityId: id,
    action: "bulk_sku_image_set",
    before: { imageUrl: sku.imageUrl },
    after: { imageUrl: blobUrl },
  });

  return ok(updated);
});

/**
 * DELETE /api/bulk-skus/:id/image — remove a bulk SKU image
 */
export const DELETE = withAuth<{ id: string }>(async (_req, { user, params }) => {
  requirePermission(user.role, "bulk_sku", "edit");

  const { id } = params;

  const sku = await db.bulkSku.findUnique({
    where: { id },
    select: { id: true, imageUrl: true },
  });
  if (!sku) throw new HttpError(404, "Bulk SKU not found");
  if (!sku.imageUrl) throw new HttpError(400, "Bulk SKU has no image");

  if (isBlobUrl(sku.imageUrl)) {
    await deleteImage(sku.imageUrl).catch(() => {});
  }

  const updated = await db.bulkSku.update({
    where: { id },
    data: { imageUrl: null },
    select: { id: true, imageUrl: true },
  });

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "bulk_sku",
    entityId: id,
    action: "bulk_sku_image_removed",
    before: { imageUrl: sku.imageUrl },
    after: { imageUrl: null },
  });

  return ok(updated);
});
