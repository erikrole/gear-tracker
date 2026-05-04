# Lighthouse — Open Action Items

Source: Lighthouse 13.2.0 mobile + desktop runs against `/login` (production build, simulated 4G), 2026-05-03.

Scores after fixes shipped in commit `c308774c`:

| Category | Mobile | Desktop |
|---|---|---|
| Performance | 82 | 99 |
| Accessibility | 100 | 100 |
| Best Practices | 100 | 100 |
| SEO | 91 | 91 |

## Open items (not fixed)

### P1 — Mobile LCP 4.9s (perf 82)

- **Audit:** `largest-contentful-paint` (score 45)
- **Cause:** simulated mobile + ~80 KB unused JS in shared chunk `7391-*` (loaded on every route, including unauthenticated `/login`). Login uses very little of it (no AppShell, no Radix sidebar).
- **Fix options:**
  1. Move heavy providers (Sonner toaster, Sidebar context, Radix tooltip provider) inside `(app)/layout.tsx` so auth routes don't ship them.
  2. Dynamic-import `Providers` for non-auth routes only.
  3. Audit `_providers.tsx` for things login doesn't need.
- **Impact:** mobile users on slow networks get login in ~5s instead of ~1.5s. Real users on 5G see <1s either way.
- **Effort:** 1–2h investigation + refactor. Risk of breaking provider order.

### P2 — Streaming meta-description (SEO 91)

- **Audit:** `meta-description` (score 0)
- **Cause:** Next 15 streams metadata via Suspense for async server components. The `<meta name="description">` is in the rendered DOM but not in the initial HTML head. Lighthouse's static check fails it; Googlebot reads the streamed HTML and sees it fine.
- **Fix options:**
  1. Move auth check from `LoginPage()` body to middleware so the page export becomes synchronous → metadata renders in head.
  2. Accept the false positive (real SEO is unaffected; this is an internal tool anyway).
- **Recommendation:** ignore unless we want SEO score = 100 for vanity.

### P2 — Legacy JS polyfills (perf insight, score 50)

- **Audit:** `legacy-javascript-insight`
- **Cause:** Next 15 still ships some ES5-era polyfills for older browsers in the no-module bundle.
- **Fix options:**
  1. Tighten browserslist in `package.json` to drop legacy targets.
- **Impact:** marginal — only affects no-module fallback path.

## Out of scope (not measured)

- **Authed routes** (dashboard, items, scan, etc.) — would need a real session cookie to test. Worth doing in a follow-up CI gate if perf budgets get serious.
- **Bundle composition deep-dive** — `@next/bundle-analyzer` would identify the actual bytes in chunk 7391.
- **Real-device testing** — simulated mobile uses Lighthouse's network/CPU model. Vercel Analytics field data is the source of truth.

## What we shipped (closed)

- `landmark-one-main` → wrapped 5 auth routes in `<main>`. A11y 98 → 100.
- `meta-description` (login) → added page-level metadata export. Login still scores 0 due to streaming, but rendered DOM has it.
- `errors-in-console` → root cause was a missing dev env var (`SESSION_COOKIE_NAME`) during local prod-server testing, not a real bug.
