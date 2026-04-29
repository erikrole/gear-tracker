import { withKiosk } from "@/lib/api";
import { ok } from "@/lib/http";

/**
 * Heartbeat endpoint — kiosk calls this periodically.
 * requireKiosk() already updates lastSeenAt, so just return ok.
 */
export const POST = withKiosk(async (_req, { kiosk }) => {
  return ok({ status: "ok", kioskId: kiosk.kioskId });
});
