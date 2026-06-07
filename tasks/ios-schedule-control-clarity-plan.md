# iOS Schedule Control Clarity Plan

Created: 2026-06-03

## Goal

Make iOS Schedule controls understandable without memorizing icons, especially the List/Calendar mode, My Shifts, Past events, Trade Board, and calendar subscription actions.

## Source Audit

- `docs/AREA_MOBILE.md`: mobile stays student-first, action-first, and keeps scan one tap away.
- `docs/AREA_SHIFTS.md`: Schedule owns list/calendar views, My Shifts, Past, Trade Board, and calendar coverage signals.
- `docs/IOS_PATTERNS.md`: iOS controls should use real `Button`s, tokenized colors, clear VoiceOver labels, and 44 pt targets.
- `docs/IOS_DEVICE_WALKTHROUGH.md`: Schedule QA already expects List/Calendar, Past, My Shifts, and Trade Board controls.
- `tasks/audit-schedule-ios.md`: Schedule is MVP-ready, but control-memory burden remains a polish gap.
- `ios/Wisconsin/Views/ScheduleView.swift`: current top toolbar uses icon-only controls for view mode, Past, My Shifts, Trade Board, and calendar subscribe.

## Scope

- Add a visible Schedule control strip above loaded list/calendar content.
- Move persistent viewing choices out of the icon-only toolbar:
  - List / Calendar mode
  - My Shifts
  - Past events for staff/admin in list mode
- Keep field actions visible and labeled:
  - Trade Board
  - Calendar subscription
- Preserve existing state, refresh, toast, sheets, haptics, scan one-tap navigation, and production-safe API behavior.

## Non-Goals

- Do not add desktop-only Week view or power-user filters to iOS.
- Do not change API payloads.
- Do not add checkout/check-in custody actions to phone Schedule.

## Checklist

- [x] Replace Schedule icon-only toolbar toggles with labeled controls.
- [x] Keep toolbar clutter lower by moving state toggles into content.
- [x] Add static contract coverage for self-describing Schedule controls.
- [x] Sync mobile, shift, walkthrough, and gaps/task docs.
- [x] Verify with focused tests, iOS drift, iOS audit, TypeScript, XcodeBuildMCP simulator build, and diff checks.

## Review

Implemented the focused clarity slice in `ios/Wisconsin/Views/ScheduleView.swift`. Loaded Schedule content now starts with a visible `View` segmented control for List/Calendar and named scope chips for `My shifts` plus staff/admin-only `Past events`. The toolbar is reserved for labeled direct actions: `Trades` with the open-trade count and `Calendar` subscription.

No API payloads changed. Scan remains one tap away in the app tab bar, and iOS still intentionally skips desktop-only Week view and power-user Schedule filters.

Verification passed: `npx vitest run tests/student-field-contracts.test.ts`, `npx tsc --noEmit`, `npm run drift:ios`, `npm run audit:ios:gaps`, `git diff --check`, and XcodeBuildMCP simulator build for scheme `Wisconsin`.
