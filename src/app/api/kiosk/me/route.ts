import { withKiosk } from "@/lib/api";
import { ok } from "@/lib/http";

/**
 * Return current kiosk device context.
 * Used by the kiosk UI to check if it's activated.
 */
export const GET = withKiosk(async (_req, { kiosk }) => {
  return ok({
    kioskId: kiosk.kioskId,
    locationId: kiosk.locationId,
    locationName: kiosk.locationName,
  });
});
