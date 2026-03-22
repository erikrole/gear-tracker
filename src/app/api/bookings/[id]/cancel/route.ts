import { withAuth } from "@/lib/api";
import { ok } from "@/lib/http";
import { cancelBooking, getBookingDetail } from "@/lib/services/bookings";
import { requireBookingAction, getAllowedBookingActions } from "@/lib/services/booking-rules";

export const POST = withAuth<{ id: string }>(async (_req, { user, params }) => {
  const { id } = params;

  await requireBookingAction(id, user, "cancel");

  // Service creates audit entry internally
  await cancelBooking(id, user.id);

  // Re-fetch enriched detail so UI has full state
  const refreshed = await getBookingDetail(id);
  const allowedActions = getAllowedBookingActions(user, refreshed);
  return ok({ data: { ...refreshed, allowedActions } });
});
