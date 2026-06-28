# iOS launch and data loading plan

## Slice
Reduce first Home load work without changing the iOS Home UI or the default web dashboard contract.

## Plan
- [x] Add an iOS Home dashboard scope that keeps the existing response shape but skips row-heavy sections Home does not render.
- [x] Make the native app request the scoped Home payload.
- [x] Add source-contract coverage for the scoped route and client request.
- [x] Sync Mobile and Dashboard docs plus task ledger.
- [x] Run focused tests, TypeScript, iOS drift/gap checks, whitespace checks, and the iOS simulator build.
- [x] Add native timing logs for session restore, app-state badge refresh, Home dashboard load, cache skips, and first useful Home render.
- [x] Re-run web build after the Resources blocker fix and verify the iOS instrumentation build path.

## Review
- 2026-06-28: Native Home now calls `/api/dashboard?scope=ios-home`. The route keeps the existing default web payload untouched, while the iOS scope skips team checkout rows, team reservation rows, stale reservation rows, upcoming-event quick-view rows, top-overdue banner rows, and student draft rows that native Home does not render. It still returns counts, personal checkouts, personal reservations, pending pickups, shifts, event-linked gear, and staff/admin follow-up rows where native Home uses them.
- Verification passed with `npx vitest run tests/student-field-contracts.test.ts tests/dashboard-stats-transient-lanes.test.ts`, `npx tsc --noEmit`, `npm run drift:ios`, `npm run audit:ios:gaps`, `npm run codemap`, `npm run verify:docs`, `git diff --check`, and XcodeBuildMCP `build_run_sim` for `Wisconsin` on iPhone 17 Pro. `npm run build:app` compiled successfully but failed type-checking on unrelated active Resources work in `src/app/(app)/resources/page.tsx` (`EmptyState icon="book"` and unused `ClockIcon`).
- 2026-06-28 follow-up: The unrelated Resources build blocker is fixed locally, so `npm run build:app` now passes. Native launch instrumentation now logs `launch.session.restore`, `launch.appState.refresh`, `launch.home.dashboardLoad`, and `launch.home.firstUsefulRender` through the `Launch` OSLog category with durations and count summaries. The logs distinguish in-flight/fresh-cache skips from actual network loads, which gives the next launch pass direct evidence without changing app behavior.

## Notes
- Default `/api/dashboard` must stay unchanged for web and older clients.
- The iOS Home scope still needs counts, personal checkouts, personal reservations, pending pickups, shifts, event-linked gear, and staff follow-up rows where applicable.
- AppState badge refresh should remain on `/api/dashboard/stats`.
- Use the new `Launch` OSLog lines to compare session restore, badge-count refresh, dashboard network load, cache-hit behavior, and first useful Home render before cutting more data from the payload.
