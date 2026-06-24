# Hidden Smoke Users Plan

## Scope

Keep smoke/test identities out of daily production use while preserving the ability to authenticate them for verification.

## Slice 1 - Roster And Picker Visibility

- [x] Add an additive `User.hiddenFromRoster` schema field and local migration.
- [x] Add a shared server helper for hidden-user visibility and internal-operator access.
- [x] Exclude hidden users from `/api/users`, `/api/users/export`, form-options people pickers, kiosk user selection, and non-internal direct profile reads.
- [x] Add focused route/helper coverage for normal operators, internal opt-in reads, exports, and direct lookup.
- [x] Sync Settings docs and Gaps/Risks.
- [x] Run focused tests, Prisma validation, migration-prefix check, TypeScript, docs/codemap, whitespace, and app build.

## Slice 2 - Owner-Only Roster Opt-In

- [x] Expose the current user's hidden-user visibility capability from `/api/me`.
- [x] Add an owner-only `/users` filter that sends `includeHidden=1` only for configured internal operators.
- [x] Carry the opt-in through roster export links so owner exports match the visible roster.
- [x] Add focused API and source-contract coverage for the UI gate.
- [x] Sync Settings docs and task review notes.
- [x] Run focused tests, TypeScript, docs/codemap, whitespace, and app build.

## Slice 3 - Disposable Hidden User Cleanup

- [x] Extract user deactivation side effects into a reusable service used by normal user edits and cleanup.
- [x] Add an internal-operator-only cleanup endpoint with dry-run default, TTL, and batch limit controls.
- [x] Deactivate eligible hidden users instead of deleting them, preserving audit and booking history.
- [x] Add focused coverage for internal access, dry-run behavior, apply behavior, and non-owner rejection.
- [x] Sync Settings docs, Gaps/Risks, and task review notes.
- [x] Run focused tests, TypeScript, docs/codemap, whitespace, and app build.

## Review

- 2026-06-24: Slice 1 shipped locally. Added `User.hiddenFromRoster` with migration `0083_hide_smoke_users`, indexed active/hidden roster reads, and added `INTERNAL_OPERATOR_EMAILS` as the opt-in owner gate. Default `/api/users`, `/api/users/export`, form-options people pickers, kiosk user selection, and non-internal direct profile reads now exclude hidden users; hidden users can still authenticate and read their own profile. Verification passed with focused hidden-user and sport-code route Vitest, Prisma format/generate/validate, migration-prefix check, TypeScript, docs/codemap check, whitespace check, and `npm run build:app`. Live migration health/deploy was not run because this slice only creates the local migration; applying it to Neon remains a separate deploy step.
- 2026-06-24: Slice 2 shipped locally. `/api/me` now returns `canViewHiddenUsers` from the same `INTERNAL_OPERATOR_EMAILS` gate, `/users` renders an owner-only "Show hidden test users" filter, and roster export carries `includeHidden=1` only when that owner-visible filter is active. Non-owners with a stale `?includeHidden=1` URL have it cleared after `/api/me` resolves, and their API requests keep the default hidden-user exclusion. Verification passed with focused hidden-user Vitest, TypeScript, codemap regeneration, docs check, whitespace check, and `npm run build:app`.
- 2026-06-24: Slice 3 shipped locally. User deactivation side effects now live in `deactivateUserWithCleanup`, and `POST /api/users/hidden-cleanup` lets configured internal operators dry-run or apply age-based cleanup for active `hiddenFromRoster` users. Cleanup deactivates users instead of deleting them, preserves booking/audit history, clears sessions through the shared deactivation path, and records `hidden_smoke_user_cleanup_deactivated` audit entries when applied. Verification passed with hidden-user cleanup/visibility Vitest, API wrapper contract Vitest, TypeScript, codemap regeneration, docs check, whitespace check, and `npm run build:app`.

## Deferred

- Automatic scheduled cleanup for disposable smoke records.
- Broader sweep of Schedule candidate pickers, reports, and notification fan-out if smoke identities need exclusion beyond people/roster surfaces.

## Stop Conditions

- Stop if the migration generator reports drift or cannot create a local migration.
- Stop if the visibility helper would change normal authentication or deactivation semantics.
- Stop if hidden users cannot still view their own profile after signing in.
