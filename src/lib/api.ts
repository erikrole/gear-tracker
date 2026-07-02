import { NextResponse } from "next/server";
import { requireAuth, requireKiosk, type AuthUser, type KioskContext } from "@/lib/auth";
import { env } from "@/lib/env";
import { fail, HttpError } from "@/lib/http";

type AuthCtx<P extends Record<string, string> = Record<string, string>> = {
  user: AuthUser;
  params: P;
};

type HandlerCtx<P extends Record<string, string> = Record<string, string>> = {
  params: P;
};

function assertSameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) {
    throw new HttpError(403, "Origin header required for mutating requests");
  }

  if (!allowedSameOrigins(req).has(origin)) {
    throw new HttpError(403, "Cross-origin request blocked");
  }
}

// Kiosk and user mutations share the same trust model: an Origin header that
// matches the request's own origin or a configured trusted origin.
const assertKioskSameOrigin = assertSameOrigin;

/**
 * Origins accepted for CSRF checks. We trust the request's own origin
 * (`req.url`, which on Vercel is set by the platform, not the client) and an
 * explicit env-configured allowlist. We deliberately do NOT derive an origin
 * from `x-forwarded-host`/`x-forwarded-proto`: behind a misconfigured proxy
 * those are client-controllable and would let an attacker forge an allowed
 * Origin. In development we widen the loopback host to both schemes so Next's
 * internal scheme reporting doesn't reject local browser requests.
 */
function allowedSameOrigins(req: Request): Set<string> {
  const requestUrl = new URL(req.url);
  const origins = new Set<string>([requestUrl.origin]);

  for (const trusted of env.trustedOrigins) {
    origins.add(trusted);
  }

  if (process.env.NODE_ENV !== "production" && isLoopbackHost(requestUrl.hostname)) {
    origins.add(`http://${requestUrl.host}`);
    origins.add(`https://${requestUrl.host}`);
  }

  return origins;
}

function isLoopbackHost(host: string): boolean {
  const hostname = host.replace(/^\[|\]$/g, "");
  return hostname === "localhost" || hostname === "::1" || hostname.startsWith("127.");
}

function isForcePasswordAllowed(req: Request): boolean {
  const pathname = new URL(req.url).pathname;
  return (
    (req.method === "PATCH" && pathname === "/api/profile") ||
    (req.method === "POST" && pathname === "/api/me/change-password") ||
    (req.method === "POST" && pathname === "/api/auth/logout")
  );
}

/**
 * Authenticated API route handler.
 * Wraps try/catch, calls requireAuth(), and resolves dynamic params.
 *
 * For routes with dynamic segments, supply the param shape as a generic:
 *   `withAuth<{ id: string }>(async (req, { user, params }) => { ... })`
 *
 * For routes without dynamic segments, omit the generic:
 *   `withAuth(async (req, { user }) => { ... })`
 */
export function withAuth<P extends Record<string, string> = Record<string, string>>(
  handler: (req: Request, ctx: AuthCtx<P>) => Promise<NextResponse>
) {
  return async (req: Request, context: { params: Promise<P> }): Promise<NextResponse> => {
    try {
      // CSRF: validate Origin header on mutating requests
      if (req.method !== "GET" && req.method !== "HEAD") {
        assertSameOrigin(req);
      }
      const user = await requireAuth();
      if (user.forcePasswordChange && !isForcePasswordAllowed(req)) {
        throw new HttpError(403, "Password change required before continuing");
      }
      const params = (context?.params ? await context.params : {}) as P;
      return await handler(req, { user, params });
    } catch (error) {
      return fail(error);
    }
  };
}

type KioskCtx<P extends Record<string, string> = Record<string, string>> = {
  kiosk: KioskContext;
  params: P;
};

/**
 * Kiosk-authenticated API route handler.
 * Validates kiosk device session cookie (not user session).
 * CSRF origin check included for mutating requests.
 */
export function withKiosk<P extends Record<string, string> = Record<string, string>>(
  handler: (req: Request, ctx: KioskCtx<P>) => Promise<NextResponse>
) {
  return async (req: Request, context: { params: Promise<P> }): Promise<NextResponse> => {
    try {
      // CSRF: require Origin on mutating requests (matches withAuth).
      if (req.method !== "GET" && req.method !== "HEAD") {
        assertKioskSameOrigin(req);
      }
      const kiosk = await requireKiosk();
      const params = (context?.params ? await context.params : {}) as P;
      return await handler(req, { kiosk, params });
    } catch (error) {
      return fail(error);
    }
  };
}

/**
 * Public API route handler (no auth required).
 * Wraps try/catch and resolves dynamic params.
 */
export function withHandler<P extends Record<string, string> = Record<string, string>>(
  handler: (req: Request, ctx: HandlerCtx<P>) => Promise<NextResponse>
) {
  return async (req: Request, context: { params: Promise<P> }): Promise<NextResponse> => {
    try {
      const params = (context?.params ? await context.params : {}) as P;
      return await handler(req, { params });
    } catch (error) {
      return fail(error);
    }
  };
}
