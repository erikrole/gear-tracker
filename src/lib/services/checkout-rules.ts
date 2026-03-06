import { BookingKind, BookingStatus, Role } from "@prisma/client";
import { db } from "@/lib/db";
import { HttpError } from "@/lib/http";
import type { AuthUser } from "@/lib/auth";

/**
 * Checkout action gating rules.
 *
 * Source of truth: BRIEF_CHECKOUT_UX_V2.md, AREA_CHECKOUTS.md, AREA_USERS.md
 *
 * State × Role × Ownership matrix:
 *
 * | Action       | BOOKED          | OPEN            | COMPLETED | CANCELLED |
 * |-------------|-----------------|-----------------|-----------|-----------|
 * | edit        | staff+/owner    | staff+/owner    | ✗         | ✗         |
 * | extend      | staff+/owner    | staff+/owner    | ✗         | ✗         |
 * | cancel      | staff+/owner    | staff+ only     | ✗         | ✗         |
 * | checkin     | ✗               | staff+/owner    | ✗         | ✗         |
 * | open        | staff+/owner    | ✗               | ✗         | ✗         |
 *
 * "staff+" = ADMIN or STAFF
 * "owner" = STUDENT who is the requester or creator of the booking
 */

export type CheckoutAction = "edit" | "extend" | "cancel" | "checkin" | "open";

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

const STATE_ACTIONS: Record<BookingStatus, Set<CheckoutAction>> = {
  [BookingStatus.DRAFT]: new Set(["edit", "cancel"]),
  [BookingStatus.BOOKED]: new Set(["edit", "extend", "cancel", "open"]),
  [BookingStatus.OPEN]: new Set(["edit", "extend", "cancel", "checkin"]),
  [BookingStatus.COMPLETED]: new Set(),
  [BookingStatus.CANCELLED]: new Set(),
};

export type ActionCheckResult = {
  allowed: boolean;
  reason?: string;
};

/**
 * Check if a specific action is allowed for the given actor and booking.
 */
export function canPerformAction(
  actor: ActorContext,
  booking: BookingContext,
  action: CheckoutAction
): ActionCheckResult {
  if (booking.kind !== BookingKind.CHECKOUT) {
    return { allowed: false, reason: "Not a checkout" };
  }

  const stateActions = STATE_ACTIONS[booking.status];
  if (!stateActions || !stateActions.has(action)) {
    return {
      allowed: false,
      reason: `Action "${action}" is not available in ${booking.status} state`,
    };
  }

  // Cancel on OPEN checkouts requires staff+ (students cannot cancel active checkouts)
  if (action === "cancel" && booking.status === BookingStatus.OPEN) {
    if (!isStaffOrAbove(actor.role)) {
      return {
        allowed: false,
        reason: "Only staff or admin can cancel an active checkout",
      };
    }
    return { allowed: true };
  }

  // All other actions: staff+ or owner
  if (!hasAccess(actor, booking)) {
    return {
      allowed: false,
      reason: "You do not have permission to perform this action",
    };
  }

  return { allowed: true };
}

/**
 * Get all allowed actions for the given actor and booking.
 */
/**
 * Get all allowed actions for the given actor and booking.
 */
export function getAllowedActions(
  actor: ActorContext,
  booking: BookingContext
): CheckoutAction[] {
  const all: CheckoutAction[] = ["edit", "extend", "cancel", "checkin", "open"];
  return all.filter((action) => canPerformAction(actor, booking, action).allowed);
}

/**
 * Load a checkout booking and enforce that the given action is permitted.
 * Throws HttpError if booking not found, not a checkout, or action denied.
 */
export async function requireCheckoutAction(
  bookingId: string,
  actor: AuthUser,
  action: CheckoutAction
) {
  const booking = await db.booking.findUnique({ where: { id: bookingId } });

  if (!booking || booking.kind !== BookingKind.CHECKOUT) {
    throw new HttpError(404, "Checkout not found");
  }

  const check = canPerformAction(actor, booking, action);
  if (!check.allowed) {
    throw new HttpError(403, check.reason ?? "Forbidden");
  }

  return booking;
}
