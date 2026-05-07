# Damage Report Photos + Avatar Polish Plan

## Scope
- Add optional photo evidence to damaged/lost check-in reports.
- Keep checkout/check-in accountability owned by kiosk enforcement; do not restore scrubbed condition-photo gates.
- Defer multi-photo asset documentation.
- Add lightweight user-avatar polish without blocking roster workflows.

## Checklist
- [x] Add nullable report image storage to `CheckinItemReport`.
- [x] Accept optional report photo uploads through the check-in report endpoint.
- [x] Surface photo evidence in scan status and checklist rows.
- [x] Resize profile avatar uploads client-side before submission.
- [x] Add an admin roster cue for missing profile photos.
- [x] Sync docs and verify.

## Review
- Prisma schema generation passed after adding the report image migration.
- Prisma migrate create-only failed with a blank schema-engine error, so migration `0051_checkin_report_image_url` was added manually and verified by the migration prefix checker.
- Verification passed: `npx tsc --noEmit`, `npm run db:migrate:check`, `git diff --check`, and `npx next build`.
