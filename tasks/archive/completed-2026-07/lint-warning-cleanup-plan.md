# Lint Warning Cleanup Plan - 2026-06-19

## Goal

Reduce the lint warning backlog in small, safe batches without weakening lint rules or churning unrelated product code.

## Current Baseline

Initial baseline: `npm run lint` exited 0 with 512 warnings:

- 389 `@typescript-eslint/no-explicit-any`
- 88 `@typescript-eslint/no-unused-vars`
- 27 `react-hooks/exhaustive-deps`
- 5 `@next/next/no-img-element`

Highest-warning files from the baseline:

- `tests/transaction-safety.test.ts` - 33
- `src/components/ui/heatmap.tsx` - 27
- `tests/availability.test.ts` - 27
- `tests/categories-route.test.ts` - 20
- `tests/bulk-scan-race.test.ts` - 19

After Slice 1: `npm run lint:summary` exits 0 with 463 warnings:

- 389 `@typescript-eslint/no-explicit-any`
- 42 `@typescript-eslint/no-unused-vars`
- 27 `react-hooks/exhaustive-deps`
- 5 `@next/next/no-img-element`

After Slice 2: `npm run lint:summary` exits 0 with 436 warnings:

- 389 `@typescript-eslint/no-explicit-any`
- 15 `@typescript-eslint/no-unused-vars`
- 27 `react-hooks/exhaustive-deps`
- 5 `@next/next/no-img-element`

After Slice 3: `npm run lint:summary` exits 0 with 431 warnings:

- 389 `@typescript-eslint/no-explicit-any`
- 15 `@typescript-eslint/no-unused-vars`
- 27 `react-hooks/exhaustive-deps`
- 0 `@next/next/no-img-element`

After Slice 4: `npm run lint` exits 0 with 405 warnings:

- 389 `@typescript-eslint/no-explicit-any`
- 15 `@typescript-eslint/no-unused-vars`
- 0 `react-hooks/exhaustive-deps`
- 1 unused eslint-disable directive

After Slice 5: `npm run lint` exits 0 with 343 warnings:

- 330 `@typescript-eslint/no-explicit-any`
- 13 `@typescript-eslint/no-unused-vars`
- 0 `react-hooks/exhaustive-deps`
- 0 unused eslint-disable directives

After Slice 6: `npm run lint` exits 0 with 286 warnings:

- 275 `@typescript-eslint/no-explicit-any`
- 11 `@typescript-eslint/no-unused-vars`
- 0 `react-hooks/exhaustive-deps`
- 0 unused eslint-disable directives

After Slice 7: `npm run lint` exits 0 with 254 warnings:

- 243 `@typescript-eslint/no-explicit-any`
- 11 `@typescript-eslint/no-unused-vars`
- 0 `react-hooks/exhaustive-deps`
- 0 unused eslint-disable directives

After Slice 8: `npm run lint` exits 0 with 228 warnings:

- 218 `@typescript-eslint/no-explicit-any`
- 10 `@typescript-eslint/no-unused-vars`
- 0 `react-hooks/exhaustive-deps`
- 0 unused eslint-disable directives

After Slice 9: `npm run lint` exits 0 with 213 warnings:

- 203 `@typescript-eslint/no-explicit-any`
- 10 `@typescript-eslint/no-unused-vars`
- 0 `react-hooks/exhaustive-deps`
- 0 unused eslint-disable directives

After Slice 10: `npm run lint:summary` exits 0 with 185 warnings:

- 176 `@typescript-eslint/no-explicit-any`
- 9 `@typescript-eslint/no-unused-vars`
- 0 `react-hooks/exhaustive-deps`
- 0 unused eslint-disable directives

After Slice 11: `npm run lint:summary` exits 0 with 155 warnings:

- 146 `@typescript-eslint/no-explicit-any`
- 9 `@typescript-eslint/no-unused-vars`
- 0 `react-hooks/exhaustive-deps`
- 0 unused eslint-disable directives

After Slice 12: `npm run lint:summary` exits 0 with 133 warnings:

- 124 `@typescript-eslint/no-explicit-any`
- 9 `@typescript-eslint/no-unused-vars`
- 0 `react-hooks/exhaustive-deps`
- 0 unused eslint-disable directives

After Slice 13: `npm run lint:summary` exits 0 with 117 warnings:

- 108 `@typescript-eslint/no-explicit-any`
- 9 `@typescript-eslint/no-unused-vars`
- 0 `react-hooks/exhaustive-deps`
- 0 unused eslint-disable directives

After Slice 14: `npm run lint:summary` exits 0 with 104 warnings:

- 95 `@typescript-eslint/no-explicit-any`
- 9 `@typescript-eslint/no-unused-vars`
- 0 `react-hooks/exhaustive-deps`
- 0 unused eslint-disable directives

After Slice 15: `npm run lint:summary` exits 0 with 93 warnings:

- 85 `@typescript-eslint/no-explicit-any`
- 8 `@typescript-eslint/no-unused-vars`
- 0 `react-hooks/exhaustive-deps`
- 0 unused eslint-disable directives

After Slice 16: `npm run lint:summary` exits 0 with 78 warnings:

- 70 `@typescript-eslint/no-explicit-any`
- 8 `@typescript-eslint/no-unused-vars`
- 0 `react-hooks/exhaustive-deps`
- 0 unused eslint-disable directives

After Slice 17: `npm run lint:summary` exits 0 with 68 warnings:

- 64 `@typescript-eslint/no-explicit-any`
- 4 `@typescript-eslint/no-unused-vars`
- 0 `react-hooks/exhaustive-deps`
- 0 unused eslint-disable directives

After Slice 18: `npm run lint:summary` exits 0 with 52 warnings:

- 51 `@typescript-eslint/no-explicit-any`
- 1 `@typescript-eslint/no-unused-vars`
- 0 `react-hooks/exhaustive-deps`
- 0 unused eslint-disable directives

After Slice 19: `npm run lint:summary` exits 0 with 46 warnings:

- 45 `@typescript-eslint/no-explicit-any`
- 1 `@typescript-eslint/no-unused-vars`
- 0 `react-hooks/exhaustive-deps`
- 0 unused eslint-disable directives

After Slice 20: `npm run lint:summary` exits 0 with 44 warnings:

- 44 `@typescript-eslint/no-explicit-any`
- 0 `@typescript-eslint/no-unused-vars`
- 0 `react-hooks/exhaustive-deps`
- 0 unused eslint-disable directives

After Slice 21: `npm run lint:summary` exits 0 with 36 warnings:

- 36 `@typescript-eslint/no-explicit-any`
- 0 `@typescript-eslint/no-unused-vars`
- 0 `react-hooks/exhaustive-deps`
- 0 unused eslint-disable directives

After Slice 22: `npm run lint:summary` exits 0 with 28 warnings:

- 28 `@typescript-eslint/no-explicit-any`
- 0 `@typescript-eslint/no-unused-vars`
- 0 `react-hooks/exhaustive-deps`
- 0 unused eslint-disable directives

After Slice 23: `npm run lint:summary` exits 0 with 20 warnings:

- 20 `@typescript-eslint/no-explicit-any`
- 0 `@typescript-eslint/no-unused-vars`
- 0 `react-hooks/exhaustive-deps`
- 0 unused eslint-disable directives

After Slice 24: `npm run lint:summary` exits 0 with 8 warnings:

- 8 `@typescript-eslint/no-explicit-any`
- 0 `@typescript-eslint/no-unused-vars`
- 0 `react-hooks/exhaustive-deps`
- 0 unused eslint-disable directives

After Slice 25: `npm run lint:summary` exits 0 with 0 warnings.

## Plan

- [x] Slice 1: remove source-file unused variables and unused eslint-disable comments.
- [x] Slice 2: fix `src/components/ui/heatmap.tsx` unused destructuring noise without changing its public API.
- [x] Slice 3: replace raw `<img>` warnings only where `next/image` preserves the current modal/layout behavior.
- [x] Slice 4: handle React hook dependency warnings one file at a time with behavior-preserving tests or source checks.
- [x] Slice 5: reduce test-only `no-explicit-any` by adding small typed mock helpers in the highest-count test files.
- [x] Slice 6: continue test-only `no-explicit-any` cleanup in `categories-route`, `bulk-scan-race`, and `rbac`.
- [x] Slice 7: continue test-only `no-explicit-any` cleanup in API hardening wave tests.
- [x] Slice 8: continue test-only `no-explicit-any` cleanup in `allowed-emails` and `api-hardening-wave12`.
- [x] Slice 9: continue test-only `no-explicit-any` cleanup in `reports-service`.
- [x] Slice 10: continue test-only `no-explicit-any` cleanup in `role-escalation` and `sport-configs`.
- [x] Slice 11: continue test-only `no-explicit-any` cleanup in `kiosk-bulk-detail-routes` and `settings-routes`.
- [x] Slice 12: continue test-only `no-explicit-any` cleanup in `badges-routes` and `kiosk-checkin-routes`.
- [x] Slice 13: continue test-only `no-explicit-any` cleanup in `onboarding-lifecycle` and `users-route`.
- [x] Slice 14: continue test-only `no-explicit-any` cleanup in `reservation-event-link-preservation` and `asset-action-hardening`.
- [x] Slice 15: continue test-only `no-explicit-any` cleanup in `booking-lifecycle-route-contract` and `auth-hardening`.
- [x] Slice 16: continue test-only `no-explicit-any` cleanup in `battery-ops-route`, `bulk-unit-adjustment-routes`, and `calendar-source-sync-lock`.
- [x] Slice 17: continue test-only `no-explicit-any` cleanup in `calendar-travel-auth` and remove same-file unused result locals in `shift-assignments`.
- [x] Slice 18: continue test-only `no-explicit-any` cleanup in `bulk-unit-label-export-route`, `create-asset-route`, `extend-booking`, and `schedule-date-validation`.
- [x] Slice 19: continue test-only `no-explicit-any` cleanup in `calendar-event-visibility-route` and `calendar-sync-health`.
- [x] Slice 20: remove the final source-file `no-explicit-any` warning in `src/lib/badges/index.ts` and the final unused-var warning in `calendar-sync`.
- [x] Slice 21: continue test-only `no-explicit-any` cleanup in `allowed-emails-preview`, `api-image-search`, `badges-award-route`, and `booking-list-routes`.
- [x] Slice 22: continue test-only `no-explicit-any` cleanup in `checkin-bulk-item`, `checkin-items`, `checkout-rules`, and `create-booking`.
- [x] Slice 23: continue test-only `no-explicit-any` cleanup in `drafts-route`, `form-options-bulk-counts`, `kiosk-only-custody-routes`, and `mark-checkout-completed`.
- [x] Slice 24: continue test-only `no-explicit-any` cleanup in `notification-nudge`, `shift-generation`, `shift-ics-feed`, `shift-trades`, `user-avatar-route`, and `user-pii-scope`.
- [x] Slice 25: remove the final `no-explicit-any` warnings in badge, bulk-unit scan, booking cancel/update, import, reports, and user-create tests.

## Guardrails

- Do not disable lint rules globally.
- Do not bulk replace `any` with `unknown` unless callers narrow the value correctly.
- Do not change hook dependency arrays without checking whether the callback/effect intentionally captures a stable value.
- Do not convert modal/gallery `<img>` usage to `next/image` if it breaks dynamic remote URLs, sizing, or download behavior.

## Verification

- [x] `npm run lint:summary`
- [x] `npm run lint`
- [x] Focused tests for any behavior-bearing touched files.
- [x] `npx tsc --noEmit --pretty false`
- [x] `git diff --check`

## Review

- 2026-06-19: Slice 1 removed unused imports, stale props, dead destructures, and unused eslint-disable comments across source files. `@typescript-eslint/no-unused-vars` dropped from 88 to 42. Remaining source unused warnings are isolated to `src/components/ui/heatmap.tsx`, which is Slice 2; the rest are test cleanup. Verification: `npm run lint:summary`, `npm run lint`, `npx tsc --noEmit --pretty false`, `npm test`, `npm run build:app`, `npm run verify:docs`, and `git diff --check`.
- 2026-06-19: Slice 2 replaced the heatmap root prop-stripping destructures with an explicit internal-prop filter, preserving HTML prop pass-through and the public heatmap API. `@typescript-eslint/no-unused-vars` dropped from 42 to 15, leaving only test-side unused-variable warnings. Verification: `npm run lint:summary`, `npx tsc --noEmit --pretty false`, `npm test`, `npm run build:app`, `npm run verify:docs`, and `git diff --check`.
- 2026-06-19: Slice 3 converted the remaining bounded preview and thumbnail `<img>` elements to `next/image` with `unoptimized` for blob and arbitrary remote URLs. `@next/next/no-img-element` dropped from 5 to 0. Verification: `npm run lint:summary`, `npx tsc --noEmit --pretty false`, `npm test`, `npm run build:app`, `npm run verify:docs`, and `git diff --check`.
- 2026-06-19: Slice 4 fixed all `react-hooks/exhaustive-deps` warnings by stabilizing derived fallback arrays, listing real callback/effect dependencies, and preserving the equipment picker's cache invalidation behavior. Hook warnings dropped from 27 to 0. Verification: `npm run lint:summary`, `npm run lint`, `npx tsc --noEmit --pretty false`, `npm test`, `npm run build:app`, `npm run verify:docs`, and `git diff --check`.
- 2026-06-19: Slice 5 replaced high-count test `any` casts in `transaction-safety` and `availability` with Prisma enums, typed transaction-call globals, and one typed availability transaction adapter. `@typescript-eslint/no-explicit-any` dropped from 389 to 330, and the stale transaction eslint-disable warning was removed. Verification: `npm run lint:summary`, `npm run lint`, `npx vitest run tests/transaction-safety.test.ts tests/availability.test.ts`, `npx eslint tests/transaction-safety.test.ts tests/availability.test.ts tests/_helpers/mock-db.ts`, `npx tsc --noEmit --pretty false`, `npm test`, `npm run build:app`, `npm run verify:docs`, and `git diff --check`.
- 2026-06-19: Slice 6 removed explicit `any` from `categories-route`, `bulk-scan-race`, and `rbac` tests with Prisma enums, typed route response rows, typed transaction mock access, and unknown-based error narrowing. `@typescript-eslint/no-explicit-any` dropped from 330 to 275, and unused-variable warnings dropped from 13 to 11. Verification: `npm run lint:summary`, `npm run lint`, `npx vitest run tests/categories-route.test.ts tests/bulk-scan-race.test.ts tests/rbac.test.ts`, `npx eslint tests/categories-route.test.ts tests/bulk-scan-race.test.ts tests/rbac.test.ts`, `npx tsc --noEmit --pretty false`, `npm test`, `npm run build:app`, `npm run verify:docs`, and `git diff --check`.
- 2026-06-19: Slice 7 removed explicit `any` from `api-hardening-wave11` and `api-hardening-wave13` with Prisma enums, typed mocked service results, and a typed transaction-options global probe. `@typescript-eslint/no-explicit-any` dropped from 275 to 243. Verification: `npm run lint:summary`, `npm run lint`, `npx vitest run tests/api-hardening-wave11.test.ts tests/api-hardening-wave13.test.ts`, `npx eslint tests/api-hardening-wave11.test.ts tests/api-hardening-wave13.test.ts`, `npx tsc --noEmit --pretty false`, `npm test`, `npm run build:app`, `npm run verify:docs`, and `git diff --check`.
- 2026-06-19: Slice 8 removed explicit `any` from `allowed-emails` and `api-hardening-wave12` with Prisma enums, typed allowlist/user fixtures, typed derived-status mock clauses, and a typed transaction-options global probe. `@typescript-eslint/no-explicit-any` dropped from 243 to 218, and unused-variable warnings dropped from 11 to 10. Verification: `npm run lint:summary`, `npm run lint`, `npx vitest run tests/allowed-emails.test.ts tests/api-hardening-wave12.test.ts`, `npx eslint tests/allowed-emails.test.ts tests/api-hardening-wave12.test.ts`, `npx tsc --noEmit --pretty false`, `npm test`, `npm run build:app`, `npm run verify:docs`, and `git diff --check`.
- 2026-06-19: Slice 9 removed explicit `any` from `reports-service` by adding typed Prisma mock-result helpers for asset, booking, audit, and bulk-unit report fixtures. `@typescript-eslint/no-explicit-any` dropped from 218 to 203. Verification: `npm run lint:summary`, `npm run lint`, `npx vitest run tests/reports-service.test.ts`, `npx eslint tests/reports-service.test.ts`, `npx tsc --noEmit --pretty false`, `npm test`, `npm run build:app`, `npm run verify:docs`, and `git diff --check`.
- 2026-06-19: Slice 10 removed explicit `any` from `role-escalation` and `sport-configs` tests with Prisma enums, typed auth/user role fixtures, typed sport config mock transaction access, and typed Prisma mock-result helpers. This also exposed and fixed invalid shift-area test fixtures that were using `FIELD` and `COURT` instead of real `ShiftArea` values. `@typescript-eslint/no-explicit-any` dropped from 203 to 176, and unused-variable warnings dropped from 10 to 9. Verification: `npm run lint:summary`, `npx vitest run tests/role-escalation.test.ts tests/sport-configs.test.ts`, `npx eslint tests/role-escalation.test.ts tests/sport-configs.test.ts`, `npx tsc --noEmit --pretty false`, and `git diff --check`.
- 2026-06-19: Slice 11 removed explicit `any` from `kiosk-bulk-detail-routes` and `settings-routes` with a typed kiosk route wrapper, promise-backed route params, and typed Prisma mock-result helpers for settings fixtures. `@typescript-eslint/no-explicit-any` dropped from 176 to 146. Verification: `npm run lint:summary`, `npx vitest run tests/kiosk-bulk-detail-routes.test.ts tests/settings-routes.test.ts`, `npx eslint tests/kiosk-bulk-detail-routes.test.ts tests/settings-routes.test.ts`, `npx tsc --noEmit --pretty false`, and `git diff --check`.
- 2026-06-19: Slice 12 removed explicit `any` from `badges-routes` and `kiosk-checkin-routes` with typed badge fixture helpers, a typed kiosk route wrapper, promise-backed route params, a typed kiosk check-in transaction adapter, and typed `vi.importActual` usage. `@typescript-eslint/no-explicit-any` dropped from 146 to 124. Verification: `npm run lint:summary`, `npx vitest run tests/badges-routes.test.ts tests/kiosk-checkin-routes.test.ts`, `npx eslint tests/badges-routes.test.ts tests/kiosk-checkin-routes.test.ts`, `npx tsc --noEmit --pretty false`, and `git diff --check`.
- 2026-06-19: Slice 13 removed explicit `any` from `onboarding-lifecycle` and `users-route` with typed transaction narrowing and typed Prisma mock-result helpers for onboarding, user listing, group counts, updates, and direct-report lookups. `@typescript-eslint/no-explicit-any` dropped from 124 to 108. Verification: `npm run lint:summary`, `npx vitest run tests/onboarding-lifecycle.test.ts tests/users-route.test.ts`, `npx eslint tests/onboarding-lifecycle.test.ts tests/users-route.test.ts`, `npx tsc --noEmit --pretty false`, and `git diff --check`.
- 2026-06-19: Slice 14 removed explicit `any` from `reservation-event-link-preservation` and `asset-action-hardening` with Prisma role enums, typed reservation/create-booking fixtures, typed asset/favorite mock results, and a typed transaction-options global probe. `@typescript-eslint/no-explicit-any` dropped from 108 to 95. Verification: `npm run lint:summary`, `npx vitest run tests/reservation-event-link-preservation.test.ts tests/asset-action-hardening.test.ts`, `npx eslint tests/reservation-event-link-preservation.test.ts tests/asset-action-hardening.test.ts`, `npx tsc --noEmit --pretty false`, and `git diff --check`.
- 2026-06-19: Slice 15 removed explicit `any` from `booking-lifecycle-route-contract` and `auth-hardening` with Prisma role enums, typed booking service mock results, typed password/session mock results, and by dropping the unused transaction options argument from the auth hardening mock. `@typescript-eslint/no-explicit-any` dropped from 95 to 85, and unused-variable warnings dropped from 9 to 8. Verification: `npm run lint:summary`, `npx vitest run tests/booking-lifecycle-route-contract.test.ts tests/auth-hardening.test.ts`, `npx eslint tests/booking-lifecycle-route-contract.test.ts tests/auth-hardening.test.ts`, `npx tsc --noEmit --pretty false`, and `git diff --check`.
- 2026-06-19: Slice 16 removed explicit `any` from `battery-ops-route`, `bulk-unit-adjustment-routes`, and `calendar-source-sync-lock` with Prisma role/unit-status enums and typed mocked Prisma result helpers. `@typescript-eslint/no-explicit-any` dropped from 85 to 70. Verification: `npm run lint:summary`, `npx vitest run tests/battery-ops-route.test.ts tests/bulk-unit-adjustment-routes.test.ts tests/calendar-source-sync-lock.test.ts`, `npx eslint tests/battery-ops-route.test.ts tests/bulk-unit-adjustment-routes.test.ts tests/calendar-source-sync-lock.test.ts`, and `npx tsc --noEmit --pretty false`.
- 2026-06-19: Slice 17 removed explicit `any` from `calendar-travel-auth` with Prisma role enums and typed route-result helpers, then removed four unused result locals exposed in `shift-assignments`. `@typescript-eslint/no-explicit-any` dropped from 70 to 64, and unused-variable warnings dropped from 8 to 4. Verification: `npm run lint:summary`, `npx vitest run tests/calendar-travel-auth.test.ts tests/shift-assignments.test.ts`, `npx eslint tests/calendar-travel-auth.test.ts tests/shift-assignments.test.ts`, and `npx tsc --noEmit --pretty false`.
- 2026-06-19: Slice 18 removed explicit `any` from `bulk-unit-label-export-route`, `create-asset-route`, `extend-booking`, and `schedule-date-validation` with Prisma role/unit-status enums, typed mocked route results, and typed mock transaction handles. It also removed three unused factory imports in `extend-booking`. `@typescript-eslint/no-explicit-any` dropped from 64 to 51, and unused-variable warnings dropped from 4 to 1. Verification: `npm run lint:summary`, `npx vitest run tests/bulk-unit-label-export-route.test.ts tests/create-asset-route.test.ts tests/extend-booking.test.ts tests/schedule-date-validation.test.ts`, `npx eslint tests/bulk-unit-label-export-route.test.ts tests/create-asset-route.test.ts tests/extend-booking.test.ts tests/schedule-date-validation.test.ts`, and `npx tsc --noEmit --pretty false`.
- 2026-06-19: Slice 19 removed explicit `any` from `calendar-event-visibility-route` and `calendar-sync-health` with Prisma role enums, typed mock DB transaction handles, and typed mock result helpers. `@typescript-eslint/no-explicit-any` dropped from 51 to 45. Verification: `npm run lint:summary`, `npx vitest run tests/calendar-event-visibility-route.test.ts tests/calendar-sync-health.test.ts`, `npx eslint tests/calendar-event-visibility-route.test.ts tests/calendar-sync-health.test.ts`, and `npx tsc --noEmit --pretty false`.
- 2026-06-19: Slice 20 removed the final source-file explicit `any` by making the badge safe-call wrapper infer each evaluator argument tuple, and removed the final unused import from `calendar-sync`. `@typescript-eslint/no-explicit-any` dropped from 45 to 44, and unused-variable warnings dropped from 1 to 0. Verification: `npm run lint:summary`, `npx vitest run tests/calendar-sync.test.ts tests/badges-service.test.ts tests/badge-evaluator.test.ts`, `npx eslint src/lib/badges/index.ts tests/calendar-sync.test.ts`, and `npx tsc --noEmit --pretty false`.
- 2026-06-19: Slice 21 removed explicit `any` from `allowed-emails-preview`, `api-image-search`, `badges-award-route`, and `booking-list-routes` with Prisma role enums and typed mocked route/service result helpers. `@typescript-eslint/no-explicit-any` dropped from 44 to 36. Verification: `npm run lint:summary`, `npx vitest run tests/allowed-emails-preview.test.ts tests/api-image-search.test.ts tests/badges-award-route.test.ts tests/booking-list-routes.test.ts`, `npx eslint tests/allowed-emails-preview.test.ts tests/api-image-search.test.ts tests/badges-award-route.test.ts tests/booking-list-routes.test.ts`, and `npx tsc --noEmit --pretty false`.
- 2026-06-19: Slice 22 removed explicit `any` from `checkin-bulk-item`, `checkin-items`, `checkout-rules`, and `create-booking` with typed mock transaction handles, Prisma booking enums, and explicit audit-call assertions. `@typescript-eslint/no-explicit-any` dropped from 36 to 28. Verification: `npm run lint:summary`, `npx vitest run tests/checkin-bulk-item.test.ts tests/checkin-items.test.ts tests/checkout-rules.test.ts tests/create-booking.test.ts`, `npx eslint tests/checkin-bulk-item.test.ts tests/checkin-items.test.ts tests/checkout-rules.test.ts tests/create-booking.test.ts`, and `npx tsc --noEmit --pretty false`.
- 2026-06-19: Slice 23 removed explicit `any` from `drafts-route`, `form-options-bulk-counts`, `kiosk-only-custody-routes`, and `mark-checkout-completed` with Prisma role enums, typed mock route results, and typed mock transaction handles. `@typescript-eslint/no-explicit-any` dropped from 28 to 20. Verification: `npm run lint:summary`, `npx vitest run tests/drafts-route.test.ts tests/form-options-bulk-counts.test.ts tests/kiosk-only-custody-routes.test.ts tests/mark-checkout-completed.test.ts`, `npx eslint tests/drafts-route.test.ts tests/form-options-bulk-counts.test.ts tests/kiosk-only-custody-routes.test.ts tests/mark-checkout-completed.test.ts`, and `npx tsc --noEmit --pretty false`.
- 2026-06-19: Slice 24 removed explicit `any` from `notification-nudge`, `shift-generation`, `shift-ics-feed`, `shift-trades`, `user-avatar-route`, and `user-pii-scope` with Prisma role enums, typed mock DB handles, and typed mocked Prisma result helpers. `@typescript-eslint/no-explicit-any` dropped from 20 to 8. Verification: `npm run lint:summary`, `npx vitest run tests/notification-nudge.test.ts tests/shift-generation.test.ts tests/shift-ics-feed.test.ts tests/shift-trades.test.ts tests/user-avatar-route.test.ts tests/user-pii-scope.test.ts`, `npx eslint tests/notification-nudge.test.ts tests/shift-generation.test.ts tests/shift-ics-feed.test.ts tests/shift-trades.test.ts tests/user-avatar-route.test.ts tests/user-pii-scope.test.ts`, and `npx tsc --noEmit --pretty false`.
- 2026-06-19: Slice 25 removed the final explicit `any` warnings from `badge-evaluator`, `bulk-unit-kiosk-scans`, `cancel-booking`, `import-route`, `reports-audit-export-route`, `reports-routes`, `update-booking`, and `user-create-route` with typed transaction/service parameters and Prisma role enums. `npm run lint:summary` now reports 0 warnings. Verification: `npm run lint:summary`, `npx vitest run tests/badge-evaluator.test.ts tests/bulk-unit-kiosk-scans.test.ts tests/cancel-booking.test.ts tests/import-route.test.ts tests/reports-audit-export-route.test.ts tests/reports-routes.test.ts tests/update-booking.test.ts tests/user-create-route.test.ts`, `npx eslint tests/badge-evaluator.test.ts tests/bulk-unit-kiosk-scans.test.ts tests/cancel-booking.test.ts tests/import-route.test.ts tests/reports-audit-export-route.test.ts tests/reports-routes.test.ts tests/update-booking.test.ts tests/user-create-route.test.ts`, and `npx tsc --noEmit --pretty false`.
