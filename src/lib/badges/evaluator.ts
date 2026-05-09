import type {
  CheckoutOpenedBadgeEvent,
  CheckoutReturnedBadgeEvent,
  ScanResultBadgeEvent,
  ShiftCompletedBadgeEvent,
  TradeCompletedBadgeEvent,
} from "./types";

export async function onCheckoutOpened(event: CheckoutOpenedBadgeEvent): Promise<void> {
  void event;
}

export async function onCheckoutReturned(event: CheckoutReturnedBadgeEvent): Promise<void> {
  void event;
}

export async function onScanResult(event: ScanResultBadgeEvent): Promise<void> {
  void event;
}

export async function onTradeCompleted(event: TradeCompletedBadgeEvent): Promise<void> {
  void event;
}

export async function onShiftCompleted(event: ShiftCompletedBadgeEvent): Promise<void> {
  void event;
}
