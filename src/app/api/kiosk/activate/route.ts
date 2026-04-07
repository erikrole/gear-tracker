import { db } from "@/lib/db";
import { withHandler } from "@/lib/api";
import { HttpError, ok } from "@/lib/http";
import { tokenHash, createKioskSession } from "@/lib/auth";

/**
 * Activate a kiosk device with a 6-digit code.
 * No auth required — this IS the auth bootstrapping step.
 */
export const POST = withHandler(async (req) => {
  const body = await req.json();
  const code = (body.code as string)?.trim();

  if (!code || !/^\d{6}$/.test(code)) {
    throw new HttpError(400, "Invalid activation code format");
  }

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

  return ok({
    kioskId: device.id,
    name: device.name,
    location: device.location,
  });
});
