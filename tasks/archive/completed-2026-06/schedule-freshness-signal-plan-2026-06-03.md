# Schedule Freshness Signal Plan - 2026-06-03

## Goal
- Add a compact Schedule source signal so staff/admin users can tell whether visible schedule rows are manual, imported from healthy feeds, stale, or affected by source errors without leaving `/schedule`.

## Sources Checked
- `AGENTS.md`, `tasks/lessons.md`
- `docs/NORTH_STAR.md`, `docs/AREA_EVENTS.md`, `docs/AREA_SETTINGS.md`, `docs/DECISIONS.md`, `docs/GAPS_AND_RISKS.md`
- `docs/BRIEF_MULTI_EVENT_BOOKING_V1.md`
- `prisma/schema.prisma`
- `src/app/(app)/schedule/page.tsx`
- `src/hooks/use-schedule-data.ts`
- `src/app/(app)/schedule/_components/ScheduleFilters.tsx`
- `src/app/(app)/schedule/_components/types.ts`
- `src/app/api/calendar-events/route.ts`
- `src/app/api/calendar-sources/route.ts`
- `src/app/(app)/settings/calendar-sources/page.tsx`
- `src/lib/services/calendar-sync-health.ts`

## Peer Patterns Checked
- Settings Calendar Sources: source states are Disabled, Error, Never synced, Stale, and Healthy; stale is currently 30 hours after last fetch.
- Reports toolbar: compact refresh/status controls belong in the toolbar, with detail available through tooltip/popover instead of a large banner.
- Booking detail header: compact freshness copy can be a secondary status affordance, not the main page action.

## Current Findings
- `/api/calendar-events` includes `source: { id, name }`, but the Schedule client type only kept `source.name`; manual events are already represented by `sourceId = null`.
- `/api/calendar-sources` returns `enabled`, `lastFetchedAt`, `lastError`, and event counts, but the 30-hour stale rule is duplicated only inside the Settings page UI.
- Schedule currently has false-empty protection that points to Calendar Sources only when no rows load. It does not tell operators that a non-empty Schedule may still be stale or partially manual.
- Calendar sync semantics are already decided: daily morning-refresh plus manual Settings sync. This slice must not change ICS import cadence, leases, or source mutation behavior.

## Plan
- [x] Orientation
- [x] Extract shared calendar source freshness classification with the existing 30-hour threshold.
- [x] Add a staff/admin-only Schedule source status query with 401 handling and graceful fetch failure copy.
- [x] Render a compact shadcn-based source signal in the Schedule toolbar showing manual visible events, imported visible events, and source health attention.
- [x] Reuse the shared classifier in Settings Calendar Sources so Schedule and Settings cannot drift.
- [x] Add focused tests for source classification and Schedule summary copy/state.
- [x] Update docs for shipped Schedule trust signal.
- [x] Run focused tests, `npx tsc --noEmit`, `npm run db:migrate:check`, `git diff --check`, `npx next build`, and authenticated browser smoke for `/schedule`.

## Out of Scope
- No calendar sync cadence changes.
- No source CRUD changes.
- No iOS changes.
- No schema migration.
- No new empty-state redirects for students.

## Review
- Shipped:
  - Shared `src/lib/calendar-source-freshness.ts` owns the 30-hour Calendar Source stale threshold and product labels.
  - Staff/admin `/schedule` now fetches Calendar Source metadata independently from event/shift data and shows a compact source signal in the filter toolbar.
  - The signal distinguishes manual visible events, imported visible events, healthy sources, stale sources, never-synced sources, disabled sources, source errors, and source-status load failures.
  - Settings > Calendar Sources now reuses the shared classifier so its health badges cannot drift from the Schedule signal.
  - Schedule date-group keys now remain unique when the same date appears in more than one rendered group.
- Verified:
  - `npx vitest run tests/calendar-source-freshness.test.ts`
  - `npx tsc --noEmit`
  - `npm run db:migrate:check`
  - `git diff --check`
  - `npx next build`
  - Authenticated browser smoke on `http://127.0.0.1:3010/schedule`: login succeeded, Schedule loaded, source signal settled to `Calendar source stale`, Football Media Day remained visible with `Jul 7-8`, Calendar Source APIs returned 200, and the source-signal popover exposed the Calendar Sources link plus manual/imported/stale detail.
- Deferred:
  - No in-toolbar source sync action. Operators still use Settings > Calendar Sources for manual sync.
  - Student Schedule does not show source metadata.
  - Event detail and booking event picker do not yet carry the same source-freshness signal.
- Benefits:
  - Operators no longer have to infer source health from an empty state or leave Schedule to see whether loaded events may be stale.
  - Manual events are explicitly counted, which makes manual non-calendar work like Football Media Day easier to distinguish from imported athletics feeds.
  - Calendar source failures become visible while preserving the loaded Schedule rows, avoiding a false-empty or false-success pattern.
  - Settings and Schedule share one stale threshold, reducing future documentation/code drift.
- Remaining risks:
  - Source metadata is still a separate request from event data. If it fails, Schedule remains usable and shows source-status-unavailable copy, but it cannot prove feed freshness until the next successful metadata fetch.
  - The signal summarizes current visible Schedule rows plus configured source health; it does not yet mark each individual row with source freshness.
- Next suggested goal:
  - Booking event picker trust pass: carry multi-day/all-day labels, manual/source status, and stale-source warnings into checkout/reservation creation so operators linking gear to an event see the same trust context before committing a booking.
