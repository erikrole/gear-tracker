# iOS Notifications Tap-Through Plan

Started: 2026-06-10

## Scope
Make shift-related native push notifications carry enough context for iOS to route users to the relevant Schedule event, then prove that routing contract with focused source tests.

## Why This Slice
The inbox notification records already include `eventId` for shift gear-up and schedule-change notifications, and iOS already stores `pendingPushEventId` from notification taps. The missing pieces are the APNs payload itself and a tab-shell handoff to Schedule when that pending event appears.

## Checklist
- [x] Add shift APNs payloads with `eventId`, `assignmentId`, and `shiftId`.
- [x] Route pending event pushes to the Schedule tab without clearing the event before `ScheduleView` consumes it.
- [x] Add focused source-contract coverage for server payloads and native tab routing.
- [x] Sync `AREA_NOTIFICATIONS.md`, `AREA_MOBILE.md`, and `tasks/todo.md`.
- [x] Verify with focused tests, TypeScript, iOS drift/audit checks, whitespace checks, and Wisconsin simulator build.

## Out of Scope
- Token registration delivery-status UI.
- Native category-level notification preferences.
- Badge-award push fanout.
- Reworking the existing booking push routing model.
