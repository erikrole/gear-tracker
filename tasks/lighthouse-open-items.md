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

### P2 — Streaming meta-description (SEO 91)

- **Audit:** `meta-description` (score 0)
- **Cause:** Next 15 streams metadata via Suspense for async server components. The `<meta name="description">` is in the rendered DOM but not in the initial HTML head. Lighthouse's static check fails it; Googlebot reads the streamed HTML and sees it fine.
- **Recommendation:** ignore — internal tool, real SEO unaffected.

### P2 — Legacy JS polyfills (perf insight, score 50)

- **Audit:** `legacy-javascript-insight`
- **Status:** Closed 2026-07-31. `package.json` now targets the supported modern desktop/tablet browser floor instead of Next's broad Chrome 64/Safari 12 fallback target. The no-module fallback remains intentionally outside the supported production browser set.
- **Impact:** marginal — this only affects the legacy fallback path.

## Closed

| When | What |
|---|---|
| 2026-07-31 | Login Sentry loading moved to a dynamic `instrumentation-client.ts` loader that warms after page load, idle time, interaction, or navigation. The production build's `/login` page chunk set contains no Sentry SDK markers; a fresh Lighthouse LCP score still needs an authenticated-free runtime rerun. |
| 2026-07-31 | Production browserslist tightened to Chrome/Edge/Firefox 111+, Safari/iOS 16.4+, and `not dead`, removing the old browser target that caused the legacy JavaScript insight. |
| `c308774c` | landmark-one-main, /login meta-description (page-level export) |
| `a3eaea8b` | First Load JS 257 → 221 KB on /login (motion/react split) |
| `a3eaea8b` | best-practices 92 → 100 (CSP `style-src` `'unsafe-inline'` regression fix) |

## Out of scope (not measured)

- **Authed routes** (dashboard, items, scan) — would need a real session cookie to test.
- **Real-device testing** — simulated mobile uses Lighthouse's network/CPU model. Vercel Analytics field data is the source of truth.
