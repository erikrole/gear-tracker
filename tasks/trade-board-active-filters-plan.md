# Trade Board Active Filters Plan - 2026-05-20

## Goal
- Move Trade Board active filter feedback onto `OperationalActiveFilterChips` while preserving the existing area/status/my-trades filter controls and API request shape.

## Peer patterns checked
- Items uses `OperationalActiveFilterChips` under `OperationalToolbar` for removable active facets.
- Users uses the same shared active-chip row under its filter controls.
- Trade Board already has compact `FilterChip` selectors inside a sheet, so this slice adds shared feedback without converting the sheet into a full page toolbar.

## Plan
- [x] Build a Trade Board `activeFilters` array for area, status, and my-trades filters.
- [x] Render `OperationalActiveFilterChips` below the existing filter controls.
- [x] Preserve Clear all, filtered empty recovery, and API query behavior.
- [x] Update shifts/design docs and task ledger.
- [x] Verify TypeScript, migration check, whitespace, build, and browser smoke.

## Review
- Shipped: Trade Board Area, Status, and My trades filters now render through shared removable active-filter chips under the existing selectors.
- Verified: `npx tsc --noEmit`, `npm run db:migrate:check`, `git diff --check`, `npx next build`, and protected-route browser smoke for `/schedule`.
- Deferred: Reports active-filter migration remains tracked in `docs/DESIGN_LANGUAGE.md`.
