# No-Temp-Password Onboarding Plan - 2026-06-08

## Goal
- Remove first-time temporary-password onboarding from the beta flow.
- Make first access invitation-first: an operator adds an email to the allowlist, and the user sets their own password during allowlist-gated registration.
- Keep administrator password reset available as a recovery path, not as the normal onboarding handshake.

## Source Checks
- `docs/BRIEF_ONBOARDING_V1.md`: currently defines two onboarding modes, including direct-created accounts with temporary passwords.
- `docs/DECISIONS.md`: D-029 keeps registration gated by `AllowedEmail`; D-037 currently permits direct user creation with temporary passwords.
- `docs/AREA_USERS.md`: Users owns user creation, role management, password reset, and onboarding status.
- `docs/AREA_SETTINGS.md`: Settings > Allowed Emails owns the allowlist workflow and shared onboarding dialog entry point.
- `docs/GAPS_AND_RISKS.md`: launch hardening recently closed bulk temp-password Admin row and rate-limit issues; this pivot should avoid opening a new security gap.
- `prisma/schema.prisma`: `User.passwordHash` is required, so true pre-created users without any password need a later schema/token slice.
- `src/app/api/auth/register/route.ts`: registration already creates the user from an unclaimed allowlist row and lets the user choose their password.
- `src/app/api/users/route.ts`: direct user creation currently hashes an admin-supplied password and marks `forcePasswordChange`.
- `src/app/api/users/bulk-create/route.ts`: bulk direct creation currently generates temporary passwords server-side.
- `src/components/onboarding/OnboardingDialog.tsx`: the shared Users and Allowed Emails dialog currently exposes invite, single direct-create, and bulk direct-create modes.

## Slice
- [x] Retire first-time direct temp-password onboarding.
  - `/api/users` POST should no longer create first-time users from an admin-supplied password.
  - `/api/users/bulk-create` should no longer generate temporary passwords or create users.
  - Both routes should return clear retired-flow copy after auth and role checks.
- [x] Make the shared onboarding dialog invitation-first.
  - Remove the direct-create tab, temporary-password generation, copy, and CSV handoff.
  - Keep bulk and single allowlist invitations with existing preview, duplicate, and role restrictions.
  - Copy should tell operators users set their own password at registration.
- [x] Update tests.
  - Add focused route coverage proving retired temp-password endpoints do not hash passwords or call direct-create services.
  - Update source tests so no UI calls `/api/users` or `/api/users/bulk-create` for first-time onboarding.
- [x] Sync docs.
  - Amend the onboarding brief and D-037 to state the beta path is invite-first only.
  - Update Users, Settings, and Gaps/Risks to reflect the no-temp-password pivot.

## Deferred
- Pre-created account profiles without passwords. Because `User.passwordHash` is required today, supporting "admin creates the profile now, user sets password later" needs a separate schema and setup-token design.
- Email delivery. The accepted beta flow remains manual link/copy friendly and does not require outbound email.

## Verification
- [x] `npx vitest run tests/onboarding-dialog-source.test.ts tests/users-bulk-create-route.test.ts tests/user-create-route.test.ts tests/onboarding-lifecycle.test.ts tests/allowed-emails-preview.test.ts`
- [x] `npx tsc --noEmit`
- [x] `npm run db:migrate:check`
- [x] `git diff --check`
- [x] `npx next build`

## Stop Conditions
- Stop if any unauthenticated response would reveal whether an email is registered or allowlisted.
- Stop if removing direct-create would block admin password reset recovery.
- Stop if a schema change becomes necessary for this slice; keep that as a separate migration slice.

## Review
- 2026-06-08: Plan opened after product decision to remove the temporary-password first-sign-in handshake.
- 2026-06-08: Implemented the no-temp-password onboarding pivot. `/api/users` POST and `/api/users/bulk-create` now return retired-flow responses after auth checks, the shared onboarding dialog is invite-first only, focused tests enforce no password hashing/direct-create service calls, and docs/runbook/checklists point operators to allowlist registration plus admin reset recovery.
- 2026-06-08: Verification passed: focused onboarding Vitest suite, TypeScript, migration-prefix check, whitespace check, and production Next build.
- 2026-06-08: Full release verification also passed: `npm test` passed 174 files and 1056 tests. Deployed production `dpl_AwBTqZsUvTGKbi3eTC5ar8LXNwHu`, aliased to `https://gear.erikrole.com`.
