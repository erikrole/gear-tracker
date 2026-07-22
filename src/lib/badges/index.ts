import { captureBadgeError } from "@/lib/observability";

import * as evaluator from "./evaluator";
import type { BadgeService } from "./types";

export function badgesEnabled(): boolean {
  return process.env.BADGES_ENABLED === "true";
}

function safeCall<Args extends unknown[]>(fn: (...args: Args) => Promise<void>): (...args: Args) => Promise<void> {
  return async (...args: Args) => {
    if (!badgesEnabled()) return;

    try {
      const result = await fn(...args);
      if (result !== undefined) {
        throw new Error(`Badge evaluator ${fn.name} returned a value`);
      }
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        throw error;
      }
      captureBadgeError(error, { evaluator: fn.name });
    }
  };
}

export const badges: BadgeService = {
  onCheckoutOpened: safeCall(evaluator.onCheckoutOpened),
  onCheckoutReturned: safeCall(evaluator.onCheckoutReturned),
  onScanResult: safeCall(evaluator.onScanResult),
  onTradeCompleted: safeCall(evaluator.onTradeCompleted),
  onShiftsWorked: safeCall(evaluator.onShiftsWorked),
};

export type {
  BadgeEventSource,
  BadgeScanErrorCode,
  BadgeScanPhase,
  BadgeService,
  CheckoutOpenedBadgeEvent,
  CheckoutReturnedBadgeEvent,
  ScanResultBadgeEvent,
  ShiftsWorkedBadgeEvent,
  TradeCompletedBadgeEvent,
} from "./types";
