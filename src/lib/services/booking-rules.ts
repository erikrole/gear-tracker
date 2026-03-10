import { BookingKind, BookingStatus, Role } from "@prisma/client";
import { db } from "@/lib/db";
import { HttpError } from "@/lib/http";
import type { AuthUser } from "@/lib/auth";

/**
 * Unified booking action gating rules (checkouts + reservations).
 *
 * Source of truth: AREA_CHECKOUTS.md, AREA_RESERVATIONS.md, AREA_USERS.md
 *
 * Checkout state × action matrix:
 * | Action   | DRAFT        | BOOKED       | OPEN          | COMPLETED | CANCELLED |
 * |----------|-------------|-------------|---------------|-----------|-----------|
 * | edit     | staff+/owner | staff+/owner | staff+/owner  | ✗         | ✗         |
 * | extend   | ✗            | staff+/owner | staff+/owner  | ✗         | ✗         |
 * | cancel   | staff+/owner | staff+/owner | staff+ only   | ✗         | ✗         |
 * | checkin  | ✗            | ✗            | staff+/owner  | ✗         | ✗         |
 * | open     | ✗            | staff+/owner | ✗             | ✗         | ✗         |
 *
 * Reservation state × action matrix:
 * | Action   | DRAFT        | BOOKED       | COMPLETED | CANCELLED |
 * |----------|-------------|-------------|-----------|-----------|
 * | edit     | staff+/owner | staff+/owner | ✗         | ✗         |
 * | extend   | ✗            | staff+/owner | ✗         | ✗         |
 * | cancel   | staff+/owner | staff+/owner | ✗         | ✗         |
 * | convert  | ✗            | staff+/owner | ✗         | ✗         |
 *
 * "staff+" = ADMIN or STAFF
 * "owner" = STUDENT who is the requester or creator of the booking
 */

export type CheckoutAction = "edit" | "extend" | "cancel" | "checkin" | "open";
export type ReservationAction = "edit" | "extend" | "cancel" | "convert";
export type BookingAction = string;

export type ActionCheckResult = {
  allowed: boolean;
  reason?: string;
};

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

/**
 * State × Action matrix per booking kind.
 */
const STATE_ACTIONS: Record<BookingKind, Record<BookingStatus, Set<string>>> = {
  [BookingKind.CHECKOUT]: {
    [BookingStatus.DRAFT]: new Set(["edit", "cancel"]),
    [BookingStatus.BOOKED]: new Set(["edit", "extend", "cancel", "open"]),
    [BookingStatus.OPEN]: new Set(["edit", "extend", "cancel", "checkin"]),
    [BookingStatus.COMPLETED]: new Set(),
    [BookingStatus.CANCELLED]: new Set(),
  },
  [BookingKind.RESERVATION]: {
    [BookingStatus.DRAFT]: new Set(["edit", "cancel"]),
    [BookingStatus.BOOKED]: new Set(["edit", "extend", "cancel", "convert"]),
    [BookingStatus.OPEN]: new Set(),
    [BookingStatus.COMPLETED]: new Set(),
    [BookingStatus.CANCELLED]: new Set(),
  },
};

const ALL_CHECKOUT_ACTIONS: CheckoutAction[] = ["edit", "extend", "cancel", "checkin", "open"];
const ALL_RESERVATION_ACTIONS: ReservationAction[] = ["edit", "extend", "cancel", "convert"];

/**
 * Check if a specific action is allowed for the given actor and booking.
 */
export function canPerformBookingAction(
  actor: ActorContext,
  booking: BookingContext,
  action: string
): ActionCheckResult {
  const kindActions = STATE_ACTIONS[booking.kind];
  if (!kindActions) {
    return { allowed: false, reason: `Unknown booking kind: ${booking.kind}` };
  }

  const stateActions = kindActions[booking.status];
  if (!stateActions || !stateActions.has(action)) {
    return {
      allowed: false,
      reason: `Action "${action}" is not available in ${booking.status} state`,
    };
  }

  // Special case: cancel on OPEN checkouts requires staff+
  if (booking.kind === BookingKind.CHECKOUT && action === "cancel" && booking.status === BookingStatus.OPEN) {
    if (!isStaffOrAbove(actor.role)) {
      return {
        allowed: false,
        reason: "Only staff or admin can cancel an active checkout",
      };
    }
    return { allowed: true };
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
 * Get all allowed actions for a booking.
 */
export function getAllowedBookingActions(
  actor: ActorContext,
  booking: BookingContext
): string[] {
  const all = booking.kind === BookingKind.CHECKOUT ? ALL_CHECKOUT_ACTIONS : ALL_RESERVATION_ACTIONS;
  return all.filter((action) => canPerformBookingAction(actor, booking, action).allowed);
}

/**
 * Load a booking and enforce that the given action is permitted.
 * Throws HttpError if booking not found or action denied.
 */
export async function requireBookingAction(
  bookingId: string,
  actor: AuthUser,
  action: string,
  expectedKind?: BookingKind
) {
  const booking = await db.booking.findUnique({ where: { id: bookingId } });

  if (!booking) {
    throw new HttpError(404, "Booking not found");
  }

  if (expectedKind && booking.kind !== expectedKind) {
    const label = expectedKind === BookingKind.CHECKOUT ? "Checkout" : "Reservation";
    throw new HttpError(404, `${label} not found`);
  }

  const check = canPerformBookingAction(actor, booking, action);
  if (!check.allowed) {
    throw new HttpError(403, check.reason ?? "Forbidden");
  }

  return booking;
}

// ── Backwards-compatible convenience wrappers ──

/** @deprecated Use canPerformBookingAction instead */
export function canPerformAction(
  actor: ActorContext,
  booking: BookingContext,
  action: CheckoutAction
): ActionCheckResult {
  if (booking.kind !== BookingKind.CHECKOUT) {
    return { allowed: false, reason: "Not a checkout" };
  }
  return canPerformBookingAction(actor, booking, action);
}

/** @deprecated Use canPerformBookingAction instead */
export function canPerformReservationAction(
  actor: ActorContext,
  booking: BookingContext,
  action: ReservationAction
): ActionCheckResult {
  if (booking.kind !== BookingKind.RESERVATION) {
    return { allowed: false, reason: "Not a reservation" };
  }
  return canPerformBookingAction(actor, booking, action);
}

/** @deprecated Use getAllowedBookingActions instead */
export function getAllowedActions(
  actor: ActorContext,
  booking: BookingContext
): CheckoutAction[] {
  return getAllowedBookingActions(actor, booking) as CheckoutAction[];
}

/** @deprecated Use getAllowedBookingActions instead */
export function getAllowedReservationActions(
  actor: ActorContext,
  booking: BookingContext
): ReservationAction[] {
  return getAllowedBookingActions(actor, booking) as ReservationAction[];
}

/** @deprecated Use requireBookingAction instead */
export async function requireCheckoutAction(
  bookingId: string,
  actor: AuthUser,
  action: CheckoutAction
) {
  return requireBookingAction(bookingId, actor, action, BookingKind.CHECKOUT);
}

/** @deprecated Use requireBookingAction instead */
export async function requireReservationAction(
  bookingId: string,
  actor: AuthUser,
  action: ReservationAction
) {
  return requireBookingAction(bookingId, actor, action, BookingKind.RESERVATION);
}
