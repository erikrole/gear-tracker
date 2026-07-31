import type { AuthenticationResponseJSON } from "@simplewebauthn/server";
import { withHandler } from "@/lib/api";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { createAuditEntry } from "@/lib/audit";
import { HttpError, ok } from "@/lib/http";
import { passkeyAuthenticationVerifySchema } from "@/lib/validation";
import { verifyPasskeyAuthentication } from "@/lib/passkey";

/** POST /api/auth/passkey/login/verify — verify the assertion and issue the normal session. */
export const POST = withHandler(async (req) => {
  const ip = getClientIp(req);
  const { allowed } = await checkRateLimit(`passkey:login:verify:${ip}`, { max: 30, windowMs: 15 * 60_000 });
  if (!allowed) throw new HttpError(429, "Too many passkey sign-in attempts. Please try again later.");

  const body = passkeyAuthenticationVerifySchema.parse(await req.json());
  const result = await verifyPasskeyAuthentication(
    body.response as unknown as AuthenticationResponseJSON,
    ip,
  );

  await createAuditEntry({
    actorId: result.user.id,
    actorRole: result.user.role,
    entityType: "session",
    entityId: result.user.id,
    action: "passkey_login",
    after: { ip, credentialId: result.credentialId },
  });

  return ok({ user: result.user });
});
