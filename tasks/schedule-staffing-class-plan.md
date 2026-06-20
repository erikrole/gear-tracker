# Schedule Staffing Class Plan

Last updated: 2026-06-20

## Scope

Add an explicit scheduling worker class for users so app permission role and Staff/Student scheduling identity can diverge.

## Checklist

- [x] Add `User.staffingType` schema field and migration backfilled from current role.
- [x] Add shared scheduling-class helpers and wire Schedule display/routing/scoring/export logic to `staffingType`.
- [x] Keep authorization, onboarding role invitations, and navigation on `User.role`.
- [x] Surface editable Scheduling class on user detail for staff/admin-managed profiles.
- [x] Update focused regression tests, Schedule docs, gaps, lessons, and codemaps.
- [x] Run local schema checks, focused Vitest, TypeScript, docs verification, whitespace, and app build.
- [ ] Deploy pending migration and rerun live migration health.

## Review

- 2026-06-20: Explicit Schedule worker-class model implemented locally. `User.staffingType` now backs Staff/Student scheduling labels and routing while `User.role` remains the permission source. Verification passed with `npx prisma format`, `npx prisma generate`, `npx prisma validate`, `npm run db:migrate:check`, focused Vitest schedule tests, `npx tsc --noEmit`, `npm run codemap`, `npm run verify:docs`, `git diff --check`, and `npm run build:app`. Live migration health reached Neon and reported `0082_user_staffing_type` pending; `npm run db:migrate:deploy` was blocked by the approval system before execution, so deploy plus final health remain open.
