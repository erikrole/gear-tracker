import { withAuth } from "@/lib/api";
import { HttpError } from "@/lib/http";

// Checkout scanning is gated to kiosk only.
export const POST = withAuth(async () => {
  throw new HttpError(403, "Checkout scanning must be done at a kiosk");
});
