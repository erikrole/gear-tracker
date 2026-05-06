import { NextResponse } from "next/server";
import { requireAuth, requireKiosk, type AuthUser, type KioskContext } from "@/lib/auth";
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
    const isCronRequest = req.headers.get("authorization")?.startsWith("Bearer ");
    if (!isCronRequest) {
      throw new HttpError(403, "Origin header required for mutating requests");
    }
    return;
  }

  const expected = new URL(req.url).origin;
  if (origin !== expected) {
    throw new HttpError(403, "Cross-origin request blocked");
  }
}

function assertKioskSameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) {
    throw new HttpError(403, "Origin header required for mutating requests");
  }

  const expected = new URL(req.url).origin;
  if (origin !== expected) {
    throw new HttpError(403, "Cross-origin request blocked");
  }
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
