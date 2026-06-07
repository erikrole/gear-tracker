# Brief: Onboarding V1

## Document Control
- Area: Users, Settings, Mobile Operations
- Owner: Wisconsin Athletics Creative Product
- Status: Planned
- Version: V1
- Last Updated: 2026-06-03
- Decision Reference: D-037

## Problem
Onboarding is currently split across separate operator tasks: create a user, add an allowed email, hand off credentials, and hope the first mobile sign-in path works. That is too fragile for roster-sized student and staff onboarding.

The security model still needs to prevent unauthorized access. The fix is one first-class onboarding lifecycle that keeps the existing invite gate, makes bulk operations predictable, and lets web and iOS handle first sign-in consistently.

## Goals
1. Onboard a large student or staff cohort from one operator workflow.
2. Preserve invite-gated registration through `AllowedEmail`.
3. Support two account modes: invite-to-register and direct-created account with a temporary password.
4. Make duplicate, existing-user, and already-invited cases visible enough for an authorized operator to resolve without leaking membership through public endpoints.
5. Force direct-created users to set their own password before normal app access.
6. Make native iOS first sign-in work for forced-password users.
7. Audit every onboarding mutation with actor, target, source, and result.

## Non-Goals
1. Open registration without an invite.
2. Domain-wide automatic access, such as accepting every address from one school domain.
3. Self-service role requests.
4. Directory sync, SCIM, SSO, Entra, or Google Workspace automation.
5. Email delivery as a required dependency for V1. If delivery is not configured, operators can still copy invite links or one-time temporary passwords.
6. Storing or re-displaying temporary passwords after the initial commit response.

## Product Direction
Onboarding becomes a People workflow with Settings-level configuration roots.

An admin or staff operator should be able to paste a roster or upload CSV rows with email, name, role, and optional fields such as location, area, sport, or student year. The system previews the batch before writing. Preview groups rows into ready, invalid, duplicate-in-batch, existing user, existing pending invite, claimed invite, and role-not-allowed.

For each batch, or for selected rows, the operator chooses:

1. `Invite to register`: create or reuse an unclaimed `AllowedEmail` row. The person completes registration on web.
2. `Create account with temporary password`: create the `User`, create or claim the visible allowlist audit row, set `forcePasswordChange`, and return a one-time temporary password in the commit response.

Public registration and login responses must stay generic where membership disclosure would be unsafe. Authenticated staff/admin onboarding preview may show operational status for records the operator is already authorized to manage.

## Security Requirements
1. The allowlist gate remains the source of truth for self-registration.
2. Server authorization owns all role boundaries. UI filtering is only a convenience.
3. STAFF can only onboard STUDENT accounts. ADMIN can onboard STAFF and STUDENT accounts.
4. Bulk commit must re-validate every row on the server. Preview results are advisory.
5. Duplicate and existing-account handling must not create public enumeration paths.
6. Temporary passwords are one-time visible, generated server-side, never logged, and never retrievable.
7. Direct-created accounts must keep `forcePasswordChange` until the user successfully changes password through an allowed endpoint.
8. Every create, claim, skip, resend, and retry action must be audit logged.
9. Bulk endpoints need row-count bounds and rate limits sized for shared-network student onboarding.
10. Any import output that includes temporary passwords must be treated as sensitive and short-lived.

## V1 Scope
1. A documented onboarding lifecycle that unifies `AllowedEmail` invites and direct user creation.
2. A shared server service for previewing and committing onboarding rows.
3. A web onboarding surface reachable from Users and discoverable from Settings > Allowed Emails.
4. Bulk paste or CSV input with validation before write.
5. Commit summaries with created, invited, skipped, failed, and sensitive-output counts.
6. Status and follow-up controls for pending, claimed, directly created, stale, and failed rows.
7. Native iOS forced-password handling before the normal app shell.
8. Focused tests for bulk role boundaries, duplicates, existing records, audit writes, and forced-password access.

## Data and API Notes
1. Keep the existing `AllowedEmail` and `User.forcePasswordChange` models for V1.
2. Introduce a small onboarding service rather than duplicating logic between `/api/allowed-emails`, `/api/users`, and future bulk endpoints.
3. Preview endpoints must not mutate data.
4. Commit endpoints should use transactions for create-or-claim flows and audit entries.
5. The public registration endpoint continues to derive role from the allowlist entry.
6. The current forced-password API exception list must stay narrow: password setup and logout only.
7. iOS `CurrentUser` needs `forcePasswordChange` so the native shell can route correctly after login and `/api/me`.

## Acceptance Criteria
- [ ] Operator can onboard a roster-sized batch without manually switching between Users and Allowed Emails.
- [ ] Operator can choose invite-to-register or direct-create temporary-password mode.
- [ ] Bulk preview catches invalid email, duplicate row, existing user, existing pending invite, claimed invite, and role-not-allowed cases.
- [ ] Bulk commit re-validates and returns aggregate results without leaking sensitive membership data outside authenticated staff/admin surfaces.
- [ ] STAFF cannot bulk-create or bulk-invite STAFF or ADMIN users.
- [ ] ADMIN cannot accidentally create an open-registration path.
- [ ] Temporary passwords are only visible once and direct-created users must change them.
- [ ] Native iOS blocks forced-password users from the app shell and provides a password setup path.
- [ ] Audit log records onboarding mutations with enough detail for later review.
- [ ] Docs, task plan, web tests, API tests, and iOS verification are updated before shipping.

## Implementation Slices
1. Brief and decision sync.
2. Shared server onboarding service and API shape.
3. Web onboarding operator surface.
4. Bulk security and operational hardening.
5. iOS forced-password setup.
6. iOS registration and recovery polish.
7. Verification, docs sync, and plan archival.

## Verification Plan
1. API tests for allowed emails, users, registration, login, and onboarding bulk paths.
2. Role-boundary tests for STAFF versus ADMIN batch rows.
3. Forced-password tests for web and iOS API behavior.
4. `npm run db:migrate:check` if schema changes are introduced.
5. `npx tsc --noEmit`.
6. `npx next build`.
7. `npm run drift:ios`.
8. `npm run audit:ios:gaps`.
9. iOS simulator build using `generic/platform=iOS Simulator`.
10. Browser smoke for onboarding preview, commit, status, resend, and sensitive-output paths.

## Risks and Stop Conditions
1. Stop if bulk reconciliation cannot avoid unsafe role escalation.
2. Stop if duplicate handling starts leaking membership through public auth endpoints.
3. Stop if temporary password output needs persistence for usability.
4. Stop if iOS cannot change forced passwords through a narrowly allowed route.
5. Stop if email delivery becomes required before the underlying onboarding lifecycle works.
