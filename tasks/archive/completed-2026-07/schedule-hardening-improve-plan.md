# Schedule Hardening Improve Execution Plan

Date: 2026-06-19

## Scope

- Gate hidden calendar-event list reads so `includeHidden=true` is staff/admin-only.
- Replace mirrored calendar-events query coverage with route-backed tests for hidden/archive/date contracts.
- Keep changes limited to the calendar-events read contract and docs/tasks updates.

## Checklist

- [x] Patch `/api/calendar-events` GET authorization for hidden-event reads.
- [x] Add route-backed GET tests for default visibility, staff hidden reads, and student denial.
- [x] Remove stale mirrored query-helper tests.
- [x] Update Events/Shift docs and gaps ledger.
- [x] Run focused tests, typecheck, docs verification, and app build.

## Query-Contract Follow-Up

- [x] Extract shared CalendarEvent where-builder for Schedule/Event date, visibility, archive, status, sport, and unmapped filters.
- [x] Wire calendar-events, Schedule health, Schedule automation, and Schedule exports to the shared helper.
- [x] Add helper-level regression tests that import the real helper instead of mirroring route logic.
- [x] Update docs and rerun verification.

## Sport-Code and Home-Venue Follow-Up

- [x] Add canonical sport-code normalization and validation helpers.
- [x] Apply sport-code parsing to Schedule/Event, booking, draft, user, and sport-settings API boundaries.
- [x] Preserve tolerant display/service behavior for legacy stored sport codes.
- [x] Use mapped `Location.isHomeVenue` data during calendar sync home/neutral classification.
- [x] Add focused schema, route, and sync regression coverage.
- [x] Update docs and rerun verification.

## Sport-Code Route Coverage and Venue Audit Follow-Up

- [x] Add remaining route-level tests for lowercase sport-code normalization and unknown-code rejection.
- [x] Add read-only venue mapping audit helper for home venues without mappings and stale/inactive mapped locations.
- [x] Update docs and rerun verification.

## Manual Event Create Schema Follow-Up

- [x] Replace ad hoc manual calendar-event POST field checks with a route-local Zod schema.
- [x] Preserve existing staff/admin authorization, all-day UTC-midnight normalization, sport-code parsing, and audit writes.
- [x] Add route coverage for malformed JSON, blank titles, invalid dates, inverted dates, invalid location IDs, trimmed fields, and no-sport event metadata cleanup.
- [x] Update docs and rerun verification.

## Review

- 2026-06-19: `/api/calendar-events` now rejects `includeHidden=true` unless the authenticated user is STAFF or ADMIN.
- 2026-06-19: Calendar-events GET coverage now hits the real route for default hidden/archive filtering, staff hidden reads, and student denial. The old mirrored query-helper test was deleted.
- 2026-06-19: Verification passed: focused Vitest tests, `tsc --noEmit`, migration-prefix check, `git diff --check`, `verify:docs`, and `build:app`.
- 2026-06-19: Calendar-event where-building is now shared by `/api/calendar-events`, Schedule health, Schedule automation, and Schedule exports. Focused helper tests import the real helper and cover default visibility/archive/status filters, overlap windows, include-hidden/include-archived behavior, sport filters, and unmapped filters.
- 2026-06-19: Sport-code hardening now normalizes lowercase API input to canonical UW codes and rejects unknown sport codes at controlled route/schema boundaries. Calendar sync now uses venue mappings' `isHomeVenue` flag when deriving home versus neutral events.
- 2026-06-19: Manual calendar-event creation now uses a route-local Zod schema for summary, dates, all-day flag, pickup location, sport code, event type, and opponent input before DB writes.

## Out of Scope

- Authenticated browser smoke harness for Schedule visual grammar.
- Broad refactor of all Schedule window/filter builders.
- Schema changes or data migrations.
