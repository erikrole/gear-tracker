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
- [ ] Complete List and Calendar light/dark/accessibility-size screenshots after the Mac is unlocked. The simulator remained running, but OS lock prevented further tab navigation. Source contracts cover the shared row, calendar markers, Dynamic Type, all-day, multi-day, filter, and Back-state behavior.

## Follow-up Boundary

The next product slices remain My Availability and Trade Board, followed by Add Shift, Assign Student, Edit Shift Times, and Post Trade. The checked-in Xcode project also differs from fresh XcodeGen output before this slice; do not regenerate it inside this UI-only change without a separate reviewed project-file pass.
