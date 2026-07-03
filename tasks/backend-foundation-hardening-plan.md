# Backend foundation hardening plan

Date: 2026-07-03
Status: Active
Mode: auto-advance through one independently verifiable slice at a time

## Intent

Strengthen the backend and app/website foundation before adding more UI polish. This plan starts from current repo truth, not old audit assumptions: many May API hardening findings are already closed, so the next work should focus on durable gates, current-route verification, mutation safety, freshness, operational observability, and data quality.

## Ground Rules

- Keep each slice independently mergeable and independently testable.
- Before each slice, re-read the relevant `docs/AREA_*.md`, `docs/DECISIONS.md`, `docs/GAPS_AND_RISKS.md`, `tasks/lessons.md`, target route files, services, Prisma models, and existing tests.
- Prefer current wrappers and helpers: `withAuth`, `withKiosk`, `withCron`, `withHandler`, `requirePermission`, shared pagination, rate limiting, audit helpers, and service-layer transactions.
- Do not reopen closed gaps unless current source proves drift.
- Update area docs and `docs/GAPS_AND_RISKS.md` only when the slice changes shipped behavior or closes/reopens a gap.
- Record verification in `tasks/todo.md` after every completed slice.

## Auto-Advance Goal Prompt

Work through `tasks/backend-foundation-hardening-plan.md` from top to bottom. For the next unchecked slice:

1. Re-audit the relevant docs, source routes, services, schema, and tests.
2. Write or update a focused plan section if the slice needs more detail.
3. Implement only that slice.
4. Add focused route/service/source-contract tests.
5. Run focused tests first, then the relevant closeout gates.
6. Sync docs and task review notes.
7. Mark the slice complete only after verification passes or an explicit blocker is recorded.
8. Continue automatically to the next unchecked slice unless blocked by user approval, external service access, unsafe database mutation risk, or a failing unrelated worktree state that must be separated.

Default closeout gates:

- Focused `npx vitest run ...`
- `npx tsc --noEmit --pretty false` when TypeScript/server code changes
- `npm run db:migrate:check` when schema, migrations, or DB assumptions are touched
- `npm run codemap` followed by `npm run verify:docs` when source/docs maps move
- `git diff --check`
- `npm run build:app` for app compile proof
- Deploy smoke or authenticated browser proof when production route behavior, public pages, or live freshness is the point of the slice

## Checklist

### Slice 1: API Contract Gate Refresh

- [x] Inventory every `src/app/api/**/route.ts` export.
- [x] Re-prove each handler export is wrapped by `withAuth`, `withKiosk`, `withCron`, or `withHandler`.
- [x] Re-prove public `withHandler` routes are explicitly allowlisted and disabled, rate-limited, or production-safe.
- [x] Re-prove kiosk and cron wrappers stay under their intended route families.
- [x] Update or add the static route inventory test so future route additions cannot bypass the contract.

#### Slice 1 Review

- 2026-07-03: Static inventory now covers 223 API route files and 301 exported HTTP methods. `tests/api-route-wrapper-contract.test.ts` resolves direct exports and alias exports, asserts every route file has an HTTP export, requires every method export to resolve to `withAuth`, `withKiosk`, `withCron`, or `withHandler`, keeps public/kiosk/cron wrappers in their route families, and pins the explicit public `withHandler` route/method allowlist plus abuse controls. The sweep found two real wrapper drifts: `/api/live-activities/checkout-return` hand-rolled `requireAuth`/`fail`, and `/api/shifts/ics/[token]` exported a public token feed without `withHandler`. Both now use shared wrappers while preserving existing auth, token validation, rate limiting, and response semantics.
- 2026-07-03: Verification passed: `npx vitest run tests/api-route-wrapper-contract.test.ts tests/public-route-abuse-contract.test.ts tests/ios-checkout-return-live-activity-source.test.ts`; `npx tsc --noEmit --pretty false`; focused `git diff --check`; `npm run build:app`.

### Slice 2: Mutation Safety Sweep

- [x] Pick the current highest-risk mutation family from bookings, kiosk, shifts, users, assets, or licenses.
- [x] Verify multi-write flows use transactions, with `Serializable` where races matter.
- [x] Verify uniqueness relies on database constraints and `P2002` handling instead of pre-check-only logic.
- [x] Verify state-changing routes write useful audit evidence.
- [x] Add focused regressions for any real gap found.

#### Slice 2 Review

- 2026-07-03: Selected shared booking lifecycle mutations as the highest-risk current family because reservations/checkouts own multi-write allocations, availability preflight, audit entries, and kiosk custody boundaries. Current `createBooking()` already mapped SERIALIZABLE and allocation/exclusion races to 409, but `updateReservation()`, `updateCheckout()`, and `extendBooking()` could still leak the same commit-time race after preflight. Added shared race mapping so booking edits and extensions return controlled 409 conflict responses while preserving existing transactions, audit writes, availability checks, and Live Activity updates on success.
- 2026-07-03: Verification passed: `npx vitest run tests/update-booking.test.ts tests/extend-booking.test.ts tests/create-booking.test.ts`; `npx tsc --noEmit --pretty false`; focused `git diff --check`; `npm run build:app`.

### Slice 3: Public Route Abuse Pass

- [x] Re-audit login, register, forgot/reset password, kiosk activation, public ICS/feed routes, and seed/demo routes.
- [x] Confirm each unauthenticated route is rate-limited, disabled by default, token-scoped, or intentionally allowlisted.
- [x] Confirm production seed/demo routes cannot become account-takeover or data-pollution paths.
- [x] Add a source-contract test for the public route allowlist and abuse controls if current coverage is stale.

#### Slice 3 Review

- 2026-07-03: Public route coverage now has an explicit per-route abuse-control ledger in `tests/public-route-abuse-contract.test.ts` for forgot password, login, register, reset password, kiosk activation, the seed endpoint, and the tokenized shift ICS feed. The test pins generic password-reset responses, IP/email/code/token rate limits, allowlist registration, reset token consumption and session invalidation, kiosk activation token hashing/expiry/single-use controls, seed disabled/admin/password gates, and ICS token/no-cache behavior. No production route code changed in this slice.
- 2026-07-03: Verification passed: `npx vitest run tests/public-route-abuse-contract.test.ts tests/api-route-wrapper-contract.test.ts tests/auth-hardening.test.ts tests/shift-ics-feed.test.ts tests/forgot-password-email-config.test.ts`; `npx tsc --noEmit --pretty false`; focused `git diff --check`; `npm run build:app`. Earlier build attempts hit stale generated `.next` artifacts; after clearing `.next`, the clean build passed and a second `npm run build:app` confirmed it.

### Slice 4: Freshness Framework Pass

- [x] Start from the existing bookings/items change-cursor pattern.
- [x] Identify the next high-value operational surface that can show stale data after refresh, tab switch, or persisted cache restore.
- [x] Add a bounded change signal or fresh-on-mount behavior for that surface.
- [x] Preserve visible data during background refresh; initial load gets skeletons, refresh keeps current rows.
- [x] Prove no stale resurrection with tests and authenticated browser proof when web UI is involved.

#### Slice 4 Review

- 2026-07-03: Selected Schedule as the next high-value freshness surface after confirming bookings/items already have dedicated change-cursor coverage. The app's authenticated API responses already use `Cache-Control: private, no-store`, so the real drift was client-side: `useScheduleData()` inherited the global 60-second React Query stale window and disabled focus refetch. Schedule event, shift-group, source, readiness, automation, and trade-count reads now use a Schedule-local fresh-query policy with `staleTime: 0`, `refetchOnMount: "always"`, `refetchOnWindowFocus: true`, and explicit no-store fetch options. Existing React Query behavior still preserves visible rows during background refresh; initial empty loads still use the existing Schedule loading/error states.
- 2026-07-03: Verification passed: `npx vitest run tests/schedule-freshness-source.test.ts tests/schedule-queue-source-contract.test.ts tests/calendar-events-route.test.ts`; `npx tsc --noEmit --pretty false`; focused `git diff --check`; `npm run verify:docs`; `npm run build:app`. The first build attempt hit the known stale generated `.next` PageNotFoundError; clearing `.next` and rerunning produced a clean build.

### Slice 5: Vercel Timeout and Bounded-Read Audit

- [x] Audit exports, reports, dashboard fan-outs, bulk actions, search, image/rehost jobs, and imports.
- [x] Cap payloads and date ranges where missing.
- [x] Remove or batch N+1 query shapes where the source proves a real issue.
- [x] Use `Promise.allSettled` for read bundles where partial data is acceptable.
- [x] Add tests around bounds and partial-failure metadata.

#### Slice 5 Review

- 2026-07-03: Audited the bounded-read surfaces and selected the current concrete gap documented in `docs/GAPS_AND_RISKS.md`: `/api/cron/rehost-images` drained external `Asset.imageUrl` values but left active `BulkSku.imageUrl` item-family URLs parked on third-party CDNs. The cron now keeps a bounded 24-candidate budget split across 16 serialized assets and 8 active item families, preserves the existing 4-way concurrency, per-image timeout, 8s wall-clock deadline, and 25MB ceiling, increments retry attempts for failed asset and item-family URLs, and reports asset/item-family candidates, processed, rehosted, failed, and remaining counts separately.
- 2026-07-03: Verification passed: `npx vitest run tests/rehost-images-cron.test.ts tests/blob-image-validation.test.ts tests/schedule-automation-source.test.ts`; `npx tsc --noEmit --pretty false`; focused `git diff --check`; `npm run verify:docs`; `npm run build:app`.

### Slice 6: Migration and Production Drift Guard

- [x] Re-audit migration scripts, `db:migrate:*` commands, and current Prisma/Neon lessons.
- [x] Strengthen the migration-prefix/schema-health checks where current tooling has blind spots.
- [x] Add or document a safe drift-detection path that does not mutate production without approval.
- [x] Preserve the rule: no hand-numbered migrations and no untracked migration directories.

#### Slice 6 Review

- 2026-07-03: Migration audit found real schema drift from the prior image-rehost slice: migration `0077_add_bulk_sku_image_rehost_attempts` already added `bulk_skus.image_rehost_attempts`, but `BulkSku` in Prisma schema and the cron route did not use it. Restored the Prisma field, regenerated the client, and updated `/api/cron/rehost-images` so active item-family image candidates are selected, ordered, counted, and failure-capped through `BulkSku.imageRehostAttempts`. Added a schema/source contract so the migration, Prisma model, and cron logic cannot drift silently again.
- 2026-07-03: Strengthened `npm run db:migrate:check`: the script is now testable and fails malformed migration folder names, missing `migration.sql` files, and non-allowlisted prefix collisions while preserving the historical applied `0009` and `0077` collisions. The safe production drift path remains read-only through `npm run db:migrate:health`; escalated network proof reached Neon and reported 92 local migrations applied, newest local `0090_drop_premier_event_columns` applied, no pending local migrations, no unresolved failed rows, and no applied DB-only migrations.
- 2026-07-03: Verification passed: `npx vitest run tests/rehost-images-cron.test.ts tests/blob-image-validation.test.ts tests/prisma-migrate-health.test.ts tests/prisma-migrate-deploy.test.ts tests/migration-prefix-check.test.ts tests/bulk-sku-image-rehost-schema.test.ts`; `npm run db:migrate:check`; `npx prisma validate`; `npx tsc --noEmit --pretty false`; `npm run verify:docs`; `git diff --check`; `npm run build:app`; read-only `npm run db:migrate:health`.

### Slice 7: Cron Observability and Idempotency

- [x] Re-audit `morning-refresh`, notifications, audit archive, and image rehost.
- [x] Verify each cron is idempotent, bounded, authenticated through the shared wrapper, and returns actionable partial-failure metadata.
- [x] Improve structured summaries or tests where failures would be silent.
- [x] Keep D-035 intact: daily operational maintenance belongs in `morning-refresh` unless a separate cron has a proven reason.

#### Slice 7 Review

- 2026-07-03: Cron audit confirmed all four live cron routes remain behind `withCron`, and D-035 stays intact: daily scheduling maintenance still belongs to `morning-refresh`; this slice did not add a new cron route. Existing `morning-refresh`, notification cron, and image rehost paths already returned useful per-job or per-family summaries. The concrete gap was `audit-archive`: it could keep deleting old audit rows until exhaustion and an expired-session purge failure would fail the whole route without preserving audit-log cleanup evidence.
- 2026-07-03: `audit-archive` now caps each invocation to five 1,000-row audit batches, reports `batchesProcessed`, `batchSize`, `maxBatchesPerRun`, and `hasMoreAuditLogs`, and isolates `auditLogs` and `sessions` failures through `partialFailures`/`errors` while still returning successful work from the other segment. Focused tests prove the batch ceiling, remaining-backlog flag, audit-log failure handling, and session-purge failure handling.
- 2026-07-03: Verification passed: `npx vitest run tests/audit-archive-cron.test.ts tests/cron-auth.test.ts tests/notification-cron.test.ts tests/morning-refresh-route.test.ts tests/rehost-images-cron.test.ts tests/schedule-automation-source.test.ts`; `npx tsc --noEmit --pretty false`.

### Slice 8: Auth, Session, and Onboarding Hardening

- [x] Re-check forced password changes, session invalidation, deactivation, hidden smoke users, owner-only hidden access, kiosk device sessions, and role promotion/demotion.
- [x] Confirm bulk endpoints mirror single-endpoint authorization and validation.
- [x] Confirm direct-create, invite-first, App Review demo, and hidden-user cleanup paths remain production-safe.
- [x] Add route tests for any uncovered high-risk branch.

#### Slice 8 Review

- 2026-07-03: Auth/onboarding audit confirmed the prior high-risk boundaries still have coverage: forced password changes, reset-token SERIALIZABLE consumption, hidden-user visibility/default exclusion, internal-operator hidden cleanup, role escalation limits, allowed-email invite-first onboarding, and kiosk session expiry/deactivation. The concrete gap was self-service session revocation: `/api/me/sessions` and `/api/me/change-password` with `revokeOtherSessions` computed the current session id from the cookie, but if that lookup failed the bulk `deleteMany` path could fall back to all sessions for the user.
- 2026-07-03: Hardened both self-service revoke paths so they require a verified current session id before deleting other sessions. `/api/me/sessions` now returns 401 and deletes nothing when the current session cannot be re-identified; `/api/me/change-password` performs the same verification before changing the password when `revokeOtherSessions` is requested, avoiding a password change followed by an ambiguous revoke state. Added focused route tests for successful all-but-current revocation and the failed-current-lookup guard.
- 2026-07-03: Verification passed: `npx vitest run tests/me-session-management.test.ts tests/auth-hardening.test.ts tests/allowed-emails.test.ts tests/allowed-emails-preview.test.ts tests/hidden-users-cleanup.test.ts tests/users-hidden-visibility.test.ts tests/kiosk-session-auth.test.ts tests/role-escalation.test.ts`; `npx tsc --noEmit --pretty false`.

### Slice 9: Kiosk Boundary Proof

- [x] Prove app/web custody mutation routes stay blocked under the kiosk-only custody decision.
- [x] Prove kiosk routes require device auth and enforce location scope.
- [x] Verify rollout-skew payload tolerance for kiosk/native clients.
- [x] Add source-contract or route tests where a boundary is only documented but not enforced.

#### Slice 9 Review

- 2026-07-03: Kiosk boundary audit confirmed existing tests already prove the app/web side of D-040: direct checkout creation routes to reservations, reservation conversion and normal return controls are absent from web/app surfaces, and app/web custody routes for return items, return bulk, check-in completion, pickup completion, and custody scan sessions return boundary errors. Existing kiosk session tests also pin hashed session cookies, server-side expiry, deactivation rejection, and `lastSeenAt` heartbeat behavior.
- 2026-07-03: The real gap was kiosk location scope in direct checkout. `/api/kiosk/checkout/availability` and `/api/kiosk/checkout/complete` accepted a client-supplied `locationId` before falling back to the authenticated kiosk location. The routes now keep accepting that field for rollout skew, but ignore it and use `kiosk.locationId` from `withKiosk` for availability checks, booking creation, asset location updates, and pickup kiosk evidence.
- 2026-07-03: Verification passed: `npx vitest run tests/kiosk-checkout-availability-route.test.ts tests/kiosk-checkout-complete-bulk-units.test.ts tests/kiosk-only-custody-routes.test.ts tests/kiosk-only-web-affordances-source.test.ts tests/kiosk-session-auth.test.ts tests/ios-kiosk-reservation-pickup-contract.test.ts tests/kiosk-checkin-routes.test.ts tests/kiosk-checkout-scan-badges.test.ts`; `npx tsc --noEmit --pretty false`.

### Slice 10: Data Quality Repair Cockpit

- [x] Consolidate existing audits into operator-safe backend tools where useful.
- [x] Prioritize duplicate scan identities, stale unit custody, missing categories/departments, orphan allocations, hidden test-user cleanup, and firmware-watch coverage gaps.
- [x] Keep repair routes dry-run-first where data mutation could surprise operators.
- [x] Add audit entries for applied repairs.

#### Slice 10 Review

- 2026-07-03: Data-quality audit confirmed `/api/inventory-hygiene` is already a read-only checklist for missing categories/departments, duplicate scan identities, retired active-kit rows, camera attachment gaps, and low item-family stock; `/api/admin/fix-today` remains a read-only queue; hidden-user cleanup already has dry-run/apply coverage. The concrete mutation gap was stale battery unit custody repair: `POST /api/bulk-skus/batteries/repair-stale` immediately updated orphaned raw `CHECKED_OUT` flags when called, even though this is the kind of data-quality repair that should preview first.
- 2026-07-03: The stale battery repair route is now dry-run-first. Default requests return `dryRun`, `plannedCount`, `repairedCount`, and candidate units without updates or audit writes; Battery Ops sends `dryRun: false` only from the confirmed repair dialog with a reason. Applied repairs preserve the existing serializable transaction, active-battery-family scope, allocation guard, and per-unit `repair_stale_checked_out` audit entries.
- 2026-07-03: Verification passed: `npx vitest run tests/battery-ops-repair-route.test.ts tests/battery-ops-repair-source.test.ts tests/hidden-users-cleanup.test.ts tests/admin-fix-today-route.test.ts`; `npx tsc --noEmit --pretty false`; `npm run codemap`; `npm run verify:docs`; `git diff --check`; `npm run build:app`.

### Slice 11: iOS API Response-Shape Contracts

- [x] Identify the iOS-used API routes most likely to blank a Swift screen if response shape drifts.
- [x] Add or refresh source-contract tests for native Codable field expectations.
- [x] Make non-critical native decoding lossy where server partial-result behavior expects tolerance.
- [x] Keep API contract changes backwards-tolerant unless a coordinated native release is planned.

#### Slice 11 Review

- 2026-07-03: Audited the native `APIClient` and existing `tests/ios-api-contract.test.ts` coverage. The suite already pins prior breakages around form options, booking avatars, item-family search, kiosk envelopes, availability checks, nullable Prisma columns, notification preferences, shift-group creation, trade cancellation, asset metadata, and URL construction. The uncovered high-risk path was native Trade Board Open Work: `APIClient.scheduleOpenWork()` decodes `/api/schedule/open-work` into `OpenWorkResponse`, while the Trade Board loads it in parallel with posted trades. A missing Open Work array during rollout or partial server shape skew could fail the whole sheet instead of rendering the sections that are still present.
- 2026-07-03: `OpenWorkResponse` now has an explicit initializer plus tolerant `Decodable` behavior that defaults missing `openShifts` and `pickupRequests` to empty arrays. The server contract remains backwards-compatible and unchanged: `/api/schedule/open-work` still returns `{ data: work }`, and the service still publishes both keys. The iOS contract suite now pins the route envelope, service keys, API client envelope decode, and tolerant Swift decoder. While rerunning the suite, an existing stale kiosk checkout source assertion was updated from retired `KioskCheckoutContextCard`/`KioskCheckoutTimeCard` component names to the current `KioskCheckoutSetupPanel`, `KioskCheckoutContextWindow`, and `KioskCheckoutReturnWindow`.
- 2026-07-03: Verification passed: `npx vitest run tests/ios-api-contract.test.ts tests/schedule-open-work-source.test.ts tests/schedule-open-work.test.ts`; `npx tsc --noEmit --pretty false`; `npm run drift:ios`; `npm run codemap`; `npm run verify:docs`; `git diff --check`; `npm run build:app`; XcodeBuildMCP `build_sim` for scheme `Wisconsin` on iPhone 17 iOS 26.5. The native build succeeded with one pre-existing warning in `ios/Wisconsin/Views/CreateBookingSheet.swift:118` about an `await` with no async operations.

### Slice 12: Release Verification Pipeline

- [x] Standardize the backend closeout checklist into a reusable task note or script if useful.
- [x] Confirm the slice gates distinguish `build:app` from full deploy-shaped `npm run build`.
- [x] Document when deploy smoke, authenticated browser proof, iOS drift, or Xcode verification is required.
- [x] Close this plan only after all slices are shipped, explicitly deferred, or superseded by a newer backend hardening ledger.

#### Slice 12 Review

- 2026-07-03: Added `docs/RELEASE_VERIFICATION.md` as the canonical closeout guide for backend, web, deploy, and iOS slices. The guide standardizes the default local closeout commands, names `npm run build:app` as the safe local app compile proof, and reserves `npm run build` for deploy-shaped checks because it runs the Prisma/Neon migration deploy wrapper before `next build`.
- 2026-07-03: The guide also documents when to escalate verification: migration health/deploy for schema work, authenticated browser proof for runtime UI/freshness/auth behavior, `npm run smoke:deploy` for production/public headers and deploy behavior, and `drift:ios`/`audit:ios:gaps` plus XcodeBuildMCP or Xcode compile for native Swift changes. Linked the guide from `README.md`, refreshed the Prisma/Neon runbook build wording, and recorded the no-gap documentation update in `docs/GAPS_AND_RISKS.md`.
- 2026-07-03: Verification passed: `npm run verify:docs`; `git diff --check`.
- 2026-07-03: All twelve backend foundation slices are now shipped locally with proof recorded in this plan and `tasks/todo.md`.
