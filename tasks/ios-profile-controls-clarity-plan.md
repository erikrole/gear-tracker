# iOS Profile Controls Clarity Plan

Created: 2026-06-03

## Goal

Make Profile, Notifications, Appearance, and My Availability controls easier to understand in the field without adding desktop-style settings depth to iOS.

## Source Audit

- `docs/AREA_MOBILE.md`: mobile stays student-first, action-first, and avoids desktop power-user clutter.
- `docs/AREA_USERS.md`: students can manage only their own availability blocks; staff/admin can manage any user.
- `docs/AREA_SHIFTS.md` and `docs/BRIEF_STUDENT_AVAILABILITY_V1.md`: availability is advisory conflict context, not a scheduling blocker.
- `docs/AREA_NOTIFICATIONS.md`: notifications are action triggers; user preferences must preserve in-app inbox behavior and channel controls.
- `docs/IOS_DEVICE_WALKTHROUGH.md`: Profile QA already expects pause controls, email/push toggles, appearance choice, and availability management.
- `tasks/audit-profile-ios.md` and `tasks/audit-notifications-sheet-ios.md`: Profile notification preferences are shipped, but they remain a high-frequency mobile control surface.
- `ios/Wisconsin/Views/AppTabView.swift`: Profile, notification preferences, appearance, and availability editor live in one file.

## Implementation Slice

- [x] Audit relevant docs, audits, and current `AppTabView`.
- [x] Write this plan before edits.
- [x] Make Profile notification and availability controls self-describing with visible action words.
- [x] Add focused source-level contract coverage.
- [x] Sync mobile, notification, shift, and walkthrough docs.
- [x] Run focused verification.

## Guardrails

- Keep Profile as a compact sheet, not a desktop settings clone.
- Do not add new API fields or web payload contracts in this slice.
- Preserve defensive notification preference behavior and push-permission recovery.
- Keep student availability self-service scoped to the signed-in student.
- Keep scan and daily work tabs unchanged.

## Verification Plan

- [x] `npx vitest run tests/student-field-contracts.test.ts`
- [x] `npx tsc --noEmit`
- [x] `npm run drift:ios`
- [x] `npm run audit:ios:gaps`
- [x] XcodeBuildMCP simulator build
- [x] `git diff --check`

## Review

- Profile notification controls now read Pause alerts, Email alerts, and Push alerts instead of relying on shorter settings labels.
- My Availability now has a visible Add availability block row for existing availability lists and a labeled Add block toolbar action.
- No API payloads changed.
