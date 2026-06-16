import { withAuth } from "@/lib/api";
import { HttpError } from "@/lib/http";
import { BookingKind } from "@prisma/client";
import { requireBookingAction } from "@/lib/services/booking-rules";

export const POST = withAuth<{ id: string }>(async (_req, { user, params }) => {
  const { id } = params;

  await requireBookingAction(id, user, "view", BookingKind.CHECKOUT);
  throw new HttpError(403, "Return gear at a kiosk. App/web cannot complete checkout returns.");
});
