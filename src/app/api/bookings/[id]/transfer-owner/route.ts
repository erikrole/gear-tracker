import { withAuth } from "@/lib/api";
import { ok } from "@/lib/http";
import { getBookingDetail, transferBookingOwner } from "@/lib/services/bookings";
import { getAllowedBookingActions, requireBookingAction } from "@/lib/services/booking-rules";
import { transferBookingOwnerSchema } from "@/lib/validation";
import {
  bookingSnapshotMatches,
  parseBookingSnapshotHeader,
  staleBookingError,
} from "@/lib/booking-concurrency";

export const POST = withAuth<{ id: string }>(async (req, { user, params }) => {
  const { id } = params;
  const body = transferBookingOwnerSchema.parse(await req.json());

  const current = await getBookingDetail(id);
  const expectedUpdatedAt = parseBookingSnapshotHeader(req);
  if (!bookingSnapshotMatches(current.updatedAt, expectedUpdatedAt)) {
    if (current.requesterUserId === body.targetUserId) {
      await requireBookingAction(id, user, "transfer-owner");
      const allowedActions = getAllowedBookingActions(user, current);
      return ok({ data: { ...current, allowedActions } });
    }
    throw staleBookingError();
  }

  await requireBookingAction(id, user, "transfer-owner");
  await transferBookingOwner(id, user.id, body, expectedUpdatedAt);

  const refreshed = await getBookingDetail(id);
  const allowedActions = getAllowedBookingActions(user, refreshed);
  return ok({ data: { ...refreshed, allowedActions } });
});
