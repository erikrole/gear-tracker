# Brief: Onboarding V1

## Document Control
- Area: Users, Settings, Mobile Operations
- Owner: Wisconsin Athletics Creative Product
- Status: Active - invite-first V1 shipped and launch-smoked
- Version: V1
- Last Updated: 2026-07-17
- Decision Reference: D-037

## Problem
Onboarding is currently split across separate operator tasks: create access, add an allowed email, tell users where to register, and confirm the first mobile sign-in path works. That is too fragile for roster-sized student and staff onboarding.

The security model still needs to prevent unauthorized access. The fix is one first-class onboarding lifecycle that keeps the existing invite gate, makes bulk operations predictable, and lets web and iOS handle first sign-in consistently.

## Goals
1. Onboard a large student or staff cohort from one operator workflow.
2. Preserve invite-gated registration through `AllowedEmail`.
3. Support invite-to-register as the first-time onboarding path so users set their own password.
4. Make duplicate, existing-user, and already-invited cases visible enough for an authorized operator to resolve without leaking membership through public endpoints.
5. Keep forced-password handling available for administrator reset/recovery, not first-time onboarding.
6. Make native iOS account recovery work for forced-password users.
7. Audit every onboarding mutation with actor, target, source, and result.

## Non-Goals
1. Open registration without an invite.
2. Domain-wide automatic access, such as accepting every address from one school domain.
3. Self-service role requests.
4. Directory sync, SCIM, SSO, Entra, or Google Workspace automation.
5. Email delivery as a required dependency for V1. If delivery is not configured, operators can still copy invite links or send users to registration manually.
6. Pre-created user profiles without any password. `User.passwordHash` is required today, so that needs a later schema and setup-token slice.

## Product Direction
Onboarding becomes a People workflow with Settings-level configuration roots.

An admin or staff operator should be able to paste a roster or upload CSV rows with email, name, role, and optional fields such as location, area, sport, or student year. The system previews the batch before writing. Preview groups rows into ready, invalid, duplicate-in-batch, existing user, existing pending invite, claimed invite, and role-not-allowed.

For each batch, the operator creates or reuses unclaimed `AllowedEmail` rows. The person completes registration on web and chooses their own password.

Public registration and login responses must stay generic where membership disclosure would be unsafe. Authenticated staff/admin onboarding preview may show operational status for records the operator is already authorized to manage.

## Security Requirements
1. The allowlist gate remains the source of truth for self-registration.
2. Server authorization owns all role boundaries. UI filtering is only a convenience.
3. STAFF can only onboard STUDENT accounts. ADMIN can onboard STAFF and STUDENT accounts.
4. Bulk commit must re-validate every row on the server. Preview results are advisory.
5. Duplicate and existing-account handling must not create public enumeration paths.
6. First-time onboarding must not generate, show, export, or require shared temporary passwords.
7. Recovery-created forced-password accounts must keep `forcePasswordChange` until the user successfully changes password through an allowed endpoint.
8. Every create, claim, skip, resend, and retry action must be audit logged.
9. Bulk endpoints need row-count bounds and rate limits sized for shared-network student onboarding.
10. Import output must not contain passwords.

## V1 Scope
1. A documented onboarding lifecycle centered on `AllowedEmail` invites.
2. A shared server service for previewing and committing onboarding rows.
3. A web onboarding surface reachable from Users and discoverable from Settings > Allowed Emails.
4. Bulk paste or CSV input with validation before write.
5. Commit summaries with invited, skipped, and failed counts.
6. Status and follow-up controls for pending, claimed, stale, and failed rows.
7. Native iOS forced-password handling for reset/recovery users before the normal app shell.
8. Focused tests for bulk role boundaries, duplicates, existing records, audit writes, and forced-password access.
9. Role-aware Welcome setup on web and native iOS after registration or sign-in, with a one-day continue-later path.
10. Derived operational-readiness and profile-completion status for all active accounts in the staff/admin onboarding view.

## Data and API Notes
1. Keep the existing `AllowedEmail` and `User.forcePasswordChange` models for V1.
2. Keep onboarding commits on `/api/allowed-emails`; `/api/users` first-time direct creation is retired.
3. Preview endpoints must not mutate data.
4. Commit endpoints should use transactions for create-or-claim flows and audit entries.
5. The public registration endpoint continues to derive role from the allowlist entry.
6. Registration accepts legacy Wiscard input for rollout compatibility but ignores it; typed card number and issue code belong to authenticated setup.
7. The current forced-password API exception list must stay narrow: password setup and logout only.
8. iOS `CurrentUser` keeps `forcePasswordChange` so the native shell can route reset/recovery users correctly after login and `/api/me`.

## Acceptance Criteria
- [x] Operator can onboard a roster-sized batch without manually switching between Users and Allowed Emails.
- [x] Operator can add invite-to-register access without a temporary-password handoff.
- [x] Bulk preview catches invalid email, duplicate row, existing user, existing pending invite, claimed invite, and role-not-allowed cases.
- [x] Bulk commit re-validates and returns aggregate results without leaking sensitive membership data outside authenticated staff/admin surfaces.
- [x] STAFF cannot bulk-create or bulk-invite STAFF or ADMIN users.
- [x] ADMIN cannot accidentally create an open-registration path.
- [x] First-time onboarding does not generate or export temporary passwords.
- [x] Native iOS blocks recovery forced-password users from the app shell and provides a password setup path.
- [x] Audit log records onboarding mutations with enough detail for later review.
- [x] Docs, task plan, web tests, API tests, and iOS verification are updated before shipping.
- [x] New web registrations enter role-aware setup, and active-account readiness remains derived from canonical profile fields.
- [x] Native iOS mirrors the role-aware setup contract without caching private profile values on device.

## Launch Notes
1. V1 keeps registration web-owned. Native iOS links invited users to `/register`, then owns the authenticated profile-completion experience natively.
2. First-time direct-create and bulk direct-create endpoints are retired for beta. Operators should add allowlist invitations instead.
3. Admin password reset stays available as a recovery path and still requires password setup before normal app access.
4. Production launch smoke passed on June 8, 2026 for invite-to-register, stale invite removal, `/register?email=...` prefill, and forced-password recovery.

## Implementation Slices
1. Brief and decision sync.
2. Shared server onboarding service and API shape.
3. Web invite-first onboarding operator surface.
4. Bulk security and operational hardening.
5. iOS forced-password setup.
6. iOS registration and recovery polish.
7. Native iOS role-aware profile completion and photo crop.
8. Verification, docs sync, and plan archival.

## Verification Plan
1. API tests for allowed emails, users, registration, login, and onboarding bulk paths.
2. Role-boundary tests for STAFF versus ADMIN batch rows.
3. Forced-password recovery tests for web and iOS API behavior.
4. `npm run db:migrate:check` if schema changes are introduced.
5. `npx tsc --noEmit`.
6. `npx next build`.
7. `npm run drift:ios`.
8. `npm run audit:ios:gaps`.
9. iOS simulator build using `generic/platform=iOS Simulator`.
10. Browser smoke for onboarding preview, commit, status, and registration-link paths.

## Risks and Stop Conditions
1. Stop if bulk reconciliation cannot avoid unsafe role escalation.
2. Stop if duplicate handling starts leaking membership through public auth endpoints.
3. Stop if operators still need first-time temporary-password output for usability.
4. Stop if iOS cannot change forced passwords through a narrowly allowed route.
5. Stop if email delivery becomes required before the underlying onboarding lifecycle works.
