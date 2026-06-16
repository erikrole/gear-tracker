import { withAuth } from "@/lib/api";
import { HttpError } from "@/lib/http";
import { BookingKind } from "@prisma/client";
import { requireBookingAction } from "@/lib/services/booking-rules";

/**
 * POST /api/reservations/[id]/convert
 *
 * Retired app/web conversion route.
 * Reservation pickup now happens at the kiosk custody boundary.
 *
 * Permission: staff+ or owner can view the reservation, but custody still requires kiosk pickup.
 */
export const POST = withAuth<{ id: string }>(async (_req, { user, params }) => {
  const { id } = params;

  await requireBookingAction(id, user, "view", BookingKind.RESERVATION);
  throw new HttpError(403, "Pick up this reservation at a kiosk. App/web cannot create checkout custody.");
});
