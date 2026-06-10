# Internal Public Beta Runbook

Last updated: 2026-06-08
Launch target: Wednesday, June 10, 2026

## Scope
This runbook covers the operator paths that must be ready for the internal public beta: onboarding, booking creation, returns, onboarding recovery, audit lookup, and escalation.

## Pre-Launch Checks
1. Confirm beta users are present or staged through Users > Onboarding.
2. Confirm locations, common gear, kits, calendar sources, and representative bookings exist in the launch environment.
3. Confirm production environment variables are set for Neon, `CRON_SECRET`, Resend if email delivery is enabled, Blob storage, Redis rate limiting if expected, and image search if expected.
4. Run the production verification gate after final readiness edits: focused onboarding tests, TypeScript, migration health, migration prefix check, whitespace check, and production build.
5. Run one authenticated browser smoke through dashboard, items, bookings, checkout creation, reservation creation, users, onboarding status, allowed emails, calendar sources, admin fix-today, and notifications.

## Onboarding
1. Open Users, then start the shared onboarding flow.
2. For invite-to-register, paste or import the roster rows, review invalid, duplicate, existing-user, pending-invite, claimed-invite, and role-blocked groups, then commit only ready rows.
3. Ask invited users to register on web. Native iOS links invited users to `/register`, and `/register?email=...` pre-fills the email field.
4. Do not use first-time direct account creation or bulk password handoff. Those routes are retired for beta.
5. If an existing user cannot access their account, use admin password reset as a recovery path and confirm web or iOS holds the user in password setup until they choose a new password.

## Checkout Creation
1. Open Checkouts > New.
2. Choose event or ad hoc context, dates, borrower, and notes.
3. Add equipment, paying attention to availability warnings and selected-equipment summary.
4. Confirm the checkout, then verify it appears in the booking list and item custody state updates.

## Returns
1. Open the active checkout or scan the item code.
2. Use the return or check-in path for the selected equipment.
3. Confirm returned items leave the active checkout and custody reflects the returned state.
4. If scan lookup fails, retry once, then use manual code entry.

## Stale Invitation Recovery
1. Open Users > Onboarding Status.
2. Filter or search for pending and stale pending invitations.
3. Remove stale invitations when the invite should no longer grant access.
4. Recreate the invite only after confirming the person still belongs in the beta cohort.

## Audit Lookup
1. Use the user, allowed-email, booking, or item detail views to inspect recent changes where exposed.
2. For onboarding issues, check that the audit trail records actor, target email or user, source, and result.
3. Escalate if a mutation did not produce an audit entry or if an audit entry shows an unexpected actor or role.

## Escalation
1. Account access problem: capture email, intended role, onboarding mode, current status, and whether the user is on web or iOS.
2. Booking or custody problem: capture booking ID, item code, expected state, actual state, and the last action performed.
3. Production incident: capture timestamp, user, route, action, and screenshot. Stop bulk operations if role boundaries, membership disclosure, or retired password-handoff paths look wrong.
