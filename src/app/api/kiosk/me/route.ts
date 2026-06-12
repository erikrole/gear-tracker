import { withKiosk } from "@/lib/api";
import { ok } from "@/lib/http";

/**
 * Return current kiosk device context.
 * Used by the kiosk UI to check if it's activated, and to rebuild its local
 * device info after a reinstall when only the Keychain session token survives.
 */
export const GET = withKiosk(async (_req, { kiosk }) => {
  return ok({
    kioskId: kiosk.kioskId,
    name: kiosk.name,
    locationId: kiosk.locationId,
    locationName: kiosk.locationName,
  });
});
