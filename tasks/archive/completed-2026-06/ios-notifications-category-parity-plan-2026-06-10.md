# iOS Notifications Category Parity Plan

Started: 2026-06-10

## Goal
Expose the existing server-backed notification category preferences in native iOS Profile so mobile users can control the same notification types available on web without changing delivery rules.

## Scope
- [x] Confirm current docs, schema/API contract, web settings labels, and native model support.
- [x] Add category read/write helpers to `NotificationPrefsViewModel`.
- [x] Add native Profile toggles for checkout due, checkout overdue, reservation, and license expiry notifications.
- [x] Add source-contract coverage for native category parity and API defaults.
- [x] Sync mobile and notification docs plus `tasks/todo.md`.
- [x] Run focused tests, TypeScript, iOS drift/audit checks, whitespace, and iOS build verification.

## Acceptance
- Native Profile renders a `Notification types` group with the four web-backed category toggles.
- Category changes preserve unset legacy category JSON by defaulting missing native state to all enabled before saving.
- In-app inbox copy remains explicit: inbox notifications still appear regardless of category toggles.
- Contract tests pin the native model fields, view-model update path, visible labels, and server defaults.
