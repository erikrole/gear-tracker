# iOS Notifications Token Honesty Plan

Started: 2026-06-10

## Scope
Make native APNs token registration and revocation use the shared iOS API response handler, so failed `/api/devices` responses are treated as real failures and 401s trigger the global session-expired path.

## Why This Slice
The server already returns `{ success: true }` from `POST /api/devices` and `DELETE /api/devices`. The native client built both requests correctly, but sent them through raw `session.data(for:)`, bypassing shared status checks, server error decoding, and `sessionDidExpire` broadcasting.

## Checklist
- [x] Route `registerDeviceToken(_:)` through `perform` and decode `SuccessResponse`.
- [x] Route `revokeAllDeviceTokens()` through `perform` and decode `SuccessResponse`.
- [x] Add focused source-contract coverage for `/api/devices` and the native methods.
- [x] Sync `AREA_NOTIFICATIONS.md`, `AREA_MOBILE.md`, and `tasks/todo.md`.
- [x] Verify with focused tests, TypeScript as needed, iOS drift/audit checks, whitespace checks, and Wisconsin simulator build.

## Out of Scope
- Profile delivery-status UI.
- Per-device token health history.
- Changing AppDelegate fire-and-forget registration behavior.
- Changing logout semantics.
