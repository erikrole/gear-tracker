export const ON_TIME_GRACE_MS = 15 * 60 * 1000;

export type BadgeEventSource = "kiosk_checkout" | "kiosk_pickup";

export type BadgeScanPhase = "checkout" | "pickup" | "checkin";

export type BadgeScanErrorCode =
  | "not_found"
  | "not_in_booking"
  | "duplicate"
  | "wrong_status"
  | "wrong_location"
  | "retired"
  | "already_checked_out"
  | "already_returned"
  | "not_checked_out"
  | "quantity_exceeded"
  | "unknown";

export type CheckoutOpenedBadgeEvent = {
  userId: string;
  bookingId: string;
  source: BadgeEventSource;
  sourceKey: string;
};

export type CheckoutReturnedBadgeEvent = {
  userId: string;
  bookingId: string;
  completedAt: Date;
  wasOnTime: boolean;
  sourceKey: string;
};

export type ScanResultBadgeEvent = {
  userId: string;
  bookingId?: string;
  phase: BadgeScanPhase;
  ok: boolean;
  errorCode?: BadgeScanErrorCode;
  sourceKey: string;
};

export type TradeCompletedBadgeEvent = {
  userId: string;
  tradeId: string;
  sourceKey: string;
};

/**
 * A shift someone was assigned to has finished.
 *
 * Unlike the other events there is no request to hang this on -- nothing calls
 * the server when a game ends. It is evaluated nightly from events that have
 * already ended, and carries no `sourceKey` because it needs none: the count is
 * read from the database and awards are idempotent by `(userId, definitionId)`,
 * so re-running it forever is a no-op.
 */
export type ShiftsWorkedBadgeEvent = {
  userId: string;
};

export type BadgeService = {
  onCheckoutOpened(event: CheckoutOpenedBadgeEvent): Promise<void>;
  onCheckoutReturned(event: CheckoutReturnedBadgeEvent): Promise<void>;
  onScanResult(event: ScanResultBadgeEvent): Promise<void>;
  onTradeCompleted(event: TradeCompletedBadgeEvent): Promise<void>;
  onShiftsWorked(event: ShiftsWorkedBadgeEvent): Promise<void>;
};
