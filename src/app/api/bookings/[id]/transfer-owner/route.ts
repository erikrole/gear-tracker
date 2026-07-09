import { withAuth } from "@/lib/api";
import { HttpError, ok } from "@/lib/http";
import { getBookingDetail, transferBookingOwner } from "@/lib/services/bookings";
import { getAllowedBookingActions, requireBookingAction } from "@/lib/services/booking-rules";
import { transferBookingOwnerSchema } from "@/lib/validation";

export const POST = withAuth<{ id: string }>(async (req, { user, params }) => {
  const { id } = params;
  const body = transferBookingOwnerSchema.parse(await req.json());

  const current = await getBookingDetail(id);
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
    throw new HttpError(409, "This booking was modified by someone else. Please refresh and try again.");
  }

  await requireBookingAction(id, user, "transfer-owner");
  await transferBookingOwner(id, user.id, body);

  const refreshed = await getBookingDetail(id);
  const allowedActions = getAllowedBookingActions(user, refreshed);
  return ok({ data: { ...refreshed, allowedActions } });
});
