# Native Schedule Core Redesign

## Scope

Redesign the native iOS Schedule list, month calendar, and Event detail as one operational flow without changing API, schema, permissions, scheduling policy, or the collaborator Published Schedule.

## Completed

- [x] Keep List as the default all-upcoming-events scope.
- [x] Give assigned events a restrained blue personal-work treatment while preserving Home, Away, Neutral, and Non-game classification rails.
- [x] Share `EventRow` between agenda and selected-day Calendar results.
- [x] Separate venue, event timing, call time, area, gear state, and staff-only coverage into a stable hierarchy.
- [x] Preserve all-day and multi-day expansion, including Day N of N context.
- [x] Keep classification dots in the month grid and add a separate blue personal-assignment mark.
- [x] Remove passive freshness chrome while preserving pull-to-refresh and failure-only recovery.
- [x] Route Schedule, Home, and event pushes into full-screen `EventDetailView` through the parent navigation stack.
- [x] Add role-adaptive assignment, gear, open-shift, and staffing action cards.
- [x] Preserve crew management, approvals, trades, shift editing, duplication, deletion, and existing confirmation flows.
- [x] Give action failures specific titles and Try Again controls without dropping detail state.
- [x] Update native source contracts, Mobile/Shifts docs, audits, gaps, and the active task ledger.

## Verification

- [x] Focused Schedule and routing contracts: 47/47.
- [x] Full native source-contract suite: 240/240 across 135 suites.
- [x] iOS drift check: clean across 79 Swift files.
- [x] iOS audit inventory: 51/51 surfaces covered, zero gaps.
- [x] Wisconsin Simulator build and production-backed launch.
- [x] Generic iOS device build with code signing disabled.
- [x] Event detail runtime proof in light, dark, and Accessibility Large text.
- [x] Documentation/codemap verification and whitespace checks.
- [x] Complete List and Calendar light/dark/accessibility-size screenshots. Captured 2026-08-20 on iPhone 16 Pro (iOS 26.5) through the `GT_PERFORMANCE_SCENARIO=schedule` fixture harness, which renders both modes without a signed-in session or live network, so the earlier Mac-lock and Login blockers did not apply. Three `WisconsinUITests/ScheduleScreenshotUITests` runs passed in light, dark, and `accessibility-extra-large`. The accessibility run surfaced two real layout defects now recorded in `tasks/audit-schedule-ios.md`; source contracts cover the shared row, calendar markers, Dynamic Type font styles, all-day, multi-day, filter, and Back-state behavior, but not gutter width.

## Follow-up Boundary

The next product slices remain My Availability and Trade Board, followed by Add Shift, Assign Student, Edit Shift Times, and Post Trade. The separate reviewed project-file pass this section called for was completed on 2026-08-20: `xcodegen generate` resorted the hand-added `KioskOperatorHubView.swift` entries, the hand-maintained schemes were restored afterward, and `npm run ios:project:check` now passes.
