/**
 * Client-side error classification for fetch responses.
 *
 * Provides a consistent pattern for categorizing errors across all pages:
 * - "auth"    → 401 response, session expired
 * - "network" → TypeError from fetch (offline / DNS / CORS)
 * - "server"  → Non-ok response or unexpected exception
 */

export type FetchErrorKind = "auth" | "network" | "server";

/**
 * Classify a caught error into a FetchErrorKind.
 *
 * Usage in catch blocks:
 * ```ts
 * } catch (err) {
 *   if (isAbortError(err)) return;
 *   setError(classifyError(err));
 * }
 * ```
 */
export function classifyError(err: unknown): FetchErrorKind {
  // Network failures (offline, DNS, CORS) throw TypeError
  if (err instanceof TypeError) return "network";
  return "server";
}

/** Returns true if the error is an AbortController abort — should be silently ignored. */
export function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}

/**
 * Check a fetch Response for auth failure. Returns true if 401 and redirects to login.
 * Call this before checking `res.ok`.
 */
export function handleAuthRedirect(res: Response, returnTo?: string): boolean {
  if (res.status === 401) {
    const path = returnTo ? `/login?returnTo=${encodeURIComponent(returnTo)}` : "/login";
    window.location.href = path;
    return true;
  }
  return false;
}

/** User-facing error messages by kind. */
export const ERROR_MESSAGES: Record<FetchErrorKind, { title: string; description: string }> = {
  auth: {
    title: "Session expired",
    description: "Please log in again to continue.",
  },
  network: {
    title: "You\u2019re offline",
    description: "Check your connection and try again.",
  },
  server: {
    title: "Something went wrong",
    description: "This is usually temporary. Please try again.",
  },
};
