import { BookingKind } from "@prisma/client";
import { withAuth } from "@/lib/api";
import { HttpError, ok } from "@/lib/http";
import { getAllowedBookingActions, requireBookingAction } from "@/lib/services/booking-rules";
import { getBookingDetail, updateReservationEvents } from "@/lib/services/bookings";
import { updateReservationEventsSchema } from "@/lib/validation";

export const POST = withAuth<{ id: string }>(async (req, { user, params }) => {
  const { id } = params;
  const body = updateReservationEventsSchema.parse(await req.json());

  const current = await getBookingDetail(id);
  if (current.kind !== BookingKind.RESERVATION) {
    throw new HttpError(404, "Reservation not found");
  }

  const ifUnmodified = req.headers.get("if-unmodified-since");
  if (!ifUnmodified) {
    throw new HttpError(428, "Missing If-Unmodified-Since header. Refresh and try again.");
  }
  const clientTs = new Date(ifUnmodified).getTime();
  if (Number.isNaN(clientTs)) {
    throw new HttpError(400, "Invalid If-Unmodified-Since header.");
  }
  const serverTs = Math.floor(new Date(current.updatedAt).getTime() / 1000) * 1000;
  if (clientTs < serverTs) {
    throw new HttpError(409, "This reservation was modified by someone else. Please refresh and try again.");
  }

  await requireBookingAction(id, user, "edit", BookingKind.RESERVATION);
  await updateReservationEvents(id, user.id, body.eventIds);

  const refreshed = await getBookingDetail(id);
  const allowedActions = getAllowedBookingActions(user, refreshed);
  return ok({ data: { ...refreshed, allowedActions } });
});
