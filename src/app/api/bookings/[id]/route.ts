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
import type { z } from "zod";
import { requireCollaboratorCapability } from "@/lib/collaborator-access";
import { collaboratorBookingResponse } from "@/lib/collaborator-gear";

type BookingPatchBody = z.infer<typeof updateBookingSchema>;

function sortedStrings(values: string[]) {
  return [...values].sort((a, b) => a.localeCompare(b));
}

function sameDateInstant(value: string, current: Date | string) {
  const requested = new Date(value).getTime();
  const existing = new Date(current).getTime();
  return !Number.isNaN(requested) && requested === existing;
}

function sameStringSet(lhs: string[], rhs: string[]) {
  return JSON.stringify(sortedStrings(lhs)) === JSON.stringify(sortedStrings(rhs));
}

function sameBulkItems(
  requested: Array<{ bulkSkuId: string; quantity: number }>,
  current: Array<{ bulkSkuId: string; plannedQuantity: number }>,
) {
  const normalizeRequested = requested
    .map((item) => ({ bulkSkuId: item.bulkSkuId, quantity: item.quantity }))
    .sort((a, b) => a.bulkSkuId.localeCompare(b.bulkSkuId));
  const normalizeCurrent = current
    .map((item) => ({ bulkSkuId: item.bulkSkuId, quantity: item.plannedQuantity }))
    .sort((a, b) => a.bulkSkuId.localeCompare(b.bulkSkuId));
  return JSON.stringify(normalizeRequested) === JSON.stringify(normalizeCurrent);
}

function isIdempotentStalePatch(body: BookingPatchBody, detail: Awaited<ReturnType<typeof getBookingDetail>>) {
  if (body.title !== undefined && body.title !== detail.title) return false;
  if (body.notes !== undefined && body.notes !== (detail.notes ?? "")) return false;
  if (body.requesterUserId !== undefined && body.requesterUserId !== detail.requesterUserId) return false;
  if (body.locationId !== undefined && body.locationId !== detail.locationId) return false;
  if (body.startsAt !== undefined && !sameDateInstant(body.startsAt, detail.startsAt)) return false;
  if (body.endsAt !== undefined && !sameDateInstant(body.endsAt, detail.endsAt)) return false;
  if (body.serializedAssetIds !== undefined) {
    const currentAssetIds = detail.serializedItems.map((item) => item.assetId);
    if (!sameStringSet(body.serializedAssetIds, currentAssetIds)) return false;
  }
  if (body.bulkItems !== undefined && !sameBulkItems(body.bulkItems, detail.bulkItems)) return false;
  return true;
}

export const GET = withAuth<{ id: string }>(async (_req, { user, params }) => {
  if (user.role === "COLLABORATOR") {
    requireCollaboratorCapability(user, "MY_GEAR_VIEW");
  }
  const { id } = params;
  const detail = await getBookingDetail(id);

  // Students may only view bookings they requested or created. ADMIN/STAFF
  // can view any booking. Without this check, a student iterating booking
  // IDs could read every requester's PII (IDOR).
  if (
    (user.role === "STUDENT" || user.role === "COLLABORATOR") &&
    detail.requesterUserId !== user.id &&
    detail.createdBy !== user.id
  ) {
    throw new HttpError(404, "Booking not found");
  }

  const allowedActions = getAllowedBookingActions(user, detail);

  return ok({
    data: user.role === "COLLABORATOR"
      ? collaboratorBookingResponse(detail, allowedActions)
      : { ...detail, allowedActions },
  });
});

export const PATCH = withAuth<{ id: string }>(async (req, { user, params }) => {
  if (user.role === "COLLABORATOR") {
    requireCollaboratorCapability(user, "RESERVATION_EDIT_OWN");
  }
  const { id } = params;
  const body = sanitizeBookingFields(updateBookingSchema.parse(await req.json()));
  if (
    user.role === "COLLABORATOR" &&
    body.requesterUserId !== undefined &&
    body.requesterUserId !== user.id
  ) {
    throw new HttpError(403, "Collaborators cannot reassign reservations");
  }

  // Fetch current state for before-snapshot and kind detection
  const detail = await getBookingDetail(id);
  if (user.role === "COLLABORATOR" && detail.kind !== "RESERVATION") {
    throw new HttpError(403, "Collaborators cannot edit checkouts");
  }

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
    if (isIdempotentStalePatch(body, detail)) {
      await requireBookingAction(id, user, "edit");
      const allowedActions = getAllowedBookingActions(user, detail);
      return ok({
        data: user.role === "COLLABORATOR"
          ? collaboratorBookingResponse(detail, allowedActions)
          : { ...detail, allowedActions },
      });
    }
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
  return ok({
    data: user.role === "COLLABORATOR"
      ? collaboratorBookingResponse(refreshed, allowedActions)
      : { ...refreshed, allowedActions },
  });
});
