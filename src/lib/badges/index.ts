import { captureBadgeError } from "@/lib/observability";

import * as evaluator from "./evaluator";
import type { BadgeService } from "./types";

type BadgeEvaluator = (...args: any[]) => Promise<void>;

export function badgesEnabled(): boolean {
  return process.env.BADGES_ENABLED === "true";
}

function safeCall<F extends BadgeEvaluator>(fn: F): F {
  return (async (...args: Parameters<F>) => {
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
  }) as F;
}

export const badges: BadgeService = {
  onCheckoutOpened: safeCall(evaluator.onCheckoutOpened),
  onCheckoutReturned: safeCall(evaluator.onCheckoutReturned),
  onScanResult: safeCall(evaluator.onScanResult),
  onTradeCompleted: safeCall(evaluator.onTradeCompleted),
};

export type {
  BadgeEventSource,
  BadgeScanErrorCode,
  BadgeScanPhase,
  BadgeService,
  CheckoutOpenedBadgeEvent,
  CheckoutReturnedBadgeEvent,
  ScanResultBadgeEvent,
  TradeCompletedBadgeEvent,
} from "./types";
