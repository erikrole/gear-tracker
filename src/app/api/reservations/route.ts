import { BookingKind, BookingStatus, Prisma } from "@prisma/client";
import { withAuth } from "@/lib/api";
import { HttpError, ok } from "@/lib/http";
import { requirePermissionOrCollaboratorCapability } from "@/lib/rbac";
import { createBooking, listBookings } from "@/lib/services/bookings";
import { parseDateRange } from "@/lib/time";
import { createReservationSchema, sanitizeBookingFields } from "@/lib/validation";
import { createReservationLifecycleNotification } from "@/lib/services/notifications";
import { loadReservationRules } from "@/lib/services/reservation-rules";
import { sanitizeCollaboratorBooking } from "@/lib/collaborator-gear";

export const GET = withAuth(async (req, { user }) => {
  requirePermissionOrCollaboratorCapability(user, "booking", "view", "MY_GEAR_VIEW");
  const { searchParams } = new URL(req.url);
  const filterParam = searchParams.get("filter");
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
  const extraWhere: Prisma.BookingWhereInput | undefined =
    filterParam === "overdue"
      ? { status: BookingStatus.BOOKED, endsAt: { lt: now } }
      : filterParam === "due-today"
        ? { status: BookingStatus.BOOKED, endsAt: { gte: todayStart, lt: todayEnd } }
        : undefined;

  const restrictTo = user.role === "STUDENT" || user.role === "COLLABORATOR" ? user.id : undefined;
  const result = await listBookings(BookingKind.RESERVATION, searchParams, extraWhere, restrictTo);
  return ok({
    ...result,
    data: user.role === "COLLABORATOR"
      ? result.data.map(sanitizeCollaboratorBooking)
      : result.data,
  });
});

export const POST = withAuth(async (req, { user }) => {
  requirePermissionOrCollaboratorCapability(user, "booking", "create", "RESERVATION_CREATE");
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    throw new HttpError(400, "Request body must be valid JSON");
  }
  const body = sanitizeBookingFields(createReservationSchema.parse(rawBody));
  // Students may only create reservations for themselves.
  if (user.role === "STUDENT" || user.role === "COLLABORATOR") {
    body.requesterUserId = user.id;
  }
  const { start, end } = parseDateRange(body.startsAt, body.endsAt, { requireFutureStart: true });

  const rules = await loadReservationRules();

  // Enforce advance booking window
  if (rules.advanceWindowDays !== null) {
    const maxStartMs = Date.now() + rules.advanceWindowDays * 86_400_000;
    if (start.getTime() > maxStartMs) {
      throw new HttpError(
        409,
        `Reservations cannot be made more than ${rules.advanceWindowDays} day${rules.advanceWindowDays === 1 ? "" : "s"} in advance.`
      );
    }
  }

  const reservation = await createBooking({
    kind: BookingKind.RESERVATION,
    maxConcurrentReservations: rules.maxConcurrentReservations ?? undefined,
    title: body.title,
    requesterUserId: body.requesterUserId,
    locationId: body.locationId,
    startsAt: start,
    endsAt: end,
    serializedAssetIds: body.serializedAssetIds,
    bulkItems: body.bulkItems,
    notes: body.notes,
    createdBy: user.id,
    eventId: body.eventId,
    eventIds: body.eventIds,
    sportCode: body.sportCode,
    shiftAssignmentId: body.shiftAssignmentId,
    kitId: body.kitId,
  });

  // Audit entry is written inside createBooking()'s transaction — do not log again here.

  void createReservationLifecycleNotification({
    bookingId: reservation.id,
    bookingTitle: reservation.title ?? body.title,
    requesterUserId: body.requesterUserId,
    actorUserId: user.id,
    event: "booked",
  });

  return ok({
    data: user.role === "COLLABORATOR"
      ? sanitizeCollaboratorBooking(reservation)
      : reservation,
  }, 201);
});
