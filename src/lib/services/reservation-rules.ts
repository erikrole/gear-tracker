import { BookingKind, BookingStatus, Role } from "@prisma/client";
import { db } from "@/lib/db";
import { HttpError } from "@/lib/http";
import type { AuthUser } from "@/lib/auth";

/**
 * Reservation action gating rules.
 *
 * Source of truth: BRIEF_RESERVATIONS_V1.md, AREA_RESERVATIONS.md, AREA_USERS.md
 *
 * State × Role × Ownership matrix:
 *
 * | Action       | DRAFT           | BOOKED          | COMPLETED | CANCELLED |
 * |-------------|-----------------|-----------------|-----------|-----------|
 * | edit        | staff+/owner    | staff+/owner    | ✗         | ✗         |
 * | extend      | ✗               | staff+/owner    | ✗         | ✗         |
 * | cancel      | staff+/owner    | staff+/owner    | ✗         | ✗         |
 * | convert     | ✗               | staff+/owner    | ✗         | ✗         |
 *
 * "staff+" = ADMIN or STAFF
 * "owner" = STUDENT who is the requester or creator of the booking
 *
 * Note: Reservations do not have OPEN state — conversion to checkout handles that.
 * The "convert" action creates a new checkout from the reservation.
 */

export type ReservationAction = "edit" | "extend" | "cancel" | "convert";

type BookingContext = {
  kind: BookingKind;
  status: BookingStatus;
  requesterUserId: string;
  createdBy: string;
};

type ActorContext = {
  id: string;
  role: Role;
};

function isStaffOrAbove(role: Role): boolean {
  return role === Role.ADMIN || role === Role.STAFF;
}

function isOwner(actor: ActorContext, booking: BookingContext): boolean {
  return actor.id === booking.requesterUserId || actor.id === booking.createdBy;
}

function hasAccess(actor: ActorContext, booking: BookingContext): boolean {
  return isStaffOrAbove(actor.role) || isOwner(actor, booking);
}

const STATE_ACTIONS: Record<BookingStatus, Set<ReservationAction>> = {
  [BookingStatus.DRAFT]: new Set(["edit", "cancel"]),
  [BookingStatus.BOOKED]: new Set(["edit", "extend", "cancel", "convert"]),
  [BookingStatus.OPEN]: new Set(), // Reservations don't enter OPEN state
  [BookingStatus.COMPLETED]: new Set(),
  [BookingStatus.CANCELLED]: new Set(),
};

export type ActionCheckResult = {
  allowed: boolean;
  reason?: string;
};

/**
 * Check if a specific action is allowed for the given actor and reservation.
 */
export function canPerformReservationAction(
  actor: ActorContext,
  booking: BookingContext,
  action: ReservationAction
): ActionCheckResult {
  if (booking.kind !== BookingKind.RESERVATION) {
    return { allowed: false, reason: "Not a reservation" };
  }

  const stateActions = STATE_ACTIONS[booking.status];
  if (!stateActions || !stateActions.has(action)) {
    return {
      allowed: false,
      reason: `Action "${action}" is not available in ${booking.status} state`,
    };
  }

  if (!hasAccess(actor, booking)) {
    return {
      allowed: false,
      reason: "You do not have permission to perform this action",
    };
  }

  return { allowed: true };
}

/**
 * Get all allowed actions for the given actor and reservation.
 */
export function getAllowedReservationActions(
  actor: ActorContext,
  booking: BookingContext
): ReservationAction[] {
  const all: ReservationAction[] = ["edit", "extend", "cancel", "convert"];
  return all.filter(
    (action) => canPerformReservationAction(actor, booking, action).allowed
  );
}

/**
 * Load a reservation booking and enforce that the given action is permitted.
 * Throws HttpError if booking not found, not a reservation, or action denied.
 */
export async function requireReservationAction(
  bookingId: string,
  actor: AuthUser,
  action: ReservationAction
) {
  const booking = await db.booking.findUnique({ where: { id: bookingId } });

  if (!booking || booking.kind !== BookingKind.RESERVATION) {
    throw new HttpError(404, "Reservation not found");
  }

  const check = canPerformReservationAction(actor, booking, action);
  if (!check.allowed) {
    throw new HttpError(403, check.reason ?? "Forbidden");
  }

  return booking;
}
