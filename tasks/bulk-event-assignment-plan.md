# Bulk Event Assignment Plan - 2026-08-18

## Goal

- Let staff/admin preview and apply best-fit assignments across the active future events in the selected month, optionally narrowed by sport and area.
- Preserve existing assignments, stage new assignments in private working copies, and send each affected worker one consolidated notification after release.

## Route

- Owner area: Schedule / Shift Calendar & Scheduling
- UI: `/schedule/assign`
- API: `/api/schedule/bulk-assignment/preview` and `/api/schedule/bulk-assignment/apply`
- Existing owner plan: `tasks/event-shift-working-schedule-plan.md` (already dirty from parallel work; do not edit it in this slice)
- This isolated plan owns only the new bulk-assignment slice and will not rewrite existing dirty task indexes or area docs.

## Source Checks

- D-046 keeps each working-copy version private for ten minutes and currently sends one consolidated notification per affected worker per event release.
- The current pending-release workflow runs independently per `ShiftGroup`; a sport/month operation therefore needs a durable batch identity and item status to aggregate safely.
- The current assignment grid already owns month, sport, and area filters and is the natural entry point for the preview action.
- Working-copy payloads already support ID-only assignment commands; publication currently creates new assignments as `MANUAL`, so bulk provenance must be carried through the payload as `AUTO_FILL`.
- Existing candidate scoring, availability, role-slot, audit, notification preference, and working-copy guards remain authoritative.

## Stop Conditions

- Stop if the apply path would call direct `/api/shift-assignments` mutations or bypass the private working-copy release boundary.
- Stop if an event has a newer working copy/version than the preview and return a stale-preview conflict without partial writes.
- Do not overwrite existing assignments, merge into an already-pending event, or include collaborators in auto-fill.
- Do not send event-level worker notifications for batch items; the batch summary must be idempotent and release-gated.
- Do not claim authenticated browser, production, or native runtime proof without completing those gates.

## Slices

- [x] Slice 1: Add durable bulk operation/item records and carry `AUTO_FILL` assignment provenance through working-copy publication.
- [x] Slice 2: Build deterministic sport/month preview and serializable apply services with fingerprint and version checks.
- [x] Slice 3: Add exact-version release aggregation and one per-worker notification: `You were assigned N shifts` / `Click to review your upcoming shifts`, linking to recipient-scoped My Shifts with sport/date filters.
- [x] Slice 4: Add the preview-first assignment UI to `/schedule/assign`, including proposal, warning, skipped, and pending-release states.
- [x] Slice 5: Add focused tests, docs/source contracts, and verification evidence.

## Verification

- [x] Focused policy, release, deep-link, publication-source, batch-release, and notification-copy source contracts.
- [x] `npm run db:migrate:check`
- [x] `git diff --check`
- [x] `npx tsc --noEmit --pretty false`
- [x] `npm run lint`
- [x] `npm run build:app`
- [ ] `npm run codemap` and `npm run verify:docs` if shared route/source ownership changes are accepted into this slice.
- [ ] Authenticated browser smoke on `/schedule/assign`: preview is read-only, apply stages exact events, pending release is visible, and Schedule deep link activates My Shifts plus sport/date filters.
- [ ] Release proof: worker-facing schedule remains unchanged before release; one in-app/push/email summary per affected worker is created after the batch reaches terminal item states.
- [ ] Native/iOS behavior remains a separate gate unless this slice changes native notification routing.

## Review

- Shipped locally: `/schedule/assign` now offers a month/sport/area bulk-assignment preview; apply stages selected proposals into versioned working copies, carries `AUTO_FILL` provenance through publication, and records a durable batch outcome.
- Shipped locally: terminal batch release suppresses per-event worker schedule notifications and sends one per-recipient notification with title `You were assigned N shifts`, body `Click to review your upcoming shifts`, and a Schedule My Shifts deep link carrying sport/date filters.
- Verified: Prisma schema validation/generation, migration-prefix checks, 3,249/3,250 full-suite tests on the preview environment plus the one bootstrap test passing with a local dummy `DIRECT_URL`, focused 16-test release/deep-link/source-contract run, focused ESLint, full lint exit 0, TypeScript, production app build, and whitespace checks.
- Deferred: native bulk-assignment UI and native notification tap-through; the web payload is ready, but iOS notification routing still expects event IDs.
- Blocked: authenticated browser proof is blocked because the available local browser session redirects `/schedule/assign` to `/login`; codemap/docs verification is blocked by unrelated concurrent edits in generated docs and shared ledgers. The new migration has not been applied to a database in this slice.
- Proof artifacts: local build output and source/test contracts; no schedule data was mutated.
- Next slice or stop: run authenticated preview/apply/release smoke on an isolated database, apply and health-check migration `0116_bulk_schedule_assignment`, then sync the Schedule area docs/codemaps once the parallel worktree changes are reconciled.
