# iOS Schedule Detail and Trade Control Clarity Plan

Created: 2026-06-03

## Goal

Make native Schedule event-detail and trade-board actions easier to understand without changing shift assignment, trade, or approval rules.

## Source Audit

- `docs/AREA_MOBILE.md`: iOS must stay student-first and action-first, with scan one tap away and staff/admin controls available without cluttering student workflows.
- `docs/AREA_SHIFTS.md`: Schedule supports staff assignment, student requests, and student shift trades.
- `docs/IOS_DEVICE_WALKTHROUGH.md`: Event detail and trade board QA centers on Assign, Request, Approve, Decline, Claim, Cancel, and Post flows.
- `tasks/audit-event-detail-ios.md`: Event detail already fixed color tokens, edit-time hardening, and accessibility labels.
- `tasks/audit-trade-board-ios.md`: Trade board already fixed status tokens, haptics, combined accessibility, and row claim labels.
- `tasks/audit-post-trade-ios.md`: Post trade already fixed haptics, spinner, Button row semantics, and selected traits.
- `ios/Wisconsin/Views/EventDetailSheet.swift`, `ios/Wisconsin/Views/Schedule/TradeBoardSheet.swift`, and `ios/Wisconsin/Views/Schedule/PostTradeSheet.swift`: primary controls still use short visible labels in dense contexts.

## Implementation Slice

- [x] Audit relevant docs, audit notes, and current Swift files.
- [x] Write this plan before edits.
- [x] Make Event Detail shift actions visibly self-describing.
- [x] Make Trade Board and Post Trade controls visibly self-describing.
- [x] Add focused source-level contract coverage.
- [x] Sync mobile, shifts, walkthrough, and gaps docs.
- [x] Run focused verification.

## Guardrails

- No API payload changes.
- Do not add desktop filters or trade-board area filtering in this slice.
- Preserve secondary/destructive actions in context menus or swipe actions.
- Preserve existing haptics, status tokens, and defensive error handling.

## Verification Plan

- [x] `npx vitest run tests/student-field-contracts.test.ts`
- [x] `npx tsc --noEmit`
- [x] `npm run drift:ios`
- [x] `npm run audit:ios:gaps`
- [x] XcodeBuildMCP simulator build
- [x] `git diff --check`

## Review

- Event Detail now uses visible `Add shift`, `Assign person`, and `Request shift` labels.
- Pending request buttons now include the person's name in visible button text.
- Trade Board now uses `Post trade`, `Claim this shift`, `Choose Shift to Trade`, and `Post Trade` labels.
- No API payloads changed.
