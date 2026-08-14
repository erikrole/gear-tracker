import { createHmac } from "node:crypto";
import type { AuthUser } from "@/lib/auth";

export const PRODUCT_EVENT_NAMES = [
  "app_opened",
  "surface_viewed",
  "item_search_started",
  "item_search_result_selected",
  "scanner_opened",
  "scan_lookup_succeeded",
  "scan_lookup_failed",
  "reservation_started",
  "reservation_submitted",
  "reservation_blocked",
  "reservation_abandoned",
  "checkout_started",
  "checkout_completed",
  "return_started",
  "return_completed",
  "schedule_viewed",
  "open_work_viewed",
  "shift_claim_succeeded",
  "trade_completed",
  "notification_opened",
  "notification_destination_reached",
  "recoverable_error_shown",
  "retry_selected",
  "retry_succeeded",
] as const;

export const PRODUCT_EVENT_PLATFORMS = ["web", "ios", "kiosk"] as const;
export const PRODUCT_EVENT_SURFACES = [
  "home", "bookings", "items", "schedule", "reports", "settings",
  "search", "notifications", "users", "resources", "licenses", "kiosk", "other",
] as const;
export const PRODUCT_EVENT_OUTCOMES = ["started", "succeeded", "failed", "cancelled"] as const;
export const PRODUCT_EVENT_DURATION_BUCKETS = ["under_5s", "5_15s", "15_60s", "over_60s"] as const;

function parseEmailList(value: string | undefined): Set<string> {
  return new Set((value ?? "").split(",").map((value) => value.trim().toLowerCase()).filter(Boolean));
}

export function canViewUsageAnalytics(user: Pick<AuthUser, "email">): boolean {
  return parseEmailList(process.env.USAGE_ANALYTICS_OWNER_EMAILS).has(user.email.toLowerCase());
}

function analyticsSecret(): string | null {
  return process.env.USAGE_ANALYTICS_HASH_SECRET ?? process.env.SESSION_SECRET ?? null;
}

export function pseudonymousAnalyticsKey(value: string, occurredAt = new Date()): string | null {
  const secret = analyticsSecret();
  if (!secret) return null;
  const rotation = occurredAt.getUTCFullYear().toString();
  return createHmac("sha256", secret).update(`${rotation}:${value}`).digest("hex");
}
