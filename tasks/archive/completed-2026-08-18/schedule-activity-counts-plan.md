# Schedule Activity Counts Plan - 2026-08-18

## Goal

- Make the Schedule readiness cards report recent calendar-sync activity and assignee/schedule edits that actually occurred in the last 24 hours.
- Preserve private working-copy authority: staging an edit may be visible to staff as activity, but it must not become worker-facing schedule truth before the existing release workflow.

## Route

- Owner area: `docs/AREA_SHIFTS.md`
- Closeout ledger: `tasks/todo.md`
- Related contracts: `src/app/(app)/schedule/_components/ScheduleReadiness.tsx`, `src/lib/services/schedule-change-history.ts`, `src/lib/services/schedule-health.ts`, and the working-copy/sync audit writers.

## Source Checks

- The two readiness cards count `ScheduleChangeItem.kind` values from `health.changeHistory.events`, limited client-side to the last 24 hours.
- Schedule health scopes history to the currently visible event IDs and asks for three items per event over the last 30 days.
- Manual event and live assignment mutations already write `AuditLog` rows.
- `syncCalendarSource` mutated changed calendar events in bulk but wrote no event audit rows.
- Working-copy commands wrote `working_schedule_*` rows against `shift_group_working_copy`; the history reader ignored that entity type.
- Schedule working copies remain private until the existing timed release/reconciliation path publishes them.

## Stop Conditions

- Do not expose private working-copy payloads to worker-facing reads or alter the timed release contract.
- Do not add a schema/migration unless an audit query cannot be made bounded and indexed with the existing model.
- Do not perform production mutation, deployment, commit, or push without explicit authorization.

## Slices

- [x] Record bounded audit activity for changed ICS calendar events, including creates, updates, and cancellations, without auditing unchanged feed rows.
- [x] Map working-copy commands into the existing event-scoped history model, with an explicit staff/admin opt-in and no draft payload exposure.
- [x] Add focused regression coverage for synced calendar activity and draft assignee/slot activity while preserving existing live audit behavior.
- [x] Sync the Schedule and Events area/task evidence for the behavior shipped locally.

## Verification

- [x] Focused calendar-sync, schedule-change-history, schedule-health, and Schedule source-contract tests: 120 passed.
- [x] Focused ESLint for touched TypeScript/tests.
- [x] `npx tsc --noEmit --pretty false`.
- [x] `npm run build:app`.
- [x] `git diff --check`.
- [x] `npm run codemap` and `npm run verify:docs` after docs sync.
- [ ] Authenticated browser smoke for `/schedule`; local preview redirected to `/login` without an approved authenticated browser session, and no schedule data was mutated.

## Review

- Shipped: Imported calendar creates/updates now write system audit rows atomically; staff/admin Schedule health and Event command-center history include scoped working-copy actions; student Schedule health remains published-only.
- Verified: Source/build/test gates pass locally; audit writer and history-reader regression tests cover the two missing sources.
- Deferred: Authenticated `/schedule` visual/runtime proof with real activity data.
- Blocked: No code blocker. Runtime proof needs an authenticated local browser session.
- Proof artifacts: Focused Vitest output, ESLint, TypeScript, build, codemap/docs verification, and diff check are terminal evidence; no browser artifact was produced.
- Next slice or stop: Stop here unless an authenticated browser session is provided for the final visual gate.
