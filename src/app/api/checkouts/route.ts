import { BookingKind, Prisma } from "@prisma/client";
import { withAuth } from "@/lib/api";
import { ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { createBooking, listBookings } from "@/lib/services/bookings";
import { resolveEventDefaults } from "@/lib/services/event-defaults";
import { parseDateRange } from "@/lib/time";
import { createCheckoutSchema, sanitizeBookingFields } from "@/lib/validation";
import { createAuditEntry } from "@/lib/audit";

export const GET = withAuth(async (req, { user }) => {
  requirePermission(user.role, "checkout", "view");
  const { searchParams } = new URL(req.url);
  const filterParam = searchParams.get("filter");

  // Checkout-specific derived filters: overdue = OPEN + past due, due-today = OPEN + due today
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

  const extraWhere: Prisma.BookingWhereInput | undefined =
    filterParam === "overdue"
      ? { status: "OPEN" as never, endsAt: { lt: now } }
      : filterParam === "due-today"
        ? { status: "OPEN" as never, endsAt: { gte: todayStart, lt: todayEnd } }
        : undefined;

  const result = await listBookings(BookingKind.CHECKOUT, searchParams, extraWhere);
  return ok(result);
});

export const POST = withAuth(async (req, { user }) => {
  requirePermission(user.role, "checkout", "create");
  const body = sanitizeBookingFields(createCheckoutSchema.parse(await req.json()));
  const { start, end } = parseDateRange(body.startsAt, body.endsAt, { requireFutureStart: true });

  // Event-default prefill: if sportCode provided but no eventId,
  // look up next upcoming event and use as defaults (ad hoc fallback if none found)
  let eventId = body.eventId;
  let title = body.title;
  let effectiveStart = start;
  let effectiveEnd = end;
  let effectiveLocationId = body.locationId;
  let sportCode = body.sportCode;

  if (body.sportCode && !body.eventId) {
    const defaults = await resolveEventDefaults(body.sportCode);
    if (defaults.eventId) {
      eventId = defaults.eventId;
      // Use event values as defaults, but caller-supplied values take precedence
      title = body.title || defaults.title || body.title;
      if (defaults.startsAt) effectiveStart = defaults.startsAt;
      if (defaults.endsAt) effectiveEnd = defaults.endsAt;
      if (defaults.locationId) effectiveLocationId = defaults.locationId;
      sportCode = defaults.sportCode ?? body.sportCode;
    }
  }

  const checkout = await createBooking({
    kind: BookingKind.CHECKOUT,
    title,
    requesterUserId: body.requesterUserId,
    locationId: effectiveLocationId,
    startsAt: effectiveStart,
    endsAt: effectiveEnd,
    serializedAssetIds: body.serializedAssetIds,
    bulkItems: body.bulkItems,
    notes: body.notes,
    createdBy: user.id,
    sourceReservationId: body.sourceReservationId,
    eventId,
    sportCode,
    shiftAssignmentId: body.shiftAssignmentId,
    kitId: body.kitId
  });

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "booking",
    entityId: checkout.id,
    action: "create",
    after: { title: checkout.title ?? body.title, kind: "CHECKOUT" },
  });

  return ok({ data: checkout }, 201);
});
