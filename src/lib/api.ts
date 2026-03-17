import { NextResponse } from "next/server";
import { requireAuth, type AuthUser } from "@/lib/auth";
import { fail } from "@/lib/http";

type AuthCtx<P extends Record<string, string> = Record<string, string>> = {
  user: AuthUser;
  params: P;
};

type HandlerCtx<P extends Record<string, string> = Record<string, string>> = {
  params: P;
};

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
      const user = await requireAuth();
      const params = (context?.params ? await context.params : {}) as P;
      return await handler(req, { user, params });
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
