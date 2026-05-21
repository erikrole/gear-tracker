import { BookingKind, BookingStatus, Prisma } from "@prisma/client";
import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { HttpError, ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { createBooking, listBookings } from "@/lib/services/bookings";
import { parseDateRange } from "@/lib/time";
import { createAuditEntry } from "@/lib/audit";
import { createReservationSchema, sanitizeBookingFields } from "@/lib/validation";
import { createReservationLifecycleNotification } from "@/lib/services/notifications";
import { loadReservationRules } from "@/lib/services/reservation-rules";

export const GET = withAuth(async (req, { user }) => {
  requirePermission(user.role, "booking", "view");
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

  const restrictTo = user.role === "STUDENT" ? user.id : undefined;
  const result = await listBookings(BookingKind.RESERVATION, searchParams, extraWhere, restrictTo);
  return ok(result);
});

export const POST = withAuth(async (req, { user }) => {
  requirePermission(user.role, "booking", "create");
  const body = sanitizeBookingFields(createReservationSchema.parse(await req.json()));
  // Students may only create reservations for themselves.
  if (user.role === "STUDENT") {
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

  // Enforce max concurrent reservations per user
  if (rules.maxConcurrentReservations !== null) {
    const activeCount = await db.booking.count({
      where: {
        requesterUserId: body.requesterUserId,
        kind: BookingKind.RESERVATION,
        status: BookingStatus.BOOKED,
      },
    });
    if (activeCount >= rules.maxConcurrentReservations) {
      throw new HttpError(
        409,
        `This user already has ${activeCount} active reservation${activeCount === 1 ? "" : "s"} (limit: ${rules.maxConcurrentReservations}).`
      );
    }
  }

  const reservation = await createBooking({
    kind: BookingKind.RESERVATION,
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

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "booking",
    entityId: reservation.id,
    action: "create",
    after: { title: reservation.title ?? body.title, kind: "RESERVATION" },
  });

  void createReservationLifecycleNotification({
    bookingId: reservation.id,
    bookingTitle: reservation.title ?? body.title,
    requesterUserId: body.requesterUserId,
    actorUserId: user.id,
    event: "booked",
  });

  return ok({ data: reservation }, 201);
});
