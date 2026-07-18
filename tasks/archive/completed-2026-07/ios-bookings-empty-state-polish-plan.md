# iOS Bookings Empty-State Polish Plan - 2026-07-17

## Goal

- Make empty Bookings states feel calm, contextual, and recoverable without presenting a filter reset like a primary destructive action.

## Route

- Owner area: Mobile Operations
- Ledger: `tasks/ios-bookings-empty-state-polish-plan.md`
- Existing references: `tasks/audit-bookings-ios.md`, `tasks/archive/completed-2026-07/ios-bookings-surface-polish-plan.md`

## Source Checks

- The Mine-empty state currently uses a centered `ContentUnavailableView`, generic archive icon, and prominent brand-red reset button.
- Search, Mine, and global empty states need different meaning but can share one native card anatomy.
- Scope changes and reservation creation already use capability-aware handlers; this slice changes presentation and copy only.

## Stop Conditions

- Stop if the redesigned recovery action bypasses role or reservation-creation capability gates.
- Stop if the empty state obscures search, pull-to-refresh, or the active Mine toolbar state.

## Slices

- [x] Add a compact, Dynamic Type-safe empty card with scope-specific tone, copy, and recovery action.
- [x] Keep Mine reset and reservation creation wired through the existing handlers and gates.
- [x] Update focused contracts, audit notes, and Mobile documentation.

## Verification

- [x] Focused Bookings source contracts.
- [x] Full native source-contract suite.
- [x] `npm run drift:ios`
- [x] `npm run audit:ios:gaps`
- [x] Xcode simulator build and authenticated runtime proof.
- [x] `npm run verify:docs`
- [x] `git diff --check`

## Review

- Shipped: Compact shared Bookings empty card with Mine all-clear, search no-match, and global reservation semantics; quiet bordered recovery controls preserve existing handlers and gates.
- Verified: 18 focused contracts, 240 full native source contracts, drift audit, gap inventory, simulator builds, and authenticated iPhone 17 Pro dark-mode runtime proof.
- Deferred: A final light-mode empty-card capture was unavailable because simulator automation did not actuate the Mine toolbar toggle after switching appearance; the same adaptive tokens compiled and launched in light mode.
- Blocked: None.
- Proof artifacts: Authenticated iPhone 17 Pro runtime showed the card hierarchy, Dynamic Type-safe copy, and no tab-bar overlap; docs verification and diff check pass.
- Next slice or stop: Stop. The empty-state polish is complete.
