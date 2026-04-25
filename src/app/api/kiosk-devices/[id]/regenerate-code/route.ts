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
  const code = 100000 + (buf[0] % 900000);
  return code.toString();
}

/**
 * Regenerate the one-shot activation code for a kiosk device.
 * Only allowed while the device is still pending activation — once a kiosk
 * has activated and is running, regenerating would silently lock it out.
 */
export const POST = withAuth<{ id: string }>(async (_req, { user, params }) => {
  requirePermission(user.role, "kiosk_device", "edit");
  await enforceRateLimit(`kiosk-devices:write:${user.id}`, SETTINGS_MUTATION_LIMIT);

  const device = await db.kioskDevice.findUnique({ where: { id: params.id } });
  if (!device) throw new HttpError(404, "Kiosk device not found");

  if (device.activatedAt) {
    throw new HttpError(
      409,
      "Cannot regenerate code for an already-activated kiosk. Deactivate it first."
    );
  }

  const rawCode = generateActivationCode();
  const hashedCode = await tokenHash(rawCode);

  await db.kioskDevice.update({
    where: { id: params.id },
    data: { activationCode: hashedCode },
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
