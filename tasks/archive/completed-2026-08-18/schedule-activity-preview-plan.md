# Schedule Activity Preview Plan - 2026-08-18

## Goal

- Make the Schedule readiness activity chips open a read-only preview of the recent audit-backed changes.
- Keep the existing event and working-copy authority boundaries unchanged.

## Route

- Owner area: `docs/AREA_SHIFTS.md`
- Route: `/schedule`
- Existing source: `ScheduleReadiness` already receives `ScheduleHealthSnapshot.changeHistory` and counts recent calendar and assignee activity.
- Existing product contract: staff/admin health includes private working-copy history; worker-facing Schedule reads remain published-only.

## Slices

- [x] Add a focused shadcn-backed preview sheet for calendar and assignee activity.
- [x] Wire both activity chips and expanded metric cards to the preview, with event links and empty-state copy.
- [x] Verify focused source/tests, TypeScript, diff/build checks, and authenticated visible browser interaction.
- [x] Sync the Schedule area changelog and close this plan with evidence.

## Stop Conditions

- Stop if the health response no longer contains the change-history rows needed for the preview.
- Stop if the preview would expose private working-copy activity to a non-staff Schedule surface.
- Stop before changing API, schema, publication, or notification behavior; those are outside this slice.

## Verification

- Focused Schedule contract tests.
- `npx tsc --noEmit --pretty false`
- `git diff --check`
- `npm run build:app`
- Authenticated browser proof on `/schedule`: open Assignee changes, inspect preview rows, close it, and verify no console/runtime errors.

## Review

- Shipped: `/schedule` activity rail and Details cards now open a read-only, activity-filtered preview with 17 authenticated assignee rows observed locally.
- Verified: focused Vitest (14 tests), focused ESLint, `npx tsc --noEmit --pretty false`, `git diff --check`, `npm run build:app`, and visible authenticated browser interaction all passed.
- Deferred: none planned
- Blocked: none
- Proof artifacts: authenticated local Schedule tab at `http://127.0.0.1:3000/schedule`; 17 preview rows and 17 `Open event` links observed.
- Next slice or stop: stop; keep the existing Event command center as the deeper history surface.
