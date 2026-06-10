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
- Treat invite-to-register as the first-time onboarding path. Recovery-created or reset accounts may still require forced password setup, but shared first-time temporary passwords are retired for beta.
- Keep iOS capable of completing forced password setup for administrator reset and recovery cases.
- Optimize the main web surface for bulk onboarding. The normal semester use case is "paste or import a roster, review roles, send/hand off access," not one email at a time.
- Preserve security through invite-scoped claims, server-side role restrictions, active-user enforcement, audit logging, rate limits, and generic duplicate/skip responses. Do not loosen the gate to make bulk import easier.

## First-Class Workflow Target
- Staff/admin opens one Onboarding surface from Users or Settings.
- They paste a roster or upload a CSV with name, email, role, optional location, optional area/sport/year fields.
- The app validates and groups rows before any write: ready, duplicate, existing user, invalid email, role not allowed for actor, and missing required fields.
- The operator creates pending allowlist rows and users set their own password during registration.
- The commit step writes through the onboarding service path, returns aggregate counts, keeps claimed allowlist rows for audit, and never reveals sensitive membership details to unauthenticated callers.
- The status page shows pending, claimed, stale, and failed rows with copy/retry actions where email delivery exists or manual handoff is still required.

## Slices
- [x] Slice 1: Onboarding brief and decision sync
  - Add `docs/BRIEF_ONBOARDING_V1.md` for the account lifecycle: bulk import, invite, claim, direct-create, forced password setup, recovery, audit, and iOS parity.
  - Add or extend the decision record only if the current D-029 allowlist contract needs a named "invitation lifecycle" clarification.
  - Acceptance: source docs describe one bulk-first operator workflow and explicitly keep allowlist enumeration protections.

- [x] Slice 2: Server invitation service
  - Extract a small account-access service that normalizes email, creates or claims `AllowedEmail`, reconciles registered users, and preserves audit entries for user and allowlist mutations.
  - Keep staff/admin role restrictions exactly aligned with existing routes.
  - Preserve generic duplicate/skip responses for allowlist-only actions so membership enumeration does not regress.
  - Add a bulk preview/commit service shape that can validate more than the current 50-row allowlist batch without creating accounts until the operator confirms.
  - Acceptance: `/api/users` and `/api/allowed-emails` share the same lifecycle helper instead of maintaining separate partial versions of allowlist/user coupling.

- [x] Slice 3: Web operator onboarding surface
  - [x] Rework Users > Add User and Settings > Allowed Emails around a single first-class invite-to-register onboarding flow.
  - [x] Add bulk paste intake for invitations, role-safe options, shared duplicate/registered skip copy, and the existing Users handoff into profile completion.
  - [x] Add CSV-like invite intake with local preview validation for ready rows, duplicate rows, invalid emails, invalid roles, and role-blocked rows before write.
  - [x] Add server-backed preview for existing registered users, existing pending invites, and claimed invites before commit.
  - [x] Add role defaults beyond invite rows.
  - [x] Add final aggregate confirmation after invitation commits.
  - [x] Add a dedicated status page for pending, stale pending, and claimed onboarding rows.
  - Keep shadcn dialog/form/select/button primitives and the existing Users handoff into profile completion.
  - Add clear post-create copy: who can register now and whether the allowlist row is pending or claimed.
  - Acceptance: an admin/staff user can onboard a group from one surface without separately visiting both Users and Allowed Emails.

- [x] Slice 4: Bulk security and operational hardening
  - [x] Add focused tests for role escalation in bulk rows, duplicate emails inside a batch, existing registered users, existing pending invites, generic skip copy, and audit rows.
  - [x] Add rate-limit and row-count bounds that support real onboarding waves without becoming an abuse endpoint.
  - [x] Retire first-time temporary-password handoff so onboarding output never contains shared passwords.
  - [x] Add status-page handoff controls for copying prefilled registration links and removing unclaimed stale/pending invitations before reissue.
  - Acceptance: bulk onboarding is faster than one-by-one entry but not less secure than the existing allowlist and direct-create paths.

- [x] Slice 5: iOS forced password setup
  - Add `forcePasswordChange` to `CurrentUser` and `APIClient` auth decoding.
  - After successful login, route forced users to a native password setup view before `AppTabView`.
  - Add an API client method for the allowed forced-password route, preserving current-password verification.
  - Refresh `/api/me` after success and only then enter the app shell.
  - Acceptance: an iOS user in forced-password recovery can sign in, set a new password, and reach Home without using the web app.

- [x] Slice 6: iOS registration/recovery polish
  - [x] Decide whether iOS should keep external web registration only or offer a small native invite-claim registration form.
  - [x] Keep registration web-owned for V1, link native Login to `/register`, and support `/register?email=...` prefill for phone-first invite claims without adding a separate native registration form.
  - Keep Forgot Password link behavior unless email delivery is configured and a native flow becomes useful.
  - Acceptance: the iOS login screen makes the correct path obvious for invited users, recovery forced-password users, and users who need help.

- [ ] Slice 7: Tests, hardening, and docs sync
  - Add route/service tests for bulk preview/commit, direct create, invite-only allowlist, registered-user backfill, forced-password login, iOS-oriented password change payload, and enumeration-safe duplicate behavior.
  - Add focused Swift coverage if the repo has a practical Swift test target; otherwise rely on simulator build plus source-level flow verification.
  - Update `AREA_USERS.md`, `AREA_SETTINGS.md`, `AREA_MOBILE.md`, and `docs/GAPS_AND_RISKS.md` if any new gap is opened or closed.
  - Move this plan to `tasks/archive/` only after all slices ship.

## Verification
- [ ] `npx vitest run tests/auth-hardening.test.ts tests/allowed-emails-route.test.ts tests/users-route.test.ts`
- [x] Add and run focused onboarding service/API tests once the helper exists.
- [x] `npx tsc --noEmit`
- [x] `npm run db:migrate:check`
- [x] `git diff --check`
- [x] `npx next build`
- [x] `npm run drift:ios`
- [x] `npm run audit:ios:gaps`
- [x] `xcodebuild -scheme Wisconsin -destination 'generic/platform=iOS Simulator' -configuration Debug build`
- [x] Browser smoke: Users Add User, Settings > Allowed Emails, `/register`, `/login`, `/change-password`.
- [ ] iOS simulator smoke: normal login, forced-password login, forced-password success route, failed temp-password retry.

## Stop Conditions
- Stop if the current database has existing users without matching claimed allowlist rows in a shape the planned service cannot reconcile safely.
- Stop if email delivery is still unconfigured and any slice depends on emailed invitations or reset links.
- Stop if the iOS target cannot build after auth model changes; re-plan the iOS slice before widening web work.
- Stop if proposed API responses would reveal whether an email is registered or allowlisted beyond the current generic skip behavior.
- Stop if the invite-first beta path requires first-time shared temporary passwords again.

## Review
- Active loop:
  - 2026-06-08: Selected Slice 7 for the current development loop. Scope is final onboarding hardening, docs sync, verification, and plan lifecycle after the no-temp-password beta pivot. No new product behavior is included in this slice.
  - 2026-06-08: Focused onboarding/auth tests, TypeScript, migration-prefix check, and whitespace check passed. `npm run build` was initially blocked because the script runs Prisma migration deploy against Neon; after explicit approval, the command reached Neon, found no pending migrations through the HTTP fallback, and completed the Next production build.
  - 2026-06-08: Additional local verification passed: focused onboarding/auth Vitest suite, `npx tsc --noEmit`, `npm run db:migrate:check`, `git diff --check`, and `npx next build`. Local browser smoke on `http://127.0.0.1:3017` passed for `/login` and `/register?email=smoke@example.com`; `/change-password`, `/users`, `/settings/allowed-emails`, and `/users/onboarding-status` redirected unauthenticated users to `/login` without console errors.
  - 2026-06-08: Authenticated browser smoke passed using the documented local admin login. `/users` and `/settings/allowed-emails` loaded as admin routes, opened the shared Onboarding dialog, and showed invite-only bulk paste plus one-email flows with no temporary-password, direct-create, bulk-create, or CSV password-handoff controls. Console warnings/errors were empty; touched API requests returned 200 aside from expected navigation-aborted stale dashboard fetches.
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
  - 2026-06-08: Slice 4 launch hardening shipped. Bulk direct-create is rate-limited at the route boundary and rejects Admin rows before temporary password generation, while the service also rejects Admin rows so direct bulk onboarding stays scoped to Staff and Student accounts.
  - 2026-06-08: No-temp-password beta pivot shipped. The shared onboarding dialog is now invite-first, `/api/users` POST and `/api/users/bulk-create` return retired-flow responses after auth checks, and first-time users set their own password through registration.
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
  - 2026-06-08: `npx vitest run tests/onboarding-lifecycle.test.ts tests/allowed-emails-preview.test.ts tests/users-bulk-create-route.test.ts`
  - 2026-06-08: Authenticated browser smoke on `http://127.0.0.1:3017/users` and `http://127.0.0.1:3017/settings/allowed-emails`: local admin login, Onboarding dialog bulk paste tab, Onboarding dialog one-email tab, console errors/warnings check, network status check.
- Deferred:
  - End-to-end launch smoke passed for invite-to-register, stale invite removal, `/register?email=...` prefill, and forced-password recovery in the launch environment. Direct-created temporary-password first login is retired for beta by `tasks/no-temp-password-onboarding-plan.md`.
  - Full final gate remains pending after readiness edits: TypeScript, migration prefix, whitespace, app build, production build, authenticated web smoke, and release cut.
