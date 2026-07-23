# Accountability Leaderboard Plan - 2026-07-23

## Goal
- Give admins a trustworthy academic-year view of repeated late checkout behavior without weakening the custody ledger.

## Route
- Owner area: Reports and Analytics
- Secondary areas: Users, Bookings, web navigation
- Ledger: `tasks/accountability-leaderboard-plan.md`
- Existing reference: `/reports/overdue` remains the live open-overdue operational queue.

## Source Checks
- `Booking.endsAt` is the due time; `completedAt` records completed checkout return.
- The current overdue report includes only `CHECKOUT` + `OPEN` rows past `endsAt`.
- D-040 requires checkout records to remain the active and historical custody ledger.
- Reports are currently STAFF/ADMIN; this new surface and its API must be ADMIN-only.
- The worktree contains unrelated Schedule, codemap, task-ledger, test, and resource changes that this slice must preserve.

## Stop Conditions
- Stop if completed checkout rows cannot provide a trustworthy completion timestamp.
- Stop if the migration chain is no longer contiguous after `0100`.
- Stop if an exclusion would require deleting or rewriting custody evidence.
- Stop if authenticated browser proof cannot distinguish ADMIN and STAFF sessions; record the blocked proof instead.

## Slices
- [x] Slice 1: Add a reversible, audited booking-accountability exclusion model and ADMIN-only permission.
- [x] Slice 2: Add an accountability service and ADMIN-only API for academic-year summaries, evidence, exclusion, and restoration.
- [x] Slice 3: Add the admin-only sidebar destination and accountability UI with filters, methodology, evidence expansion, and CSV export.
- [x] Slice 4: Add focused schema, service, route, permission, and UI source-contract tests.
- [x] Slice 5: Sync Reports, Risks, codemaps, and closeout evidence.

## Verification
- [x] Focused accountability and adjacent report/search tests: 37 passed
- [x] `npx prisma validate`
- [x] `npm run db:migrate:check`
- [ ] `npx tsc --noEmit --pretty false` - blocked only by pre-existing strictness errors in badge tests; `npm run build:app` type checking passes.
- [x] Focused lint
- [x] `npm run codemap`
- [x] `npm run verify:docs`
- [x] `npm run build:app`
- [x] `npm run build` after migration deploy
- [x] `git diff --check`
- [x] Authenticated ADMIN browser smoke, plus STAFF denial proof - ADMIN navigation, live metrics, configured grace period, ranking, and expanded checkout evidence passed after migration deploy; STAFF denial is covered by route and search tests.

## Review
- Shipped: ADMIN-only accountability ranking, filters, evidence, CSV, reversible exclusions, audit trail, navigation, search discovery, schema migration, and docs.
- Verified: 37 focused/adjacent tests, Prisma validation, 103-migration prefix check, focused lint, app-only and deploy-shaped production builds, codemap/docs, whitespace, authenticated ADMIN live-data proof, and post-deploy Neon health.
- Deferred: Public endpoint and identity policy, timestamp correction, notifications, disciplinary thresholds.
- Blocked: Full standalone TypeScript remains blocked by unrelated badge-test strictness errors.
- Proof artifacts: `0101_accountability_exclusions` applied through the Neon HTTP fallback; migration health reports 103/103 applied with no pending, failed, or DB-only rows. The deploy-shaped build found no pending migrations and compiled all 207 pages. Authenticated browser proof showed one resolved 21-hour late return and expanded booking evidence under the configured 0.5-hour grace period.
- Next slice or stop: Stop. Exclusion mutation behavior is covered by focused route/service tests; no production record was changed for browser proof.
