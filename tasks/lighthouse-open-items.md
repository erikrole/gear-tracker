# Lighthouse — Open Action Items

Source: Lighthouse 13.2.0 mobile + desktop runs against `/login` (production build, simulated 4G).

Latest scores (after `a3eaea8b`):

| Category | Mobile | Desktop |
|---|---|---|
| Performance | 83 | 99 |
| Accessibility | 100 | 100 |
| Best Practices | 100 | 100 |
| SEO | 91 | 91 |

## Open

### P1 — Mobile LCP 4.7s (perf 83)

- **Audit:** `largest-contentful-paint` (score ~45)
- **Cause:** ~81 KB of unused JS on `/login` is overwhelmingly Sentry browser SDK in chunk `7391-*`. Sentry's `withSentryConfig` wraps every route automatically.
- **Fix options (high effort):**
  1. Move Sentry init out of `next.config.ts` `withSentryConfig` and into a dynamic `instrumentation-client.ts` that loads Sentry on `requestIdleCallback` or after first interaction. Sentry has a documented pattern.
  2. Use Sentry's "lazy load" sample at https://docs.sentry.io/platforms/javascript/install/lazy-load-sentry/ — `loader-script` tag instead of bundled SDK.
  3. Disable Sentry on auth routes specifically via Sentry's allow/deny URL list.
- **Impact:** would drop `/login` to ~140 KB first-load, fix mobile LCP.
- **Effort:** 1-2h, real risk of breaking error reporting if mis-configured. Defer until paying off mobile LCP becomes a priority.

### P2 — Streaming meta-description (SEO 91)

- **Audit:** `meta-description` (score 0)
- **Cause:** Next 15 streams metadata via Suspense for async server components. The `<meta name="description">` is in the rendered DOM but not in the initial HTML head. Lighthouse's static check fails it; Googlebot reads the streamed HTML and sees it fine.
- **Recommendation:** ignore — internal tool, real SEO unaffected.

### P2 — Legacy JS polyfills (perf insight, score 50)

- **Audit:** `legacy-javascript-insight`
- **Cause:** Next 15 still ships ES5-era polyfills for older browsers in the no-module bundle.
- **Fix:** tighten browserslist in `package.json` to drop legacy targets.
- **Impact:** marginal — only affects no-module fallback path.

## Closed

| When | What |
|---|---|
| `c308774c` | landmark-one-main, /login meta-description (page-level export) |
| `a3eaea8b` | First Load JS 257 → 221 KB on /login (motion/react split) |
| `a3eaea8b` | best-practices 92 → 100 (CSP `style-src` `'unsafe-inline'` regression fix) |

## Out of scope (not measured)

- **Authed routes** (dashboard, items, scan) — would need a real session cookie to test.
- **Real-device testing** — simulated mobile uses Lighthouse's network/CPU model. Vercel Analytics field data is the source of truth.
