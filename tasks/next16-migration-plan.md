# Next.js 15 → 16 Migration Plan

**Status:** Draft (not started)
**Owner:** TBD
**Target Next version:** 16.2.4 (current latest as of 2026-04-23)
**Current state:** Next 15.5.15, React 19.2.5, Node engine unpinned

## Why now

1. Next 16 is stable (Apr 2026). Next 15 will receive only critical patches.
2. Cache Components (PPR + `use cache`) is the only path forward for sub-100ms TTFB on data-heavy routes like `/dashboard`, `/items`, `/bookings`.
3. React Compiler is stable and free perf with no code changes once enabled.
4. Turbopack is now default for build — webpack path is becoming the legacy escape hatch.

## Migration surface (audit results)

**Low-risk / already done:**
- No `middleware.ts` → no `proxy` rename needed
- No `revalidateTag` / `unstable_cache` / `unstable_cacheTag` calls
- No `next/legacy/image`, no `images.domains`
- No parallel routes (no `@slot/` directories)
- No custom webpack config
- No `serverRuntimeConfig` / `publicRuntimeConfig`
- `params` / `searchParams` are already async-compatible (Next 15 work was done)

**Touch points:**
- `next.config.ts` is wrapped in `withSentryConfig` (`@sentry/nextjs` ^10.50). Confirm Sentry v10 supports Next 16 before bumping.
- `experimental.optimizePackageImports` — verify still supported in 16.
- `next lint` removed → migrate to ESLint CLI (codemod available).
- Bundle analyzer plugin (`@next/bundle-analyzer` ^16.2.4) — already on 16-compatible.
- Headers config in `next.config.ts` — should carry over unchanged.
- 50+ GET route handlers all use `withAuth` (cookies). With Cache Components enabled, GET handlers follow the prerender model — this is the biggest source of risk.

**Unknown — needs investigation in Slice 1:**
- Whether `@sentry/nextjs` ^10 supports Next 16. If not, this entire migration blocks until Sentry ships a compatible release.
- Whether `withAuth` reads cookies eagerly at module scope vs. per-request (matters for Cache Components).

## Sliced execution (one PR per slice)

### Slice 1 — Compatibility check & Node pin (½ day)
Goal: prove the upgrade is mechanically possible before touching code.
- Pin `engines.node` to `>=20.9.0` in `package.json` (Vercel default is fine; this just enforces it).
- Verify `@sentry/nextjs` ^10 changelog / GitHub issues for Next 16 support. If unsupported, **stop here** and file an upstream tracking ticket.
- Read Sentry's Next 16 migration notes if any.
- Output: yes/no decision recorded in this file. No code changes ship if "no".

### Slice 2 — Codemod + version bump (½ day)
- Run `pnpm dlx @next/codemod@canary upgrade latest` (or npx equivalent — this repo uses npm).
- Bump `next`, `react`, `react-dom`, `@types/react`, `@types/react-dom` to latest.
- Run `npx @next/codemod@canary next-lint-to-eslint-cli .` to migrate lint command.
- Update `package.json` scripts: `lint` → `eslint .` (or whatever the codemod produces).
- `npm run build` must pass. If it doesn't, the codemod left work behind — fix and document each manual change in the commit message.
- **Do not enable `cacheComponents` yet.** This slice ships Next 16 with PPR off and behavior identical to Next 15.

### Slice 3 — Turbopack build verification (¼ day)
- Next 16 builds with Turbopack by default. `npm run build` already exercised this in Slice 2.
- Run `npm run dev` and walk through every top-level surface:
  - Login → dashboard
  - Booking wizard end-to-end (draft → checkout)
  - Kiosk pickup + checkin flows
  - Settings (all tabs)
  - Reports (all subroutes)
  - Calendar sources sync
- Check Sentry for any new error patterns post-deploy (deploy to a Vercel preview, not prod).
- Document any Turbopack-specific issues. If serious, opt out with `next build --webpack` and file an issue.

### Slice 4 — React Compiler enable (¼ day)
- Add `babel-plugin-react-compiler` as a devDependency.
- Set `reactCompiler: true` in `next.config.ts`.
- `npm run build` and walk surfaces again — compiler can produce subtle render differences.
- Watch bundle size in `npm run analyze` — compiler may add small runtime cost.
- Roll back if any surface regresses.

### Slice 5 — Cache Components opt-in (1–2 days, the real work)
This is the slice that requires real care. **Do not bundle with anything else.**

- Enable `cacheComponents: true` in `next.config.ts`.
- The build will fail loudly on every page that reads `cookies()` / `headers()` / dynamic `params` without `<Suspense>`. That's the design.
- For each failure:
  1. Identify whether the page has a cacheable shell (header/nav/static content).
  2. Wrap the dynamic part in `<Suspense fallback={...}>`.
  3. If the entire page is request-bound, accept that and move on.
- For the `/dashboard` route specifically:
  - The static shell (header, nav, layout) prerenders.
  - The user-specific cards stream via Suspense.
  - Cached aggregate counts (e.g. `totalCheckedOut` org-wide) can use `'use cache'` + `cacheTag('bookings')` and be invalidated from booking server actions via `updateTag('bookings')`.
- For GET API routes with `withAuth`: most should remain dynamic (auth-gated). Confirm none accidentally start prerendering with stale data.
- Acceptance: every existing route either renders correctly with new caching semantics OR is explicitly marked dynamic with no behavior change.

### Slice 6 — Targeted `use cache` adoption (ongoing, not in initial migration)
After the migration is stable in prod for 1+ week, identify specific routes where `'use cache'` would meaningfully cut TTFB:
- `/items` list (cached by user role + filters; `cacheTag('items')`)
- `/calendar` events list (cached by date range; `cacheTag('calendar')`)
- `/reports/*` aggregations (cached for 1h via `cacheLife('hours')`)
- Settings reference data (categories, sports, locations — `cacheLife('days')`)

Each surface gets its own micro-PR. Wire `updateTag(...)` into the corresponding mutation server actions.

## Hard rollback plan

- Each slice is a separate commit on `main` (per project Thin Slice Protocol).
- Rollback = revert the offending slice commit. No DB schema changes anywhere in this migration, so revert is safe.
- Slice 5 (Cache Components) is the only slice where rollback might leave behind already-added `<Suspense>` boundaries. Those are harmless — leave them in.

## Out of scope

- Vercel runtime cache adoption (separate plan after Cache Components is stable).
- Edge runtime migration — the project intentionally runs Node-only per CLAUDE.md (Vercel deployment constraints).
- Routing middleware — none exists today.

## Open questions

1. Sentry v10 + Next 16 — answer in Slice 1.
2. Should we enable `experimental.turbopackFileSystemCacheForDev` for faster local restarts? (Beta — defer to post-migration.)
3. Should we adopt the `next-devtools-mcp` server for AI-assisted future migrations? (Not blocking.)
