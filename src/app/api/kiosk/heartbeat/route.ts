import { withKiosk } from "@/lib/api";
import { ok } from "@/lib/http";

/**
 * Heartbeat endpoint — kiosk calls this periodically.
 * requireKiosk() already updates lastSeenAt, so just return ok.
 * GET is preferred (no CSRF gate); POST kept for backward-compat with deployed iOS clients.
 */
const handler = withKiosk(async (_req, { kiosk }) => {
  return ok({ status: "ok", kioskId: kiosk.kioskId });
});

export const GET = handler;
export const POST = handler;
