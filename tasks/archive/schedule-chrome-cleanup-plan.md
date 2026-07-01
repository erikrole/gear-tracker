# Schedule Chrome Cleanup ("Strip to Minimum") — SHIPPED 2026-06-30

## Context
`/schedule` stacked four heavy chrome layers above the first event (header with 4 buttons,
bordered filter toolbar, 5-7 readiness stat cards, Automation review digest) with the same
crew/trade/gear/data-quality numbers duplicated across 2-3 layers. The event list was pushed
far below the fold. User asked to "really clean up the chrome" and chose the most aggressive
"strip to minimum" direction. Aligns with `docs/DESIGN_LANGUAGE.md` (calm, dense, quiet toolbar,
reuse `OperationalToolbar`/`OperationalMetricCard`) and the 2026-06-18 Schedule MVP polish pass.

## Slices (all shipped in one change)
- [x] Extend shared `OperationalMetricCard` with an optional backward-compatible `onClick`
      (button wrapper) so queue cards reuse the shared primitive. `src/components/OperationalFeedback.tsx`
- [x] Rework `ScheduleReadiness` into one compact attention bar (next call + nonzero attention
      chips + all-clear state) with a single collapsible details grid. `src/app/(app)/schedule/_components/ScheduleReadiness.tsx`
- [x] Refactor `ScheduleAutomationDigest` into a presentational `ScheduleAutomationCards` grid
      rendered inside the details panel (staff only); removed the standalone banner. `.../ScheduleAutomationDigest.tsx`
- [x] Quiet `ScheduleFilters` with `OperationalToolbar`; moved Past/Archived into the Filters
      popover; removed the duplicate Needs-crew button. `.../ScheduleFilters.tsx`
- [x] `page.tsx`: dropped the separate digest render, passed `digest`+`isStaff` to readiness,
      folded New event/Export/Trade Board into a header overflow menu (Assign shifts stays primary).

## What was preserved (nothing removed)
Every readiness metric, automation card, filter, and queue route still exists: critical counts in
the attention chips, full detail in the one expandable panel, Past/Archived/Coverage in the Filters
popover, and Trade Board/New event/Export in the header overflow. No Schedule API/health/automation/
shift/trade/coverage/export contract changed.

## Verification (all passed)
- `npx tsc --noEmit` clean; `eslint` clean; `npm run build:app` (next build) succeeded, `/schedule` 31.8 kB.
- Live preview (authenticated, real data) verified: collapsed attention bar shows only nonzero chips
  (Crew needed 423, Gear gaps 16, Data quality 83, My shifts 1) with UPCOMING EVENTS 101 immediately
  below; Details expands to the readiness grid + Automation review cards in one panel; header overflow
  lists New event / Trade Board / Export (6 CSV options); Filters popover holds Past + Archived + Sport/
  Area/Coverage. Mobile (375px): chips wrap, details grid drops to 2 columns. No console errors.

## Notes for future sessions
- Preview auth: `src/middleware.ts` only sets CSP; the `(app)` layout enforces the auth redirect.
  Routes outside `(app)` render unauthenticated, which is handy for throwaway mock-data visual harnesses.
- Radix menus/popovers open on real pointer events; synthetic `.click()` does not open them. Use the
  preview_click tool (real CDP click) or dispatch pointer events.
