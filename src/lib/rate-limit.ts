/**
 * Simple in-memory sliding window rate limiter for serverless.
 * Limits are per-instance (reset on cold start), which is acceptable
 * for Vercel — it prevents rapid brute force within a single instance lifetime.
 * For production at scale, replace with Redis-backed limiter.
 */

type Entry = { count: number; resetAt: number };

const store = new Map<string, Entry>();

// Prune stale entries periodically to prevent memory growth
const PRUNE_INTERVAL = 60_000; // 1 minute
let lastPrune = Date.now();

function prune() {
  const now = Date.now();
  if (now - lastPrune < PRUNE_INTERVAL) return;
  lastPrune = now;
  for (const [key, entry] of store) {
    if (entry.resetAt <= now) store.delete(key);
  }
}

export type RateLimitConfig = {
  /** Maximum requests allowed in the window. */
  max: number;
  /** Window duration in milliseconds. */
  windowMs: number;
};

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
};

/**
 * Check if a request is within rate limits.
 *
 * @param key - Unique identifier (e.g., IP address, "login:192.168.1.1")
 * @param config - Rate limit configuration
 * @returns Whether the request is allowed and remaining quota
 */
export function checkRateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  prune();
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + config.windowMs });
    return { allowed: true, remaining: config.max - 1, resetAt: now + config.windowMs };
  }

  entry.count++;
  if (entry.count > config.max) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  return { allowed: true, remaining: config.max - entry.count, resetAt: entry.resetAt };
}

/**
 * Get the client IP from a request (respects x-forwarded-for for proxied environments).
 */
export function getClientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || req.headers.get("x-real-ip")
    || "unknown";
}

/**
 * Enforce a rate limit on a route handler. Throws HttpError(429) if exceeded.
 *
 * Caller decides the bucket key — usually `${scope}:${user.id}` for user-scoped
 * limits or `${scope}:${ip}` for unauthenticated routes.
 *
 * Lazy import of HttpError to avoid an import cycle.
 */
export async function enforceRateLimit(
  key: string,
  config: RateLimitConfig
): Promise<void> {
  const result = checkRateLimit(key, config);
  if (!result.allowed) {
    const { HttpError } = await import("./http");
    const retryAfterSec = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000));
    throw new HttpError(429, `Too many requests — try again in ${retryAfterSec}s.`);
  }
}

/** Common preset for admin-surface mutation endpoints (settings, etc.). */
export const SETTINGS_MUTATION_LIMIT: RateLimitConfig = {
  max: 60,
  windowMs: 60_000,
};
