# Schedule Daily Sync Changes Plan - 2026-07-23

## Goal
- Show the latest daily calendar-fetch additions, modifications, and upstream removals directly on the web Schedule page.
- Preserve the existing safety rule that a feed disappearance is review evidence, not permission to delete a Gear Tracker event.

## Route
- Owner area: `docs/AREA_SHIFTS.md`
- Secondary contracts: `docs/DECISIONS.md` D-007, D-026, and D-035
- Ledger: this plan, then the July 2026 completed-plan archive after verification
- Existing plan references: `tasks/event-shift-working-schedule-plan.md` continues to own private crew editing and native publication adoption; it does not own calendar-fetch reporting.

## Source Checks
- `src/app/api/cron/morning-refresh/route.ts` is the accepted once-daily calendar fetch and maintenance boundary.
- `src/lib/services/calendar-sync.ts` already diffs imported events into create, update, unchanged, and missing-from-source sets. Missing events are intentionally not auto-cancelled or deleted.
- The current sync result incorrectly includes unchanged rows in `updated`; the digest must use actual changed rows.
- `SystemConfig` already stores bounded daily operational state such as calendar sync health, so a bounded latest-run digest can ship without changing the dirty Prisma schema or migration chain.
- `/schedule` already loads independent health and automation snapshots through `useScheduleData`; the sync digest can follow that additive partial-failure pattern.
- The Notifications page provides the shipped date-grouped list grammar, while Schedule readiness provides the compact operational-summary grammar. The new surface should be a concise Schedule-native digest, not a second admin audit browser.
- User correction on 2026-07-23: the digest belongs inside the Schedule status rail, uses a calm change color rather than attention semantics, and is ADMIN-only.

## Stop Conditions
- Stop if source diffing cannot distinguish unchanged events from modified events.
- Stop if “removed” would require deleting or cancelling a Gear Tracker event.
- Stop if the latest run cannot be stored with a bounded payload and explicit truncation.
- Stop if the Schedule response would expose events outside the authenticated internal Schedule surface.
- Stop if implementation requires touching unrelated in-progress schema, migration, event-travel, or working-copy edits.

## Slices
- [x] Slice 1: Return bounded field-level change facts from calendar sync, with accurate create/update counts and safe missing-from-source classification.
- [x] Slice 2: Persist the completed morning-refresh digest and expose it through an authenticated Schedule read route.
- [x] Slice 3: Add the daily What changed list to web Schedule with loading, empty, partial-failure, truncation, and event-detail links.
- [x] Slice 4: Add focused service, cron, route, and source/UI coverage; sync area docs and task lifecycle.
- [x] Correction slice: move the digest summary into the rail orientation and its rows into rail Details, add a calm change tone, and enforce ADMIN-only API and rendering.

## Verification
- [x] Focused calendar-sync, digest-service, morning-refresh, API, and Schedule UI tests
- [x] `npx tsc --noEmit --pretty false`
- [x] Focused ESLint for changed TypeScript/TSX files
- [x] `npm run codemap`
- [x] `npm run verify:docs`
- [x] `git diff --check`
- [x] `npm run build:app`
- [x] Authenticated browser smoke for `/schedule`, or record why unavailable

## Review
- Shipped: Morning refresh now stores a bounded latest-run calendar digest with exact added, modified, and newly missing events. Admin Schedule renders a calm purple daily-fetch count in the shared status rail and keeps totals, source context, changed fields, event links, clean first-run and no-change states, source failures, expansion, and truncation disclosure inside rail Details. Staff and students neither render nor fetch the digest. Unchanged rows no longer count as updates.
- Verified: 125 focused tests passed across calendar sync, digest persistence, morning refresh, Schedule source truth, automation, and shared rail contracts. Focused ESLint, TypeScript, codemap/docs verification, whitespace checks, and `npm run build:app` passed.
- Deferred: No history browser beyond the latest daily run. The request asked for a daily list, and the latest run is the bounded operational surface.
- Blocked: The current database has no recorded daily digest yet, so authenticated browser proof covered the honest first-run empty state rather than a populated live run. Triggering the real maintenance cron solely for display proof was intentionally avoided.
- Proof artifacts: Authenticated ADMIN `/schedule` returned the digest API with HTTP 200, showed the calm purple `Daily fetch · Not recorded` orientation inside the shared rail, and revealed the first-run daily list only inside Details. Desktop and 375-class viewport checks had no horizontal overflow; browser console warnings/errors were empty. No populated run was fabricated.
- Next slice or stop: Stop. Let the next scheduled morning refresh populate the first real digest.
- Correction status: Verified and complete.
