import { db } from "@/lib/db";
import { withAuth } from "@/lib/api";
import { HttpError, ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { createAuditEntry } from "@/lib/audit";

/** Toggle active status or update a kiosk device (ADMIN only) */
export const PATCH = withAuth<{ id: string }>(async (req, { user, params }) => {
  requirePermission(user.role, "kiosk_device", "edit");

  const device = await db.kioskDevice.findUnique({
    where: { id: params.id },
  });
  if (!device) {
    throw new HttpError(404, "Kiosk device not found");
  }

  const body = await req.json();
  const updates: Record<string, unknown> = {};

  if (typeof body.active === "boolean") {
    updates.active = body.active;
    // If deactivating, also clear session token so it can't be used
    if (!body.active) {
      updates.sessionToken = null;
    }
  }

  if (typeof body.name === "string" && body.name.trim()) {
    updates.name = body.name.trim();
  }

  if (Object.keys(updates).length === 0) {
    throw new HttpError(400, "No valid fields to update");
  }

  const updated = await db.kioskDevice.update({
    where: { id: params.id },
    data: updates,
    include: {
      location: { select: { id: true, name: true } },
    },
  });

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "kiosk_device",
    entityId: device.id,
    action: body.active === false ? "deactivate" : "update",
    before: { name: device.name, active: device.active },
    after: updates,
  });

  return ok({
    id: updated.id,
    name: updated.name,
    locationId: updated.locationId,
    location: updated.location,
    active: updated.active,
    activated: !!updated.activatedAt,
    activatedAt: updated.activatedAt,
    lastSeenAt: updated.lastSeenAt,
    createdAt: updated.createdAt,
  });
});

/** Delete a kiosk device (ADMIN only) */
export const DELETE = withAuth<{ id: string }>(async (req, { user, params }) => {
  requirePermission(user.role, "kiosk_device", "delete");

  const device = await db.kioskDevice.findUnique({
    where: { id: params.id },
  });
  if (!device) {
    throw new HttpError(404, "Kiosk device not found");
  }

  await db.kioskDevice.delete({ where: { id: params.id } });

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "kiosk_device",
    entityId: device.id,
    action: "delete",
    before: { name: device.name, locationId: device.locationId },
  });

  return ok({ success: true });
});
