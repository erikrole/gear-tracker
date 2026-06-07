# iOS Items Control Clarity Plan

Created: 2026-06-03

## Goal

Make the native Items list controls understandable without remembering toolbar icons, especially Favorites and Status filtering.

## Source Audit

- `docs/AREA_MOBILE.md`: mobile list controls should stay pinned near the top and keep student workflows action-first.
- `docs/AREA_ITEMS.md`: Items list supports search, status/category/location/item filtering, favorites scope, tag-first rows, and direct row detail navigation.
- `docs/IOS_PATTERNS.md`: interactive controls should be real `Button`s, at least 44 pt, and clear to VoiceOver.
- `docs/IOS_DEVICE_WALKTHROUGH.md`: Items QA currently calls out star/category filter buttons in the toolbar, which is the ambiguity this slice targets.
- `tasks/audit-items-ios.md`: prior audit fixed tap targets but still left Favorites and Status as icon-first toolbar controls.
- `ios/Wisconsin/Views/ItemsView.swift`: Favorites and Status currently live in a trailing toolbar cluster with icon-only labels.

## Scope

- Replace icon-only Items toolbar filters with a visible control strip above the list.
- Keep search behavior, list pagination, favorite toggling, status menu choices, row actions, and reserve prefill unchanged.
- Keep Item Detail and Booking Detail action surfaces unchanged unless a source-level blocker appears.

## Non-Goals

- Do not add desktop-only item filters or sorting controls to iOS.
- Do not change API payloads.
- Do not add item lifecycle admin actions; GAP-36 remains an expected V1 mobile deferral.

## Checklist

- [x] Move Items Favorites and Status controls into named controls near the list.
- [x] Remove the icon-only Items filter toolbar cluster.
- [x] Add static contract coverage for visible Items controls.
- [x] Sync mobile, items, walkthrough, gaps/task docs.
- [x] Verify with focused tests, iOS drift, iOS audit, TypeScript, XcodeBuildMCP simulator build, and diff checks.

## Review

Implemented the focused Items clarity slice in `ios/Wisconsin/Views/ItemsView.swift`. The list now exposes `Favorites` and `All statuses` as named controls above the list, with status selection changing the visible label to `{N} statuses`.

No API payloads changed. Item Detail and Booking Detail were source-audited but left unchanged because their visible primary actions are already named in the content, and remaining toolbar icons are conventional single actions rather than list-scope toggles.

Verification passed: `npx vitest run tests/student-field-contracts.test.ts`, `npx tsc --noEmit`, `npm run drift:ios`, `npm run audit:ios:gaps`, `git diff --check`, and XcodeBuildMCP simulator build for scheme `Wisconsin`.
