import { withAuth } from "@/lib/api";
import { enforceRateLimit } from "@/lib/rate-limit";
import { createAuditEntry } from "@/lib/audit";
import { HttpError, ok } from "@/lib/http";
import { passkeyRevokeSchema } from "@/lib/validation";
import { revokePasskey, verifyCurrentPassword } from "@/lib/passkey";

/** DELETE /api/me/passkeys/:id — revoke one passkey after current-password reauthentication. */
export const DELETE = withAuth<{ id: string }>(async (req, { user, params }) => {
  await enforceRateLimit(`passkey:revoke:${user.id}`, { max: 10, windowMs: 60_000 });
  const id = params.id.trim();
  if (!id) throw new HttpError(400, "Passkey id is required.");
  const body = passkeyRevokeSchema.parse(await req.json());
  await verifyCurrentPassword(user.id, body.currentPassword);
  await revokePasskey(user.id, id);

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "passkey_credential",
    entityId: id,
    action: "passkey_revoked",
  });

  return ok({ success: true });
});
