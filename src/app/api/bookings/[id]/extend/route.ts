import { withAuth } from "@/lib/api";
import { ok, HttpError } from "@/lib/http";
import { extendBooking, getBookingDetail } from "@/lib/services/bookings";
import { requireBookingAction, getAllowedBookingActions } from "@/lib/services/booking-rules";
import { extendBookingSchema } from "@/lib/validation";

export const POST = withAuth<{ id: string }>(async (req, { user, params }) => {
  const { id } = params;
  const body = extendBookingSchema.parse(await req.json());

  // Optimistic locking: matches the main PATCH /api/bookings/[id] contract so a
  // quick-extend action based on a stale tab can't silently apply against a
  // booking the user hasn't actually seen the current state of.
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

  await requireBookingAction(id, user, "extend");

  // Service creates audit entry with proper before/after snapshots
  await extendBooking(id, user.id, new Date(body.endsAt));

  // Re-fetch enriched detail so UI has full state (auditLogs, allowedActions, etc.)
  const refreshed = await getBookingDetail(id);
  const allowedActions = getAllowedBookingActions(user, refreshed);
  return ok({ data: { ...refreshed, allowedActions } });
});
