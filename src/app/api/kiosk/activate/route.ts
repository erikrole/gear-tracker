import { db } from "@/lib/db";
import { withHandler } from "@/lib/api";
import { HttpError, ok } from "@/lib/http";
import { tokenHash, createKioskSession } from "@/lib/auth";
import { enforceRateLimit, getClientIp } from "@/lib/rate-limit";
import { activateBody } from "@/lib/schemas/kiosk";
import { createSystemAuditEntry } from "@/lib/audit";

/**
 * Activate a kiosk device with a 6-digit code.
 * No auth required — this IS the auth bootstrapping step.
 *
 * Rate-limited per IP to slow brute-force enumeration of the 6-digit
 * (~1M) keyspace. The limiter is Upstash/KV-backed cross-instance in
 * production, with a per-instance in-memory fallback (see lib/rate-limit.ts).
 */
export const POST = withHandler(async (req) => {
  const ip = getClientIp(req);
  await enforceRateLimit(`kiosk:activate:${ip}`, { max: 5, windowMs: 15 * 60_000 });

  const { code } = activateBody.parse(await req.json());
  const hashedCode = await tokenHash(code);
  await enforceRateLimit(`kiosk:activate:code:${hashedCode}`, { max: 5, windowMs: 60 * 60_000 });

  // Hash the code and look up device
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

  // Codes are time-bounded. A null expiry means the code was already redeemed
  // (cleared below) or predates this field — treat both as no longer valid.
  if (!device.activationCodeExpiresAt || device.activationCodeExpiresAt <= new Date()) {
    throw new HttpError(401, "This activation code has expired. Ask an admin to generate a new one.");
  }

  // Single-use: atomically clear the code so it can't be redeemed twice. The
  // guarded updateMany means only one of two concurrent requests wins the
  // redemption — the loser sees count 0 and is rejected. Already-activated
  // kiosks stay signed in via the sliding session, so this never forces the
  // fleet to re-activate; only a fresh code can mint a new session.
  const redeemed = await db.kioskDevice.updateMany({
    where: { id: device.id, activationCode: hashedCode },
    data: { activationCode: null, activationCodeExpiresAt: null },
  });
  if (redeemed.count !== 1) {
    throw new HttpError(401, "Invalid activation code");
  }

  // Create session (sets cookie) and return the raw token to the native app so
  // it can survive app-container wipes by mirroring the token into Keychain.
  const sessionToken = await createKioskSession(device.id);

  // Audit kiosk activation (no user actor — use device ID as entity)
  await createSystemAuditEntry({
    entityType: "kiosk_device",
    entityId: device.id,
    action: "kiosk_activated",
    after: { deviceName: device.name, locationId: device.locationId, ip },
  });

  return ok({
    kioskId: device.id,
    name: device.name,
    location: device.location,
    sessionToken,
  });
});
