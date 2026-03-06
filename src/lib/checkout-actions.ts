/**
 * Client-side checkout action gating.
 *
 * Mirrors src/lib/services/checkout-rules.ts for UI-level visibility.
 * Server still enforces on every mutation — this is for display only.
 *
 * Source of truth: AREA_CHECKOUTS.md action matrix + AREA_USERS.md permission model.
 */

export type CheckoutAction = "edit" | "extend" | "cancel" | "checkin" | "open";

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

const STATE_ACTIONS: Record<string, Set<CheckoutAction>> = {
  DRAFT: new Set(["edit", "cancel"]),
  BOOKED: new Set(["edit", "extend", "cancel", "open"]),
  OPEN: new Set(["edit", "extend", "cancel", "checkin"]),
  COMPLETED: new Set(),
  CANCELLED: new Set(),
};

/**
 * Get all allowed actions for the given actor and checkout booking.
 * Use this in list views where allowedActions isn't available from the API.
 */
export function getAllowedActionsClient(
  actor: ActorContext,
  booking: BookingContext
): CheckoutAction[] {
  const all: CheckoutAction[] = ["edit", "extend", "cancel", "checkin", "open"];
  return all.filter((action) => {
    const stateActions = STATE_ACTIONS[booking.status];
    if (!stateActions || !stateActions.has(action)) return false;

    // Cancel on OPEN requires staff+
    if (action === "cancel" && booking.status === "OPEN") {
      return isStaffOrAbove(actor.role);
    }

    return hasAccess(actor, booking);
  });
}
