import { withAuth } from "@/lib/api";
import { ok, HttpError } from "@/lib/http";
import {
  getBookingDetail,
  updateReservation,
  updateCheckout
} from "@/lib/services/bookings";
import { BookingKind } from "@prisma/client";
import { getAllowedBookingActions, requireBookingAction } from "@/lib/services/booking-rules";
import { updateBookingSchema, sanitizeBookingFields } from "@/lib/validation";
import { createAuditEntry } from "@/lib/audit";

export const GET = withAuth<{ id: string }>(async (_req, { user, params }) => {
  const { id } = params;
  const detail = await getBookingDetail(id);

  const allowedActions = getAllowedBookingActions(user, detail);

  return ok({ data: { ...detail, allowedActions } });
});

export const PATCH = withAuth<{ id: string }>(async (req, { user, params }) => {
  const { id } = params;
  const body = sanitizeBookingFields(updateBookingSchema.parse(await req.json()));

  // Fetch current state for before-snapshot and kind detection
  const detail = await getBookingDetail(id);

  // Optimistic locking: reject if client's snapshot is stale.
  // Header is opt-in — UIs that track updatedAt should always send it.
  // Clients that omit the header bypass conflict detection (last-write-wins).
  const ifUnmodified = req.headers.get("if-unmodified-since");
  if (ifUnmodified && detail.updatedAt) {
    const clientTs = new Date(ifUnmodified).getTime();
    const serverTs = new Date(detail.updatedAt).getTime();
    if (!Number.isNaN(clientTs) && clientTs < serverTs) {
      throw new HttpError(409, "This booking was modified by someone else. Please refresh and try again.");
    }
  }

  await requireBookingAction(id, user, "edit");

  // Build before-snapshot from fields being changed
  const beforeSnapshot: Record<string, unknown> = {};
  for (const key of Object.keys(body) as Array<keyof typeof body>) {
    if (body[key] !== undefined) {
      beforeSnapshot[key] = (detail as Record<string, unknown>)[key];
    }
  }

  if (detail.kind === "RESERVATION") {
    await updateReservation(id, user.id, {
      title: body.title,
      requesterUserId: body.requesterUserId,
      locationId: body.locationId,
      startsAt: body.startsAt ? new Date(body.startsAt) : undefined,
      endsAt: body.endsAt ? new Date(body.endsAt) : undefined,
      serializedAssetIds: body.serializedAssetIds,
      bulkItems: body.bulkItems,
      notes: body.notes
    });
  } else {
    await updateCheckout(id, user.id, {
      title: body.title,
      endsAt: body.endsAt ? new Date(body.endsAt) : undefined,
      serializedAssetIds: body.serializedAssetIds,
      bulkItems: body.bulkItems,
      notes: body.notes
    });
  }

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "booking",
    entityId: id,
    action: "updated",
    before: beforeSnapshot,
    after: body as Record<string, unknown>,
  });

  // Re-fetch enriched detail so the UI has full state (auditLogs, allowedActions, etc.)
  const refreshed = await getBookingDetail(id);
  const allowedActions = getAllowedBookingActions(user, refreshed);
  return ok({ data: { ...refreshed, allowedActions } });
});
