# iOS Settings Detail Menus Plan

## Objective
Upgrade the first-class native Settings hub with two focused detail menus: Notifications and Account & Security. Keep backend contracts unchanged, preserve the stable `.tabItem`/`.tag` app shell, and avoid adding a partial native session manager in this slice.

## Scope
- Move notification delivery status, OS push permission recovery, pause controls, email/push channel toggles, and notification category toggles into a dedicated native Notifications destination.
- Keep the root Settings list as a scannable menu hub with honest notification status summary.
- Add Account & Security as a native destination with signed-in account identity, role, password change, confirm-password validation, and optional revocation of other sessions through the existing `/api/me/change-password` contract.
- Keep the full profile-editing and active-session list handoff available through the existing web account link.
- Update mobile/settings/notifications/users docs and focused source tests.

## Out of Scope
- New schema, migrations, or API payload changes.
- Native active-session list and per-session revocation UI.
- Native profile editing for name, phone, avatar, athletics email, title, or Slack fields.
- Any change to tab-shell architecture.

## Checklist
- [x] Root Settings has `ProfileDestination.notifications` and `ProfileDestination.accountSecurity`.
- [x] Root Notifications section links to the detail screen and no longer renders every preference control inline.
- [x] `NotificationSettingsView` owns the existing pause, channel, category, error, retry, and OS push permission controls.
- [x] `AccountSecuritySettingsView` shows current account context and submits `APIClient.shared.changePassword(currentPassword:newPassword:revokeOtherSessions:)`.
- [x] Focused Vitest source contracts prove navigation destinations, detail controls, and password-change endpoint wiring.
- [x] Docs updated: `AREA_MOBILE.md`, `AREA_SETTINGS.md`, `AREA_NOTIFICATIONS.md`, `AREA_USERS.md`, and `GAPS_AND_RISKS.md` if no new gap is opened.
- [x] Verification run: focused Vitest, `npm run drift:ios`, `npm run audit:ios:gaps`, `git diff --check`, and Wisconsin iOS simulator build.

## Review
- 2026-06-10: Shipped the native Settings detail-menu slice. Root Settings now stays a hub; Notifications owns delivery status, OS push permission recovery, pause, channel, and category controls; Account & Security owns account identity plus password change with optional other-session revocation.
- 2026-06-10: Kept full profile editing and active-session list management as web handoffs. This avoids introducing a partial native session manager and keeps the slice on existing APIs.
- 2026-06-10: Verification passed: focused Vitest settings/notification/password tests, `npm run drift:ios`, `npm run audit:ios:gaps`, `git diff --check`, and the escalated Wisconsin iOS simulator build. The sandboxed Xcode build failed before compilation on CoreSimulator/DerivedData permissions; the escalated build succeeded.
