import { z } from "zod";
import { withAuth } from "@/lib/api";
import { createAuditEntry } from "@/lib/audit";
import { db } from "@/lib/db";
import { HttpError, ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";

const attachSchema = z.object({
  childAssetId: z.string().cuid(),
});

const moveSchema = z.object({
  newParentAssetId: z.string().cuid(),
});

/** GET /api/assets/[id]/accessories — list accessories for a parent item */
export const GET = withAuth<{ id: string }>(async (req, { params }) => {
  const { id } = params;

  const accessories = await db.asset.findMany({
    where: { parentAssetId: id },
    select: {
      id: true,
      assetTag: true,
      name: true,
      brand: true,
      model: true,
      serialNumber: true,
      status: true,
      type: true,
      imageUrl: true,
    },
    orderBy: { assetTag: "asc" },
  });

  return ok({ data: accessories });
});

/** POST /api/assets/[id]/accessories — attach an accessory to this parent */
export const POST = withAuth<{ id: string }>(async (req, { user, params }) => {
  requirePermission(user.role, "asset", "edit");
  const { id } = params;
  const body = attachSchema.parse(await req.json());

  // Verify parent exists
  const parent = await db.asset.findUnique({
    where: { id },
    select: { id: true, parentAssetId: true },
  });
  if (!parent) throw new HttpError(404, "Parent asset not found");
  if (parent.parentAssetId) throw new HttpError(400, "Cannot attach accessories to a child item");

  // Verify child exists and is not already a child of another parent
  const child = await db.asset.findUnique({
    where: { id: body.childAssetId },
    select: { id: true, parentAssetId: true, assetTag: true },
  });
  if (!child) throw new HttpError(404, "Accessory asset not found");
  if (child.id === id) throw new HttpError(400, "Cannot attach an item to itself");
  if (child.parentAssetId) {
    throw new HttpError(
      409,
      `This item is already an accessory of another item. Detach it first.`
    );
  }

  // Attach: set parentAssetId and mark as unavailable for independent checkout
  await db.asset.update({
    where: { id: body.childAssetId },
    data: {
      parentAssetId: id,
      availableForCheckout: false,
      availableForReservation: false,
    },
  });

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "asset",
    entityId: body.childAssetId,
    action: "accessory_attached",
    after: { parentAssetId: id, childAssetId: body.childAssetId },
  });

  return ok({ success: true });
});

/** PATCH /api/assets/[id]/accessories — move a child to a different parent */
export const PATCH = withAuth<{ id: string }>(async (req, { user, params }) => {
  requirePermission(user.role, "asset", "edit");
  const { id } = params;
  const body = moveSchema.parse(await req.json());

  // id here is the CHILD asset to move
  const child = await db.asset.findUnique({
    where: { id },
    select: { id: true, parentAssetId: true },
  });
  if (!child) throw new HttpError(404, "Asset not found");
  if (!child.parentAssetId) throw new HttpError(400, "This item is not an accessory");

  // Verify new parent exists and is not itself a child
  const newParent = await db.asset.findUnique({
    where: { id: body.newParentAssetId },
    select: { id: true, parentAssetId: true },
  });
  if (!newParent) throw new HttpError(404, "New parent asset not found");
  if (newParent.parentAssetId) throw new HttpError(400, "Cannot move to a child item");
  if (newParent.id === id) throw new HttpError(400, "Cannot attach an item to itself");

  await db.asset.update({
    where: { id },
    data: { parentAssetId: body.newParentAssetId },
  });

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "asset",
    entityId: id,
    action: "accessory_moved",
    before: { parentAssetId: child.parentAssetId },
    after: { parentAssetId: body.newParentAssetId },
  });

  return ok({ success: true });
});

/** DELETE /api/assets/[id]/accessories — detach this child from its parent */
export const DELETE = withAuth<{ id: string }>(async (req, { user, params }) => {
  requirePermission(user.role, "asset", "edit");
  const { id } = params;

  const child = await db.asset.findUnique({
    where: { id },
    select: { id: true, parentAssetId: true },
  });
  if (!child) throw new HttpError(404, "Asset not found");
  if (!child.parentAssetId) throw new HttpError(400, "This item is not an accessory");

  await db.asset.update({
    where: { id },
    data: {
      parentAssetId: null,
      availableForCheckout: true,
      availableForReservation: true,
    },
  });

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "asset",
    entityId: id,
    action: "accessory_detached",
    before: { parentAssetId: child.parentAssetId },
    after: { parentAssetId: null },
  });

  return ok({ success: true });
});
