import { NextResponse, type NextRequest } from "next/server";

/**
 * Per-request CSP nonce. Mints a fresh nonce on every request, forwards it
 * to the app via the `x-csp-nonce` request header, and writes the
 * Content-Security-Policy response header inline (overriding the static
 * fallback in next.config.ts on every request that hits middleware).
 *
 * Why this matters: with the static CSP we had to allow `'unsafe-inline'`
 * on script-src so the two inline <script> tags in src/app/layout.tsx
 * (theme FOUC, SW registration) would execute. That defeated CSP's main
 * XSS protection. Now those scripts carry the per-request nonce and we
 * use `'strict-dynamic'` so the nonce-trusted bundle can dynamically load
 * its own (Sentry, app code) — without a blanket inline allowance.
 */
export function middleware(request: NextRequest) {
  const nonce = generateNonce();

  // Mirror the static next.config.ts CSP, but swap script-src/style-src
  // to use the nonce + strict-dynamic. Keep all other directives in sync.
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    // style-src: keep 'unsafe-inline' for now. React/Next inline style
    // props and hydration styles need it. Mixing nonce + 'unsafe-inline'
    // makes the browser ignore 'unsafe-inline' per CSP spec, breaking
    // every style={...} on the page. Migrating to nonce-styles is a
    // larger refactor — captured in tasks/security-headers-audit.md.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data: https://*.public.blob.vercel-storage.com",
    "font-src 'self' data:",
    "connect-src 'self' https://*.public.blob.vercel-storage.com https://*.sentry.io https://*.ingest.sentry.io",
    "worker-src 'self'",
    "manifest-src 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'none'",
    "object-src 'none'",
    "upgrade-insecure-requests",
  ].join("; ");

  // Forward the nonce to the app via a request header so RootLayout can
  // read it and stamp it on its inline <script> tags.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-csp-nonce", nonce);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

function generateNonce(): string {
  // 16 bytes -> ~22 chars of base64 — well above the 128-bit floor in
  // the CSP spec for unguessable nonces.
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str);
}

export const config = {
  // Run on every request EXCEPT static asset paths and image optimizer.
  // Excluding these keeps middleware off the hot path for /_next/static
  // bundles and image responses that don't need a per-request CSP.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|Badgers.png|manifest.webmanifest|sw.js).*)",
  ],
};
