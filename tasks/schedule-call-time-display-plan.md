# Schedule Call Time Display Plan

Last updated: 2026-06-19

## Scope

Patch Schedule/Event crew call-time display so the UI distinguishes:

- Event time: synced/manual `CalendarEvent.startsAt` and `endsAt`.
- Default/generated shift window: `Shift.startsAt` and `endsAt`, created from sport settings offsets.
- Slot override: `Shift.callStartsAt` and `callEndsAt`.
- Personal override: `ShiftAssignment.callStartsAt` and `callEndsAt`.

Visible crew rows should show one call time for each row/person. The end of the window remains editable and available for conflict/coverage logic, but row labels should not read like each person has multiple call times.

## Checklist

- [x] Re-read Schedule/Event docs, schema call-time fields, shared call-window helper, Event detail Crew component, Schedule list call-window consumers, and call-window tests.
- [x] Update the shared call-window display helpers so labels show one call time while preserving full-window titles for context.
- [x] Update the shared call-window editor copy from call window language to call time language where visible.
- [x] Add focused tests for default, slot, and personal call-time precedence/display.
- [x] Sync docs, task queue, and lessons from this correction.
- [x] Verify with focused tests, TypeScript, docs, whitespace, and app build.

## Peer Patterns Checked

- Event detail Crew uses `CallWindowEditor` for staff/admin slot and personal call edits.
- Schedule list expanded rows use `CallWindowEditor` for slot and assignment edits.
- Schedule Assign cells use `formatCallWindow` next to assigned users and `CallWindowEditor` for edits.
- Event detail header and Schedule list summaries use `summarizeEffectiveCallWindows`.

## Review

- 2026-06-19: Shared call-time labels now render one visible call time from the effective start. Full start/end windows remain available through titles, editor fields, conflict checks, and existing API contracts.
- 2026-06-19: The editor now names the visible concept as call time and the end field as coverage end. This keeps event time, generated/default shift window, slot override, and personal override distinct without a schema or API migration.
- 2026-06-19: Verification passed with `npx vitest run tests/shift-call-windows.test.ts tests/schedule-event-title-parts.test.ts tests/calendar-sync.test.ts`, `./node_modules/.bin/tsc --noEmit`, `npm run db:migrate:check`, `git diff --check`, `npm run verify:docs`, and `npm run build:app`.
