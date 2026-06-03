# Onboarding Flow Plan - 2026-06-03

## Goal
- Make onboarding first-class, bulk-friendly, and secure: staff/admin can onboard a class of students or a staff cohort in one guided workflow, users can complete first sign-in on web or iOS, and unauthorized people still cannot gain access.

## Source Checks
- `docs/AREA_USERS.md`: Users owns role hierarchy, staff/admin user creation, role management, server authorization, audit logging, and the current registration-gating changelog.
- `docs/AREA_SETTINGS.md`: Settings > Allowed Emails is the existing admin-managed registration gate; staff can add students, admins can add staff/students, and claimed rows are retained for audit.
- `docs/AREA_MOBILE.md`: Mobile must be first-class, student-first, and role-adaptive; iOS login audit previously kept registration web-only behind AllowedEmail.
- `docs/DECISIONS.md`: D-011 fixes role inheritance; D-029 fixes admin-managed email allowlisting as the registration gate.
- `docs/GAPS_AND_RISKS.md`: No open onboarding gap exists today, but prior auth gaps around forced password change and allowed-email enumeration are closed and must not regress.
- `docs/BRIEF_*`: Existing briefs cover escalation, kits, multi-event booking, scan telemetry, and student availability. There is no onboarding/auth brief yet.
- `prisma/schema.prisma`: `User` has `passwordHash`, `forcePasswordChange`, `active`, `role`, and profile fields; `AllowedEmail` has unique `email`, `role`, `createdById`, optional `claimedAt`, and optional `claimedById`.
- `src/app/api/users/route.ts`: Direct user creation currently requires a supplied password, sets `forcePasswordChange: true`, and creates or claims a visible allowlist row for staff/student users.
- `src/app/api/allowed-emails/route.ts`: Allowlist creation is separate from user creation, skips registered/allowlisted duplicates generically, and preserves claimed rows.
- `src/app/api/auth/register/route.ts`: Web self-registration requires an unclaimed allowlist row, creates the user, claims the invitation, and signs the user in.
- `src/app/api/auth/login/route.ts`, `src/lib/api.ts`, `src/app/(app)/layout.tsx`, `src/app/change-password/*`: Web login returns `forcePasswordChange`; protected web routes redirect forced users to `/change-password`; API routes block forced users from everything except password change and logout.
- `ios/Wisconsin/Views/LoginView.swift`, `ios/Wisconsin/Core/SessionStore.swift`, `ios/Wisconsin/Core/APIClient.swift`, `ios/Wisconsin/Models/Models.swift`: iOS login submits credentials and stores `CurrentUser`, but `CurrentUser` does not decode `forcePasswordChange` and there is no native first-password/change-password flow.

## Product Direction
- Keep the allowlist gate. It is an accepted security and operations decision, not the problem.
- Stop making operators choose between "create user" and "add allowed email" as separate mental models. The product should present one account access workflow with explicit outcomes.
- Treat direct admin-created accounts and self-registered invite accounts as two modes of the same invitation lifecycle.
- Make iOS capable of completing forced password setup. Linking to web is acceptable for optional registration as a fallback, but not for a user who already has a temporary password and is trying to start work.
- Optimize the main web surface for bulk onboarding. The normal semester use case is "paste or import a roster, review roles, send/hand off access," not one email at a time.
- Preserve security through invite-scoped claims, server-side role restrictions, active-user enforcement, audit logging, rate limits, and generic duplicate/skip responses. Do not loosen the gate to make bulk import easier.

## First-Class Workflow Target
- Staff/admin opens one Onboarding surface from Users or Settings.
- They paste a roster or upload a CSV with name, email, role, optional location, optional area/sport/year fields.
- The app validates and groups rows before any write: ready, duplicate, existing user, invalid email, role not allowed for actor, and missing required fields.
- The operator chooses the account mode per batch or row:
  - `Invite to register`: creates pending allowlist rows and lets users set their own password.
  - `Create with temporary password`: creates users immediately, marks `forcePasswordChange`, and shows/export temporary passwords once.
- The commit step writes in a transaction-oriented service path, returns aggregate counts, keeps claimed allowlist rows for audit, and never reveals sensitive membership details to unauthenticated callers.
- The status page shows pending, claimed, directly created, stale, and failed rows with resend/copy/retry actions where email delivery exists or manual handoff is still required.

## Slices
- [ ] Slice 1: Onboarding brief and decision sync
  - Add `docs/BRIEF_ONBOARDING_V1.md` for the account lifecycle: bulk import, invite, claim, direct-create, forced password setup, recovery, audit, and iOS parity.
  - Add or extend the decision record only if the current D-029 allowlist contract needs a named "invitation lifecycle" clarification.
  - Acceptance: source docs describe one bulk-first operator workflow and explicitly keep allowlist enumeration protections.

- [ ] Slice 2: Server invitation service
  - Extract a small account-access service that normalizes email, creates or claims `AllowedEmail`, optionally creates a `User`, sets `forcePasswordChange` when a temporary password is used, and writes audit entries in one transaction.
  - Keep staff/admin role restrictions exactly aligned with existing routes.
  - Preserve generic duplicate/skip responses for allowlist-only actions so membership enumeration does not regress.
  - Add a bulk preview/commit service shape that can validate more than the current 50-row allowlist batch without creating accounts until the operator confirms.
  - Acceptance: `/api/users` and `/api/allowed-emails` share the same lifecycle helper instead of maintaining separate partial versions of allowlist/user coupling.

- [ ] Slice 3: Web operator onboarding surface
  - Rework Users > Add User and Settings > Allowed Emails around a single first-class Onboarding flow with two explicit paths: `Invite to register` and `Create account with temporary password`.
  - Add paste/CSV bulk intake, preview validation, row grouping, role/location defaults, and final aggregate confirmation.
  - Keep shadcn dialog/form/select/button primitives and the existing Users handoff into profile completion.
  - Add clear post-create copy: who can sign in now, whether a temporary password exists, and whether the allowlist row is pending or claimed.
  - Acceptance: an admin/staff user can onboard a group from one surface without separately visiting both Users and Allowed Emails.

- [ ] Slice 4: Bulk security and operational hardening
  - Add focused tests for role escalation in bulk rows, duplicate emails inside a batch, existing registered users, existing pending invites, generic skip copy, and audit rows.
  - Add rate-limit and row-count bounds that support real onboarding waves without becoming an abuse endpoint.
  - Add optional CSV export for temporary-password handoff only after confirming passwords are one-time visible and never retrievable later.
  - Acceptance: bulk onboarding is faster than one-by-one entry but not less secure than the existing allowlist and direct-create paths.

- [ ] Slice 5: iOS forced password setup
  - Add `forcePasswordChange` to `CurrentUser` and `APIClient` auth decoding.
  - After successful login, route forced users to a native password setup view before `AppTabView`.
  - Add an API client method for the allowed forced-password route, preserving current-password verification.
  - Refresh `/api/me` after success and only then enter the app shell.
  - Acceptance: an iOS user with an admin-issued temporary password can sign in, set a new password, and reach Home without using the web app.

- [ ] Slice 6: iOS registration/recovery polish
  - Decide whether iOS should keep external web registration only or offer a small native invite-claim registration form.
  - If native registration is included, reuse `/api/auth/register`, show invitation-only copy, and handle claimed/missing invite errors without exposing more than the web route already does.
  - Keep Forgot Password link behavior unless email delivery is configured and a native flow becomes useful.
  - Acceptance: the iOS login screen makes the correct path obvious for invited users, temporary-password users, and users who need help.

- [ ] Slice 7: Tests, hardening, and docs sync
  - Add route/service tests for bulk preview/commit, direct create, invite-only allowlist, registered-user backfill, forced-password login, iOS-oriented password change payload, and enumeration-safe duplicate behavior.
  - Add focused Swift coverage if the repo has a practical Swift test target; otherwise rely on simulator build plus source-level flow verification.
  - Update `AREA_USERS.md`, `AREA_SETTINGS.md`, `AREA_MOBILE.md`, and `docs/GAPS_AND_RISKS.md` if any new gap is opened or closed.
  - Move this plan to `tasks/archive/` only after all slices ship.

## Verification
- [ ] `npx vitest run tests/auth-hardening.test.ts tests/allowed-emails-route.test.ts tests/users-route.test.ts`
- [ ] Add and run focused onboarding service/API tests once the helper exists.
- [ ] `npx tsc --noEmit`
- [ ] `npm run db:migrate:check`
- [ ] `git diff --check`
- [ ] `npx next build`
- [ ] `npm run drift:ios`
- [ ] `npm run audit:ios:gaps`
- [ ] `xcodebuild -scheme Wisconsin -destination 'generic/platform=iOS Simulator' -configuration Debug build`
- [ ] Browser smoke: Users Add User, Settings > Allowed Emails, `/register`, `/login`, `/change-password`.
- [ ] iOS simulator smoke: normal login, forced-password login, forced-password success route, failed temp-password retry.

## Stop Conditions
- Stop if the current database has existing users without matching claimed allowlist rows in a shape the planned service cannot reconcile safely.
- Stop if email delivery is still unconfigured and any slice depends on emailed invitations or reset links.
- Stop if the iOS target cannot build after auth model changes; re-plan the iOS slice before widening web work.
- Stop if proposed API responses would reveal whether an email is registered or allowlisted beyond the current generic skip behavior.
- Stop if bulk temp-password export would store or expose passwords after the one-time handoff window.

## Review
- Shipped:
- Verified:
- Deferred:
