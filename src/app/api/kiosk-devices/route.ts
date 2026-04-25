import { db } from "@/lib/db";
import { withAuth } from "@/lib/api";
import { HttpError, ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { createAuditEntry } from "@/lib/audit";
import { tokenHash, randomHex } from "@/lib/auth";
import { enforceRateLimit, SETTINGS_MUTATION_LIMIT } from "@/lib/rate-limit";

/** Generate a random 6-digit numeric code */
function generateActivationCode(): string {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  const code = 100000 + (buf[0] % 900000);
  return code.toString();
}

/** List kiosk devices (ADMIN only) */
export const GET = withAuth(async (req, { user }) => {
  requirePermission(user.role, "kiosk_device", "view");

  const devices = await db.kioskDevice.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      location: { select: { id: true, name: true } },
    },
  });

  // Never expose hashed tokens/codes to the client
  const data = devices.map((d) => ({
    id: d.id,
    name: d.name,
    locationId: d.locationId,
    location: d.location,
    active: d.active,
    activated: !!d.activatedAt,
    activatedAt: d.activatedAt,
    lastSeenAt: d.lastSeenAt,
    createdAt: d.createdAt,
  }));

  return ok({ data });
});

/** Create a new kiosk device (ADMIN only) */
export const POST = withAuth(async (req, { user }) => {
  requirePermission(user.role, "kiosk_device", "create");
  await enforceRateLimit(`kiosk-devices:write:${user.id}`, SETTINGS_MUTATION_LIMIT);

  const body = await req.json();
  const name = (body.name as string)?.trim();
  const locationId = body.locationId as string;

  if (!name || !locationId) {
    throw new HttpError(400, "Name and location are required");
  }

  // Verify location exists
  const location = await db.location.findUnique({
    where: { id: locationId },
    select: { id: true, name: true },
  });
  if (!location) {
    throw new HttpError(404, "Location not found");
  }

  // Generate activation code
  const rawCode = generateActivationCode();
  const hashedCode = await tokenHash(rawCode);

  const device = await db.kioskDevice.create({
    data: {
      name,
      locationId,
      activationCode: hashedCode,
    },
  });

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "kiosk_device",
    entityId: device.id,
    action: "create",
    after: { name, locationId, locationName: location.name },
  });

  // Return the raw code ONCE — it can't be recovered after this
  return ok({
    id: device.id,
    name: device.name,
    locationId: device.locationId,
    activationCode: rawCode,
  }, 201);
});
