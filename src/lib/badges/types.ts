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

export type BadgeService = {
  onCheckoutOpened(event: CheckoutOpenedBadgeEvent): Promise<void>;
  onCheckoutReturned(event: CheckoutReturnedBadgeEvent): Promise<void>;
  onScanResult(event: ScanResultBadgeEvent): Promise<void>;
  onTradeCompleted(event: TradeCompletedBadgeEvent): Promise<void>;
};
