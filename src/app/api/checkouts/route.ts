import { BookingKind, BookingStatus, Prisma } from "@prisma/client";
import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { HttpError, ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { createBooking, listBookings } from "@/lib/services/bookings";
import { notifyLowStock } from "@/lib/services/notifications";
import { resolveEventDefaults } from "@/lib/services/event-defaults";
import { parseDateRange } from "@/lib/time";
import { createCheckoutSchema, sanitizeBookingFields } from "@/lib/validation";
import { createAuditEntry } from "@/lib/audit";
import { loadCheckoutPolicies } from "@/lib/services/checkout-policies";

export const GET = withAuth(async (req, { user }) => {
  requirePermission(user.role, "checkout", "view");
  const { searchParams } = new URL(req.url);
  const filterParam = searchParams.get("filter");

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

  let overdueThreshold = now;
  if (filterParam === "overdue") {
    const policies = await loadCheckoutPolicies();
    // Grace period: items are overdue only after endsAt + grace window has passed
    overdueThreshold = new Date(now.getTime() - policies.gracePeriodHours * 3_600_000);
  }

  const extraWhere: Prisma.BookingWhereInput | undefined =
    filterParam === "overdue"
      ? { status: "OPEN" as never, endsAt: { lt: overdueThreshold } }
      : filterParam === "due-today"
        ? { status: "OPEN" as never, endsAt: { gte: todayStart, lt: todayEnd } }
        : undefined;

  const restrictTo = user.role === "STUDENT" ? user.id : undefined;
  const result = await listBookings(BookingKind.CHECKOUT, searchParams, extraWhere, restrictTo);
  return ok(result);
});

export const POST = withAuth(async (req, { user }) => {
  requirePermission(user.role, "checkout", "create");
  const body = sanitizeBookingFields(createCheckoutSchema.parse(await req.json()));
  // Students may only create checkouts for themselves — silently override
  // any requesterUserId in the body to prevent framing other users.
  if (user.role === "STUDENT") {
    body.requesterUserId = user.id;
  }

  const policies = await loadCheckoutPolicies();

  // Enforce max items per user (counts OPEN + PENDING_PICKUP checkouts)
  if (policies.maxItemsPerUser !== null) {
    const activeCount = await db.booking.count({
      where: {
        requesterUserId: body.requesterUserId,
        kind: BookingKind.CHECKOUT,
        status: { in: [BookingStatus.OPEN, BookingStatus.PENDING_PICKUP] },
      },
    });
    if (activeCount >= policies.maxItemsPerUser) {
      throw new HttpError(
        409,
        `This user already has ${activeCount} active checkout${activeCount === 1 ? "" : "s"} (limit: ${policies.maxItemsPerUser}).`
      );
    }
  }

  // Default endsAt to startsAt + defaultLoanDays if not supplied
  const rawEndsAt = body.endsAt
    ?? new Date(Date.parse(body.startsAt) + policies.defaultLoanDays * 86_400_000).toISOString();
  const { start, end } = parseDateRange(body.startsAt, rawEndsAt, { requireFutureStart: true });

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
    eventIds: body.eventIds,
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

  // Fire-and-forget: check bulk stock levels and notify admins if below threshold
  if (body.bulkItems.length > 0) {
    const bulkSkuIds = body.bulkItems.map((i) => i.bulkSkuId);
    Promise.resolve().then(async () => {
      try {
        const [balances, skus] = await Promise.all([
          db.bulkStockBalance.findMany({
            where: { bulkSkuId: { in: bulkSkuIds }, locationId: effectiveLocationId },
            select: { bulkSkuId: true, onHandQuantity: true },
          }),
          db.bulkSku.findMany({
            where: { id: { in: bulkSkuIds } },
            select: { id: true, name: true, minThreshold: true },
          }),
        ]);
        const balanceMap = new Map(balances.map((b) => [b.bulkSkuId, b.onHandQuantity]));
        const skuMap = new Map(skus.map((s) => [s.id, s]));

        for (const item of body.bulkItems) {
          const onHand = balanceMap.get(item.bulkSkuId);
          const sku = skuMap.get(item.bulkSkuId);
          if (onHand != null && sku && sku.minThreshold > 0 && onHand <= sku.minThreshold) {
            await notifyLowStock({
              bulkSkuId: item.bulkSkuId,
              skuName: sku.name,
              onHandQuantity: onHand,
              minThreshold: sku.minThreshold,
            });
          }
        }
      } catch (err) {
        console.error("[LOW_STOCK] Failed to check/notify:", err);
      }
    });
  }

  return ok({ data: checkout }, 201);
});
