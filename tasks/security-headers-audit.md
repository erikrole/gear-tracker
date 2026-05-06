# Security Headers Audit — gear-tracker

Date: 2026-05-03 · Reference: Mozilla Observatory, OWASP Secure Headers, securityheaders.com.

## Shipped (commit pending)

- **CSP tightened** — added `form-action 'self'`, `base-uri 'none'`, `object-src 'none'`, `upgrade-insecure-requests`, `worker-src 'self'`, `manifest-src 'self'`. Narrowed `img-src` from `https:` to `'self' blob: data: https://*.public.blob.vercel-storage.com`. Added Vercel Blob to `connect-src` so client uploads work.
- **2026-05-05 adjustment** — `img-src` now allows `https:` again because imported legacy item thumbnails intentionally render as unoptimized external image URLs until the import backfill moves them into Vercel Blob. Script and connect policies remain narrowed.
- **COOP / CORP** — `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Resource-Policy: same-origin`.
- **Permissions-Policy expanded** — explicitly denies USB, Serial, Bluetooth, Payment, sensors, FLoC/Topics, etc.
- **Auth pages `Cache-Control: no-store`** — login/register/forgot-password/reset-password.
- **`ok()` default `Cache-Control: private, no-store`** — defense in depth so authed JSON can't replay from browser cache after logout. `cachedOk()` is the opt-in.

Estimated grade: securityheaders.com **A** (was B), Mozilla Observatory **A** (was B).

## Open — needs follow-up

### P0 — Migrate CSP `script-src` to nonce
Currently still allows `'unsafe-inline'`. Any XSS sink runs attacker JS. Two inline `<script>` blocks in `src/app/layout.tsx:32-41` are the only blockers (theme FOUC fix + service worker registration).

**Plan:**
1. Add `src/middleware.ts` that generates a per-request nonce, sets it on a request header, and writes the CSP response header inline (since middleware can override per-request what `next.config.ts` sets statically).
2. In `src/app/layout.tsx`, read the nonce from request headers and pass `nonce={nonce}` to both `<script>` tags.
3. Replace `script-src 'self' 'unsafe-inline'` with `script-src 'self' 'nonce-{NONCE}' 'strict-dynamic'`.
4. Verify Sentry's bundled scripts still load (they should — `'strict-dynamic'` propagates trust to dynamically-loaded scripts).

After this lands, also drop `'unsafe-inline'` from `style-src` if React/Next inline style usage is gone (probably needs nonce-styles, lower priority).

### P2 — Consider COEP `require-corp`
Skipped today because it requires every cross-origin asset to send CORP, which would break Vercel Blob images and Sentry tunneled requests. Worth revisiting once needed for `SharedArrayBuffer` (rarely needed).

### P2 — `robots.txt` to discourage indexing
Internal tool — if the prod URL ever leaks, you don't want it indexed. Add `src/app/robots.ts` with `User-agent: * / Disallow: /`.

### P2 — `Clear-Site-Data` on logout
Add `Clear-Site-Data: "cache","cookies","storage"` on the logout response so a stolen device can't recover state from the BFCache.

### P2 — Per-route `no-store` on kiosk JSON
Kiosk display might cache stale availability/booking data and mislead operators. Audit `src/app/api/kiosk/**` to confirm none of them call `cachedOk()`.

## Won't do
- Removing `Server: Vercel` / `x-vercel-id` — set by Vercel, not removable at app layer. Not worth pursuing.
