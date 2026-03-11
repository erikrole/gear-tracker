/**
 * Client-side booking action gating (unified for checkouts and reservations).
 *
 * Mirrors src/lib/services/booking-rules.ts for UI-level visibility.
 * Server still enforces on every mutation — this is for display only.
 *
 * Source of truth: AREA_CHECKOUTS.md + AREA_RESERVATIONS.md action matrices
 *                  + AREA_USERS.md permission model.
 */

export type BookingKind = "CHECKOUT" | "RESERVATION";

export type CheckoutAction = "edit" | "extend" | "cancel" | "checkin" | "open";
export type ReservationAction = "edit" | "extend" | "cancel" | "convert" | "duplicate";
export type BookingAction = CheckoutAction | ReservationAction;

export type BookingContext = {
  status: string;
  requesterUserId?: string;
  createdBy?: string;
  requester?: { id: string };
  creator?: { id: string };
};

export type ActorContext = {
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

/**
 * State × Action matrix per booking kind.
 *
 * Checkout:    DRAFT(edit,cancel) → BOOKED(edit,extend,cancel,open) → OPEN(edit,extend,cancel,checkin) → COMPLETED/CANCELLED(none)
 * Reservation: DRAFT(edit,cancel) → BOOKED(edit,extend,cancel,convert) → COMPLETED/CANCELLED(none)
 */
const STATE_ACTIONS: Record<BookingKind, Record<string, Set<string>>> = {
  CHECKOUT: {
    DRAFT: new Set(["edit", "cancel"]),
    BOOKED: new Set(["edit", "extend", "cancel", "open"]),
    OPEN: new Set(["edit", "extend", "cancel", "checkin"]),
    COMPLETED: new Set(),
    CANCELLED: new Set(),
  },
  RESERVATION: {
    DRAFT: new Set(["edit", "cancel"]),
    BOOKED: new Set(["edit", "extend", "cancel", "convert", "duplicate"]),
    COMPLETED: new Set(["duplicate"]),
    CANCELLED: new Set(["duplicate"]),
  },
};

/**
 * Special-case overrides (e.g., cancel on OPEN checkout requires staff+).
 * Returns true if the action should be allowed despite the normal access check,
 * or false if it should be blocked, or undefined to fall through to normal access check.
 */
function specialCaseOverride(
  actor: ActorContext,
  booking: BookingContext,
  kind: BookingKind,
  action: string
): boolean | undefined {
  // Cancel on OPEN checkouts requires staff+ (students cannot cancel active checkouts)
  if (kind === "CHECKOUT" && action === "cancel" && booking.status === "OPEN") {
    return isStaffOrAbove(actor.role);
  }
  return undefined;
}

/**
 * Get all allowed actions for a booking (checkout or reservation).
 * Use this in list views where allowedActions isn't available from the API.
 */
export function getAllowedBookingActions(
  actor: ActorContext,
  booking: BookingContext,
  kind: BookingKind
): string[] {
  const kindActions = STATE_ACTIONS[kind];
  const stateActions = kindActions?.[booking.status];
  if (!stateActions) return [];

  return Array.from(stateActions).filter((action) => {
    const override = specialCaseOverride(actor, booking, kind, action);
    if (override !== undefined) return override;
    return hasAccess(actor, booking);
  });
}

// ── Convenience wrappers for backwards compatibility ──

export function getAllowedActionsClient(
  actor: ActorContext,
  booking: BookingContext
): CheckoutAction[] {
  return getAllowedBookingActions(actor, booking, "CHECKOUT") as CheckoutAction[];
}

export function getAllowedReservationActionsClient(
  actor: ActorContext,
  booking: BookingContext
): ReservationAction[] {
  return getAllowedBookingActions(actor, booking, "RESERVATION") as ReservationAction[];
}
