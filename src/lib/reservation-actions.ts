/**
 * Client-side reservation action gating.
 *
 * Mirrors src/lib/services/reservation-rules.ts for UI-level visibility.
 * Server still enforces on every mutation — this is for display only.
 *
 * Source of truth: AREA_RESERVATIONS.md action matrix + AREA_USERS.md permission model.
 */

export type ReservationAction = "edit" | "extend" | "cancel" | "convert";

type BookingContext = {
  status: string;
  requesterUserId?: string;
  createdBy?: string;
  requester?: { id: string };
  creator?: { id: string };
};

type ActorContext = {
  id: string;
  role: string;
};

function isStaffOrAbove(role: string): boolean {
  return role === "ADMIN" || role === "STAFF";
}

function isOwner(actor: ActorContext, booking: BookingContext): boolean {
  const requesterId = booking.requesterUserId ?? booking.requester?.id;
  const creatorId = booking.createdBy ?? booking.creator?.id;
  return actor.id === requesterId || actor.id === creatorId;
}

function hasAccess(actor: ActorContext, booking: BookingContext): boolean {
  return isStaffOrAbove(actor.role) || isOwner(actor, booking);
}

const STATE_ACTIONS: Record<string, Set<ReservationAction>> = {
  DRAFT: new Set(["edit", "cancel"]),
  BOOKED: new Set(["edit", "extend", "cancel", "convert"]),
  COMPLETED: new Set(),
  CANCELLED: new Set(),
};

/**
 * Get all allowed actions for the given actor and reservation booking.
 * Use this in list views where allowedActions isn't available from the API.
 */
export function getAllowedReservationActionsClient(
  actor: ActorContext,
  booking: BookingContext
): ReservationAction[] {
  const all: ReservationAction[] = ["edit", "extend", "cancel", "convert"];
  return all.filter((action) => {
    const stateActions = STATE_ACTIONS[booking.status];
    if (!stateActions || !stateActions.has(action)) return false;
    return hasAccess(actor, booking);
  });
}
