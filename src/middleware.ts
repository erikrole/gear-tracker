import { NextResponse } from "next/server";

export function middleware() {
  return NextResponse.next();
}

export const config = {
  // Build sentinel only. Runtime CSP is served from next.config.ts, and the
  // root layout uses same-origin static boot scripts instead of per-request
  // nonce headers.
  matcher: ["/__next-build-sentinel/:path*"],
};
