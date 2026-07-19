# Native Schedule Availability and Trade Board Redesign - 2026-07-18

## Goal

- Make My Availability directly interactive and make the Trade Board a calm, action-first companion to the redesigned native Schedule.

## Route

- Owner area: `AREA_SHIFTS`
- Secondary area: `AREA_MOBILE`
- Ledger: this plan plus `tasks/todo.md`
- Existing reference: `tasks/ios-schedule-core-redesign-plan.md`

## Source Checks

- Existing weekly and ad hoc availability records already support create, update, and delete through `/api/users/[id]/availability`; this slice adds the missing native update client and interaction layer.
- Availability remains advisory except approved time off, which retains its current server-owned blocking behavior.
- Trade Board continues using `/api/schedule/open-work` and `/api/shift-trades`; claim, cancel, eligibility, and conflict policy remain server-owned.
- Schedule remains the native entry point, with Profile retaining its existing My Availability route.

## Stop Conditions

- Stop if the native models do not tolerate the current availability or trade response envelopes.
- Stop if an interaction would require changing assignment, trade, time-off approval, or custody policy.
- Preserve all unrelated Schedule core redesign work in the current dirty worktree.

## Slices

- [x] Add an interactive weekday canvas with direct day selection, state summaries, selected-day blocks, and one-time exception access.
- [x] Allow existing availability blocks to open in an edit sheet backed by the existing PATCH route, while preserving confirmed deletion and pull-to-refresh recovery.
- [x] Redesign Trade Board around available work, a quiet My Posts scope, date-aware cards, inline claim/cancel actions, and compact blocked/history context.
- [x] Expose My Availability from Schedule without removing the Profile entry point.
- [x] Update native source contracts, area docs, gaps, audits, and the task ledger.

## Verification

- [x] Focused Availability, Trade Board, Schedule routing, and API source-contract tests.
- [x] Full `tests/ios-*.test.ts` native source-contract suite.
- [x] `npm run drift:ios`
- [x] `npm run audit:ios:gaps`
- [ ] `npm run ios:project:check` (blocked by pre-existing checked-in XcodeGen project drift).
- [x] Wisconsin Simulator and generic iOS device builds.
- [ ] Simulator proof in light and dark appearance plus an accessibility text size when runtime access is available (dark Schedule and Trade Board runtime inspected; full matrix deferred).
- [x] `npm run codemap`, `npm run verify:docs`, and `git diff --check`.

## Review

- Shipped: Interactive weekly availability editing, selected-day and exception browsing, a Schedule entry point, and a hierarchy/action redesign of Trade Board.
- Verified: 244 native source-contract tests, focused contracts, iOS drift and gap audits, Simulator build/run, unsigned generic-device build, codemap/docs verification, and diff whitespace.
- Deferred: Full light, dark, and accessibility-size visual matrix. No live availability or trade mutation was performed during proof.
- Blocked: `npm run ios:project:check` reports pre-existing drift in `ios/Wisconsin.xcodeproj/project.pbxproj` compared with XcodeGen output.
- Proof artifacts: XcodeBuildMCP runtime snapshots of the dark Schedule and Trade Board plus successful Simulator and generic-device build output.
- Next slice or stop: Continue with Add Shift and Assign Student when requested; availability and trade core are ready for user review.
