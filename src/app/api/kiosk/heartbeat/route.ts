import { withKiosk } from "@/lib/api";
import { ok } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";

/**
 * Heartbeat endpoint — kiosk calls this periodically.
 * requireKiosk() already updates lastSeenAt, so just return ok.
 * GET is preferred (no CSRF gate); POST kept for backward-compat with deployed iOS clients.
 */
const handler = withKiosk(async (_req, { kiosk }) => {
  await enforceRateLimit(`kiosk:heartbeat:${kiosk.kioskId}`, { max: 1, windowMs: 60_000 });
  return ok({ status: "ok", kioskId: kiosk.kioskId });
});

export const GET = handler;
export const POST = handler;
