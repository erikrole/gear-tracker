import { db } from "@/lib/db";
import { withAuth } from "@/lib/api";
import { HttpError, ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { createAuditEntry } from "@/lib/audit";
import { tokenHash } from "@/lib/auth";
import { enforceRateLimit, SETTINGS_MUTATION_LIMIT } from "@/lib/rate-limit";

function generateActivationCode(): string {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  const code = 100000 + (buf[0]! % 900000); // buf has exactly 1 element
  return code.toString();
}

/**
 * Regenerate the activation code for a kiosk device.
 * Active kiosks must be deactivated first so regeneration cannot silently
 * sign out a running iPad.
 */
export const POST = withAuth<{ id: string }>(async (_req, { user, params }) => {
  requirePermission(user.role, "kiosk_device", "edit");
  await enforceRateLimit(`kiosk-devices:write:${user.id}`, SETTINGS_MUTATION_LIMIT);

  const device = await db.kioskDevice.findUnique({ where: { id: params.id } });
  if (!device) throw new HttpError(404, "Kiosk device not found");

  if (device.active && device.activatedAt) {
    throw new HttpError(
      409,
      "Deactivate this kiosk before regenerating its code."
    );
  }

  const rawCode = generateActivationCode();
  const hashedCode = await tokenHash(rawCode);

  await db.kioskDevice.update({
    where: { id: params.id },
    data: {
      activationCode: hashedCode,
      activatedAt: null,
      sessionToken: null,
      sessionExpiresAt: null,
    },
  });

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "kiosk_device",
    entityId: device.id,
    action: "regenerate_activation_code",
    before: { name: device.name },
    after: { name: device.name },
  });

  return ok({
    id: device.id,
    name: device.name,
    activationCode: rawCode,
  });
});
