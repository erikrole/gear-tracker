# Native Schedule Filters and Calendar Management Redesign - 2026-07-18

## Goal

- Finish the core Schedule utility experience with understandable event filters and an honest, recoverable Apple Calendar subscription screen.

## Route

- Owner area: `AREA_SHIFTS`
- Secondary area: `AREA_MOBILE`
- Ledger: this plan plus `tasks/todo.md`
- Existing references: `tasks/ios-schedule-core-redesign-plan.md`, `tasks/ios-shift-calendar-widgets-plan.md`, `tasks/audit-schedule-ios.md`, and `tasks/audit-schedule-list-ios.md`

## Source Checks

- Schedule already keeps dense scope controls in `ScheduleFilterSheet`, while the first viewport shows only a quiet active-filter summary and Filters button.
- `HomeAwayFilter.neutral` currently matches every event with `isHome == nil`, which incorrectly mixes Neutral games and Non-game events even though Schedule rows distinguish them.
- The existing calendar action fetches or creates the current user's private ICS token and opens a `webcal://` URL through `AppEnvironment`.
- `GET /api/shifts/ics-token` reports whether a token exists. `POST /api/shifts/ics-token` creates or rotates it, invalidating the prior URL and writing an audit entry.
- iOS cannot confirm whether Apple Calendar completed a subscription or when Apple refreshes it. The app may record only its own successful handoff to Calendar.

## Stop Conditions

- Stop if calendar UI would claim a verified subscription state that the app cannot observe.
- Stop if resetting a private feed link can happen without explaining that existing calendar subscriptions will stop updating.
- Stop if filter changes alter event visibility outside the selected scope or add staff-only controls to student surfaces.
- Preserve all current Schedule redesign and unrelated dirty-worktree changes.

## Slices

- [x] Separate Neutral and Non-game filtering in List and Calendar and rebuild the filter sheet around compact scope, event-type, sport, result-count, and clear actions.
- [x] Replace the one-shot calendar action with a status and management sheet that loads feed readiness, opens Apple Calendar, records the handoff time locally, supports explicit private-link reset, and keeps errors recoverable.
- [x] Preserve pull-to-refresh, Schedule state, role gates, Dynamic Type, VoiceOver, reduced motion, shared host configuration, and server-owned token security.
- [x] Add focused source contracts and sync Schedule, Mobile, gaps, audits, and active ledgers.

## Verification

- [x] Focused Schedule filter, calendar management, API, and domain source-contract tests.
- [x] Full `tests/ios-*.test.ts` native source-contract suite.
- [x] `npm run drift:ios`
- [x] `npm run audit:ios:gaps`
- [x] `npm run ios:project:check`, with the existing checked-in `ios/Wisconsin.xcodeproj/project.pbxproj` XcodeGen drift recorded precisely.
- [x] Wisconsin Simulator and generic iOS device builds.
- [x] Authenticated runtime inspection remains blocked because the reset Simulator session opens at Login; no credentials were used or changed for this slice.
- [x] `npm run codemap`, `npm run verify:docs`, and `git diff --check`.

## Review

- Shipped: Result-oriented Schedule filters, correct Neutral versus Non-game scopes in List and Calendar, and a recoverable Shift Calendar management sheet with honest status, Apple Calendar handoff, Retry, and protected private-link rotation.
- Verified: 28 focused and 256 full native source contracts pass. Simulator and unsigned generic-device builds pass. iOS drift reports 0 violations across 79 Swift files, iOS audit coverage is 51/51, codemaps and docs are current, and whitespace checks pass.
- Deferred: App Group shift snapshots, WidgetKit surfaces, and EventKit-managed reconciliation remain outside this core Schedule utility slice.
- Blocked: Authenticated visual proof stops at Login in the reset Simulator session. `npm run ios:project:check` still reports only the pre-existing checked-in `ios/Wisconsin.xcodeproj/project.pbxproj` XcodeGen drift.
- Proof artifacts: `tests/ios-schedule-filters-calendar-management-redesign.test.ts`, updated Schedule source contracts, both Xcode build logs, iOS audit outputs, and synchronized area/task ledgers.
- Next slice or stop: The internal native Schedule core and utility surfaces are complete. The next Schedule-owned visual pass is the collaborator Published Schedule, unless launch testing takes priority.
