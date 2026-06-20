import { withAuth } from "@/lib/api";
import { ok, HttpError } from "@/lib/http";
import {
  getBookingDetail,
  updateReservation,
  updateCheckout
} from "@/lib/services/bookings";
import { getAllowedBookingActions, requireBookingAction } from "@/lib/services/booking-rules";
import { updateBookingSchema, sanitizeBookingFields } from "@/lib/validation";
import { createAuditEntry } from "@/lib/audit";

export const GET = withAuth<{ id: string }>(async (_req, { user, params }) => {
  const { id } = params;
  const detail = await getBookingDetail(id);

  // Students may only view bookings they requested or created. ADMIN/STAFF
  // can view any booking. Without this check, a student iterating booking
  // IDs could read every requester's PII (IDOR).
  if (user.role === "STUDENT" && detail.requesterUserId !== user.id && detail.createdBy !== user.id) {
    throw new HttpError(404, "Booking not found");
  }

  const allowedActions = getAllowedBookingActions(user, detail);

  return ok({ data: { ...detail, allowedActions } });
});

export const PATCH = withAuth<{ id: string }>(async (req, { user, params }) => {
  const { id } = params;
  const body = sanitizeBookingFields(updateBookingSchema.parse(await req.json()));

  // Fetch current state for before-snapshot and kind detection
  const detail = await getBookingDetail(id);

  // Optimistic locking: every edit client must send the snapshot it edited.
  const ifUnmodified = req.headers.get("if-unmodified-since");
  if (!ifUnmodified) {
    throw new HttpError(428, "Missing If-Unmodified-Since header. Refresh and try again.");
  }
  const clientTs = new Date(ifUnmodified).getTime();
  const serverTs = Math.floor(new Date(detail.updatedAt).getTime() / 1000) * 1000;
  if (Number.isNaN(clientTs)) {
    throw new HttpError(400, "Invalid If-Unmodified-Since header.");
  }
  if (clientTs < serverTs) {
    throw new HttpError(409, "This booking was modified by someone else. Please refresh and try again.");
  }

  await requireBookingAction(id, user, "edit");

  const beforeSnapshot = {
    title: detail.title,
    requesterUserId: detail.requesterUserId,
    locationId: detail.locationId,
    startsAt: detail.startsAt,
    endsAt: detail.endsAt,
    serializedAssetIds: detail.serializedItems.map((item) => item.assetId),
    bulkItems: detail.bulkItems.map((item) => ({
      bulkSkuId: item.bulkSkuId,
      plannedQuantity: item.plannedQuantity,
    })),
    notes: detail.notes,
  };

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
