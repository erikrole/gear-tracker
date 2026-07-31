import { withAuth } from "@/lib/api";
import { enforceRateLimit } from "@/lib/rate-limit";
import { ok } from "@/lib/http";
import { listPasskeys } from "@/lib/passkey";

/** GET /api/me/passkeys — list the caller's passkey metadata without credential material. */
export const GET = withAuth(async (_req, { user }) => {
  await enforceRateLimit(`passkey:list:${user.id}`, { max: 30, windowMs: 60_000 });
  return ok({ data: await listPasskeys(user.id) });
});
