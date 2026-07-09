export type BookingKind = "CHECKOUT" | "RESERVATION";
export type BookingStatus = "DRAFT" | "BOOKED" | "PENDING_PICKUP" | "OPEN" | "COMPLETED" | "CANCELLED";

export type CheckoutAction = "edit" | "extend" | "cancel" | "checkin" | "open" | "force-complete" | "nudge" | "transfer-owner";
export type ReservationAction = "edit" | "extend" | "cancel" | "convert" | "duplicate" | "transfer-owner";
export type BookingAction = CheckoutAction | ReservationAction | "view";

export type BookingContext = {
  kind?: BookingKind;
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

export type ActionCheckResult = {
  allowed: boolean;
  reason?: string;
};

type ActionOptions = {
  includeServerActions?: boolean;
};

const CLIENT_CHECKOUT_ACTIONS: CheckoutAction[] = ["edit", "extend", "cancel", "open", "transfer-owner"];
const SERVER_CHECKOUT_ACTIONS: CheckoutAction[] = ["edit", "extend", "cancel", "checkin", "open", "force-complete", "nudge", "transfer-owner"];
const CLIENT_RESERVATION_ACTIONS: ReservationAction[] = ["edit", "extend", "cancel", "duplicate", "transfer-owner"];
const SERVER_RESERVATION_ACTIONS: ReservationAction[] = ["edit", "extend", "cancel", "convert", "duplicate", "transfer-owner"];

const STATE_ACTIONS: Record<BookingKind, Record<BookingStatus, Set<string>>> = {
  CHECKOUT: {
    DRAFT: new Set(["edit", "cancel", "transfer-owner"]),
    BOOKED: new Set(["edit", "extend", "cancel", "open", "transfer-owner"]),
    PENDING_PICKUP: new Set(["edit", "cancel", "transfer-owner"]),
    OPEN: new Set(["edit", "extend", "cancel", "force-complete", "nudge", "transfer-owner"]),
    COMPLETED: new Set(),
    CANCELLED: new Set(),
  },
  RESERVATION: {
    DRAFT: new Set(["edit", "cancel", "transfer-owner"]),
    BOOKED: new Set(["edit", "extend", "cancel", "duplicate", "transfer-owner"]),
    PENDING_PICKUP: new Set(),
    OPEN: new Set(),
    COMPLETED: new Set(),
    CANCELLED: new Set(),
  },
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

function resolveKind(booking: BookingContext, kind?: BookingKind): BookingKind | null {
  return kind ?? booking.kind ?? null;
}

function allActionsForKind(kind: BookingKind, includeServerActions: boolean) {
  if (kind === "CHECKOUT") {
    return includeServerActions ? SERVER_CHECKOUT_ACTIONS : CLIENT_CHECKOUT_ACTIONS;
  }
  return includeServerActions ? SERVER_RESERVATION_ACTIONS : CLIENT_RESERVATION_ACTIONS;
}

export function canPerformBookingAction(
  actor: ActorContext,
  booking: BookingContext,
  action: string,
  kind?: BookingKind,
): ActionCheckResult {
  if (action === "view") {
    return hasAccess(actor, booking)
      ? { allowed: true }
      : { allowed: false, reason: "You do not have permission to view this booking" };
  }

  const resolvedKind = resolveKind(booking, kind);
  if (!resolvedKind) {
    return { allowed: false, reason: "Unknown booking kind" };
  }

  const stateActions = STATE_ACTIONS[resolvedKind]?.[booking.status as BookingStatus];
  if (!stateActions || !stateActions.has(action)) {
    return {
      allowed: false,
      reason: `Action "${action}" is not available in ${booking.status} state`,
    };
  }

  if (resolvedKind === "CHECKOUT" && action === "cancel" && booking.status === "OPEN") {
    if (!isStaffOrAbove(actor.role)) {
      return {
        allowed: false,
        reason: "Only staff or admin can cancel an active checkout",
      };
    }
    return { allowed: true };
  }

  if (action === "force-complete") {
    return actor.role === "ADMIN"
      ? { allowed: true }
      : { allowed: false, reason: "Only admins can force-complete a checkout" };
  }

  if (action === "nudge") {
    return isStaffOrAbove(actor.role)
      ? { allowed: true }
      : { allowed: false, reason: "Only staff or admin can send nudge notifications" };
  }

  if (action === "transfer-owner") {
    return hasAccess(actor, booking)
      ? { allowed: true }
      : { allowed: false, reason: "You do not have permission to transfer this booking" };
  }

  if (!hasAccess(actor, booking)) {
    return {
      allowed: false,
      reason: "You do not have permission to perform this action",
    };
  }

  return { allowed: true };
}

export function getAllowedBookingActions(
  actor: ActorContext,
  booking: BookingContext,
  kind?: BookingKind,
): string[];
export function getAllowedBookingActions(
  actor: ActorContext,
  booking: BookingContext,
  options?: ActionOptions,
): string[];
export function getAllowedBookingActions(
  actor: ActorContext,
  booking: BookingContext,
  kindOrOptions?: BookingKind | ActionOptions,
): string[] {
  const kind = typeof kindOrOptions === "string" ? kindOrOptions : resolveKind(booking);
  if (!kind) return [];

  const includeServerActions = typeof kindOrOptions === "string"
    ? false
    : kindOrOptions?.includeServerActions ?? true;

  return allActionsForKind(kind, includeServerActions).filter((action) =>
    canPerformBookingAction(actor, booking, action, kind).allowed
  );
}
