import { db } from "@/lib/db";
import { withHandler } from "@/lib/api";
import { HttpError, ok } from "@/lib/http";
import { tokenHash, createKioskSession } from "@/lib/auth";
import { getClientIp } from "@/lib/rate-limit";
import { activateBody } from "@/lib/schemas/kiosk";

/**
 * Activate a kiosk device with a 6-digit code.
 * No auth required — this IS the auth bootstrapping step.
 */
export const POST = withHandler(async (req) => {
  const { code } = activateBody.parse(await req.json());

  // Hash the code and look up device
  const hashedCode = await tokenHash(code);
  const device = await db.kioskDevice.findUnique({
    where: { activationCode: hashedCode },
    include: { location: { select: { id: true, name: true } } },
  });

  if (!device) {
    throw new HttpError(401, "Invalid activation code");
  }

  if (!device.active) {
    throw new HttpError(401, "This kiosk device has been deactivated");
  }

  // Create session (sets cookie)
  await createKioskSession(device.id);

  // Audit kiosk activation (no user actor — use device ID as entity)
  const ip = getClientIp(req);
  await db.auditLog.create({
    data: {
      entityType: "kiosk_device",
      entityId: device.id,
      action: "kiosk_activated",
      afterJson: { deviceName: device.name, locationId: device.locationId, ip },
    },
  });

  return ok({
    kioskId: device.id,
    name: device.name,
    location: device.location,
  });
});
