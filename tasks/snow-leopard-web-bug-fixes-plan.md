# Snow Leopard Web Bug Fixes Plan - 2026-07-31

## Goal

- Close the confirmed website-wide release findings from the Snow Leopard audit without weakening collaborator capability boundaries, booking concurrency, draft recovery, or published Schedule privacy.

## Route

- Owner areas: Reservations, Checkouts, Collaborators, Schedule/Shifts, Dashboard, Items.
- Ledger: this plan.
- Audit source: the read-only Snow Leopard website audit from 2026-07-31.

## Source Checks

- `If-Unmodified-Since` is required by `POST /api/bookings/[id]/extend`; the booking list quick action currently omits it.
- Collaborator capabilities are server-authoritative and separate from role and ownership.
- Published Schedule follow is distinct from published Schedule viewing.
- Collaborators must not receive live assignment or unpublished Schedule data.
- `DRAFT` is a valid recovery state but is excluded from the main booking list.
- The existing login Lighthouse note identifies the Sentry browser bundle as the dominant mobile LCP cost.

## Stop Conditions

- Stop if a route's current response contract differs from its client or test assumptions.
- Stop if a capability change would widen a collaborator surface beyond the accepted area contract.
- Stop if shift-calendar authorization cannot distinguish internal users from collaborator tokens.
- Stop if lazy Sentry loading removes error reporting from authenticated application routes.
- Stop if focused tests, TypeScript, lint, migration checks, or the app build fail twice with the same approach.

## Slices

- [x] Slice 1: Repair booking quick-extend optimistic-lock headers and draft filtering.
- [x] Slice 2: Make collaborator booking actions and reservation entry points capability-aware.
- [x] Slice 3: Gate collaborator Schedule follow controls and live shift/calendar routes.
- [x] Slice 4: Harden collaborator reference-data and dashboard-stat boundaries.
- [x] Slice 5: Reduce the login client bundle without removing authenticated error reporting; remove the unused import.
- [x] Slice 6: Add regression coverage, sync area docs and risks, and complete repository verification.

## Verification

- [x] Focused booking, collaborator, Schedule, shift, dashboard, and route-contract tests.
- [x] `npm test -- --reporter=dot`
- [x] `npx tsc --noEmit --pretty false`
- [x] `npm run lint`
- [x] `npm run db:migrate:check`
- [x] `npm run codemap`
- [x] `npm run verify:docs`
- [x] `git diff --check`
- [x] `npm run build:app`
- [x] Production browserslist resolves to the intended modern browser floor.
- [ ] Authenticated browser smoke for collaborator booking, Schedule, and denied routes, or record the credential blocker.
- [ ] Re-run the browser smoke and record whether the login performance issue has runtime proof.

## Review

- Shipped: Source fixes, regression tests, area documentation, risk ledger, and generated codemaps are complete. The login Sentry SDK is dynamically loaded and warmed after page load, idle time, interaction, or navigation; no static SDK markers appear in the generated `/login` page chunk set.
- Verified: 441 test files / 2,832 tests; TypeScript; ESLint; migration-prefix check; codemap check; docs verification; diff check; and `npm run build:app` all pass.
- Deferred: Authenticated production/browser smoke and a fresh Lighthouse/mobile LCP measurement.
- Blocked: No implementation blocker. Live proof still needs collaborator credentials and a reachable authenticated environment.
- Proof artifacts: `tests/snow-leopard-web-bug-fixes.test.ts`, `tests/collaborator-negative-routes.test.ts`, `tests/shift-ics-feed.test.ts`, `docs/AREA_COLLABORATORS.md`, and `docs/GAPS_AND_RISKS.md`.
- Next slice or stop: Stop local implementation here. Run the collaborator smoke and performance measurement once credentials and the target environment are available.
