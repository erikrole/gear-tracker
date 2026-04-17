import { withAuth } from "@/lib/api";
import { HttpError } from "@/lib/http";

// Check-in scanning is gated to kiosk only.
export const POST = withAuth(async () => {
  throw new HttpError(403, "Check-in scanning must be done at a kiosk");
});
