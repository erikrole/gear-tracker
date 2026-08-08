import { withAuth } from "@/lib/api";
import { ok } from "@/lib/http";
import { extendBooking, getBookingDetail } from "@/lib/services/bookings";
import { requireBookingAction, getAllowedBookingActions } from "@/lib/services/booking-rules";
import { extendBookingSchema } from "@/lib/validation";
import { requireCollaboratorCapability } from "@/lib/collaborator-access";
import { sanitizeCollaboratorBooking } from "@/lib/collaborator-gear";
import {
  bookingSnapshotMatches,
  parseBookingSnapshotHeader,
  staleBookingError,
} from "@/lib/booking-concurrency";

export const POST = withAuth<{ id: string }>(async (req, { user, params }) => {
  if (user.role === "COLLABORATOR") {
    requireCollaboratorCapability(user, "RESERVATION_EXTEND_OWN");
  }
  const { id } = params;
  const body = extendBookingSchema.parse(await req.json());

  // Optimistic locking: matches the main PATCH /api/bookings/[id] contract so a
  // quick-extend action based on a stale tab can't silently apply against a
  // booking the user hasn't actually seen the current state of.
  const current = await getBookingDetail(id);
  const expectedUpdatedAt = parseBookingSnapshotHeader(req);
  if (!bookingSnapshotMatches(current.updatedAt, expectedUpdatedAt)) {
    throw staleBookingError();
  }

  await requireBookingAction(id, user, "extend");

  // Service creates audit entry with proper before/after snapshots
  await extendBooking(id, user.id, new Date(body.endsAt), expectedUpdatedAt);

  // Re-fetch enriched detail so UI has full state (auditLogs, allowedActions, etc.)
  const refreshed = await getBookingDetail(id);
  const allowedActions = getAllowedBookingActions(user, refreshed);
  return ok({
    data: user.role === "COLLABORATOR"
      ? { ...sanitizeCollaboratorBooking(refreshed), allowedActions }
      : { ...refreshed, allowedActions },
  });
});
