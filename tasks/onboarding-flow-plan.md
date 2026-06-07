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
- [x] Slice 1: Onboarding brief and decision sync
  - Add `docs/BRIEF_ONBOARDING_V1.md` for the account lifecycle: bulk import, invite, claim, direct-create, forced password setup, recovery, audit, and iOS parity.
  - Add or extend the decision record only if the current D-029 allowlist contract needs a named "invitation lifecycle" clarification.
  - Acceptance: source docs describe one bulk-first operator workflow and explicitly keep allowlist enumeration protections.

- [x] Slice 2: Server invitation service
  - Extract a small account-access service that normalizes email, creates or claims `AllowedEmail`, optionally creates a `User`, sets `forcePasswordChange` when a temporary password is used, and preserves audit entries for user and allowlist mutations.
  - Keep staff/admin role restrictions exactly aligned with existing routes.
  - Preserve generic duplicate/skip responses for allowlist-only actions so membership enumeration does not regress.
  - Add a bulk preview/commit service shape that can validate more than the current 50-row allowlist batch without creating accounts until the operator confirms.
  - Acceptance: `/api/users` and `/api/allowed-emails` share the same lifecycle helper instead of maintaining separate partial versions of allowlist/user coupling.

- [ ] Slice 3: Web operator onboarding surface
  - [x] Rework Users > Add User and Settings > Allowed Emails around a single first-class Onboarding flow with two explicit paths: `Invite to register` and `Create account with temporary password`.
  - [x] Add bulk paste intake for invitations, role-safe options, shared duplicate/registered skip copy, and the existing Users handoff into profile completion.
  - [x] Add CSV-like invite intake with local preview validation for ready rows, duplicate rows, invalid emails, invalid roles, and role-blocked rows before write.
  - [x] Add server-backed preview for existing registered users, existing pending invites, and claimed invites before commit.
  - [x] Add role/location defaults beyond invite rows.
  - [x] Add final aggregate confirmation after invitation commits and direct account creation.
  - [x] Add a dedicated status page for pending, stale pending, and claimed onboarding rows.
  - Keep shadcn dialog/form/select/button primitives and the existing Users handoff into profile completion.
  - Add clear post-create copy: who can sign in now, whether a temporary password exists, and whether the allowlist row is pending or claimed.
  - Acceptance: an admin/staff user can onboard a group from one surface without separately visiting both Users and Allowed Emails.

- [ ] Slice 4: Bulk security and operational hardening
  - Add focused tests for role escalation in bulk rows, duplicate emails inside a batch, existing registered users, existing pending invites, generic skip copy, and audit rows.
  - Add rate-limit and row-count bounds that support real onboarding waves without becoming an abuse endpoint.
  - [x] Add optional CSV export for temporary-password handoff only after confirming passwords are one-time visible and never retrievable later.
  - [x] Add status-page handoff controls for copying prefilled registration links and removing unclaimed stale/pending invitations before reissue.
  - Acceptance: bulk onboarding is faster than one-by-one entry but not less secure than the existing allowlist and direct-create paths.

- [x] Slice 5: iOS forced password setup
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
  - 2026-06-03: Slice 1 shipped. Added `docs/BRIEF_ONBOARDING_V1.md` and D-037 in `docs/DECISIONS.md`, defining onboarding as a bulk-capable invitation lifecycle with allowlist security, temporary-password rules, iOS forced-password handling, and audit/rate-limit guardrails.
  - 2026-06-03: Slice 2 shipped. Added `src/lib/services/onboarding-lifecycle.ts`, refactored `/api/users` direct creation and `/api/allowed-emails` single/bulk creation onto the shared lifecycle helpers, and added `tests/onboarding-lifecycle.test.ts` coverage for direct-created forced-password users, pending-invite claim, staff-role invite blocking, registered-user backfill, generic duplicate skip, and bulk skip counts.
  - 2026-06-03: Slice 3A shipped. Added a shared `OnboardingDialog` used by both `/users` and `/settings/allowed-emails`, with bulk invite paste, single invite, direct create with temporary password, role-safe invite choices, location-load safeguards, and shared post-create profile handoff. CSV preview and row-grouped commit remain pending.
  - 2026-06-03: Slice 3B shipped. Bulk invitations now preview pasted emails and CSV-like `email, role` rows locally, grouping ready, duplicate, invalid, and role-blocked rows before write. Submit sends only preview-ready rows with their parsed roles. Server-backed account-status preview and aggregate confirmation remain pending.
  - 2026-06-03: Slice 3C shipped. Added authenticated `POST /api/allowed-emails/preview` plus lifecycle service support for grouping ready, duplicate, existing-user, pending-invite, and claimed-invite rows. The onboarding dialog now runs that preview before bulk commit and blocks saving until account-status issues are resolved.
  - 2026-06-03: Slice 5 shipped. Native iOS now decodes `forcePasswordChange`, routes temporary-password users to `PasswordSetupView` before `AppTabView`, submits to `/api/me/change-password`, refreshes `/api/me`, and only then enters the app shell.
  - 2026-06-03: Slice 3D/4 handoff shipped. The onboarding dialog now stays open after invite/direct-create commits with a result panel, aggregate requested/added/skipped counts, one-time temporary-password copy, and CSV download for direct-created temporary-password handoff.
  - 2026-06-03: Slice 3E status shipped. Added `/users/onboarding-status` for staff/admin review of total, pending, stale pending, and claimed onboarding access, with links from Users, Settings > Allowed Emails, and onboarding completion.
  - 2026-06-04: Slice 4 status handoff shipped. `/users/onboarding-status` now supports copying a prefilled registration link, opening the prefilled registration page, and removing unclaimed pending/stale invitations before reissue. `/register?email=...` now prepopulates the email field for phone-only first login.
  - 2026-06-04: Slice 3F bulk direct-create shipped. The onboarding dialog now supports bulk `name,email,role,location` account creation with role/location defaults, server-generated temporary passwords, claimed allowlist rows, forced password change, and a one-time CSV handoff for up to 50 accounts.
- Verified:
  - 2026-06-03: `git diff --check -- docs/BRIEF_ONBOARDING_V1.md docs/DECISIONS.md tasks/onboarding-flow-plan.md tasks/todo.md`
  - 2026-06-03: `npx vitest run tests/onboarding-lifecycle.test.ts tests/allowed-emails.test.ts tests/users-route.test.ts`
  - 2026-06-03: `npx tsc --noEmit`
  - 2026-06-03: `npx vitest run tests/onboarding-dialog-source.test.ts`
  - 2026-06-03: `npx tsc --noEmit`
  - 2026-06-03: `npx vitest run tests/onboarding-dialog-source.test.ts tests/onboarding-status-page-source.test.ts`
  - 2026-06-03: `npx tsc --noEmit`
  - 2026-06-03: `npm run db:migrate:check`
  - 2026-06-03: `git diff --check`
  - 2026-06-03: `npx next build`
  - 2026-06-03: `npx vitest run tests/onboarding-dialog-source.test.ts tests/users-location-options-state.test.ts tests/settings-allowed-emails-display.test.ts`
  - 2026-06-03: `npx tsc --noEmit`
  - 2026-06-03: `npx vitest run tests/onboarding-lifecycle.test.ts tests/allowed-emails-preview.test.ts`
  - 2026-06-03: `npx tsc --noEmit`
  - 2026-06-03: `npx vitest run tests/ios-forced-password.test.ts`
  - 2026-06-03: `npx vitest run tests/ios-forced-password.test.ts tests/student-field-contracts.test.ts`
  - 2026-06-03: `npm run drift:ios`
  - 2026-06-03: `npm run audit:ios:gaps`
  - 2026-06-03: `xcodegen generate` then restored `Wisconsin.entitlements`
  - 2026-06-03: `xcodebuild -project ios/Wisconsin.xcodeproj -scheme Wisconsin -destination 'generic/platform=iOS Simulator' -configuration Debug build`
  - 2026-06-03: `git diff --check -- ios/Wisconsin/Models/Models.swift ios/Wisconsin/Core/APIClient.swift ios/Wisconsin/Core/SessionStore.swift ios/Wisconsin/App/WisconsinApp.swift ios/Wisconsin/Views/PasswordSetupView.swift tests/ios-forced-password.test.ts scripts/ios-audit-inventory.sh tasks/audit-login-ios.md docs/AREA_MOBILE.md docs/AREA_USERS.md docs/GAPS_AND_RISKS.md tasks/onboarding-flow-plan.md tasks/todo.md ios/Wisconsin.xcodeproj/project.pbxproj ios/Wisconsin/Wisconsin.entitlements`
  - 2026-06-04: `npx vitest run tests/onboarding-status-page-source.test.ts`
  - 2026-06-04: `npx tsc --noEmit`
  - 2026-06-04: `npm run db:migrate:check`
  - 2026-06-04: `git diff --check`
  - 2026-06-04: `npx next build`
  - 2026-06-04: `npx vitest run tests/onboarding-dialog-source.test.ts tests/onboarding-lifecycle.test.ts`
  - 2026-06-04: `npx tsc --noEmit`
- Deferred:
