# Public Stakeholder Showroom Plan - 2026-07-01

## Goal
- Build a public, unauthenticated `/about` showroom for stakeholders that explains Gear Tracker's product story, features, tech stack, security posture, and field execution model without exposing live operational data.

## Route
- Owner area: Public Showroom
- Ledger: `tasks/public-showroom-plan.md`
- Area doc: `docs/AREA_PUBLIC_SHOWROOM.md`
- Routes: `/about`, `/about/features`, `/about/tech-stack`, `/about/security`, `/about/field-work`

## Source Checks
- `docs/NORTH_STAR.md` defines the product story: reservation-first app/web, kiosk-owned custody, native iOS, web control room, Schedule source of truth, and security/reliability gates.
- `docs/DECISIONS.md` defines D-006, D-007, D-011, D-030, and D-040 as public-safe trust story inputs.
- `docs/DESIGN_LANGUAGE.md` is the internal design baseline. This route is an intentional public marketing exception while keeping shadcn/ui, tokens, accessibility, and no nested interactive controls.
- Relevant area docs checked for product claims: Mobile, Kiosk, Checkouts, Reservations, Items, Shifts, Dashboard, Notifications, Reports, Resources, and Settings.

## Stop Conditions
- Stop if implementation requires a public API, schema change, live data fetch, auth-shell change, or route behavior change for `/` or `/login`.
- Stop if product mockups need real student, booking, inventory, or audit data.
- Stop if public security copy starts exposing sensitive thresholds, endpoint internals, runbooks, or exploit-shaped detail.

## Slices
- [x] Slice 1: Add typed public showroom content, route layout, route pages, and reusable mockup/section components.
- [x] Slice 2: Add public-showroom docs and content source-contract test.
- [x] Slice 3: Run verification and record browser proof.

## Verification
- [x] `npx vitest run tests/public-showroom-content.test.ts`
- [x] `npx tsc --noEmit --pretty false`
- [x] `npm run codemap`
- [x] `npm run verify:docs`
- [x] `git diff --check`
- [x] `npm run build:app`
- [x] Browser smoke `/about`, `/about/features`, `/about/tech-stack`, `/about/security`, `/about/field-work`, `/login`, and `/`.

## Review
- Shipped: Public `/about` showroom route set outside the authenticated app shell, static typed copy, fictional product mockups, public-safe feature/stack/security/field-work pages, shared showroom components, route metadata, public navigation, docs, and content contract tests.
- Verified: Focused content Vitest passed 3 tests. TypeScript passed. `npm run codemap` and `npm run verify:docs` passed. `git diff --check` passed. `npm run build:app` passed and listed all five `/about` routes. Browser smoke passed on desktop and 390 px mobile with no console errors, no horizontal overflow, no `/api` requests from showroom pages, keyboard-reachable nav, normal `/login`, and unauthenticated `/` redirecting to `/login`.
- Deferred: Full `npm run build` was not run because the plan allowed `build:app` unless migration-deploy preflight was approved and available.
- Blocked: None. `npm run build:app` still reports the existing unrelated unused `kind` warnings in `src/lib/booking-status-display.ts`.
- Proof artifacts: Dev server at `http://localhost:3000`; browser proof captured through Chrome DevTools snapshots/evaluations.
- Vercel optimization follow-up: moved the root theme and service-worker boot code out of inline nonce scripts and into same-origin static files, retired the nonce middleware path, and added source-contract coverage that the root shell no longer imports `next/headers`. A non-matching middleware sentinel remains only because deleting the middleware file caused the current Next 15/Sentry build to miss `pages-manifest.json` during page-data collection. This keeps the public showroom route set static-friendly while retaining CSP-compatible startup behavior.
- Next slice or stop: Stop. Public showroom V1 is locally implemented and verified.
