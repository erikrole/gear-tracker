# Overdue Checkout Notification Hardening

## Scope

Replace the once-daily, multi-alert checkout escalation behavior with exact durable timing, one meaningful late stage, location-scoped operational ownership, due-version-safe deduplication, and enforceable fatigue controls.

## Implemented Locally

- [x] Adopt five stages: -2h, due time, grace expiry, +4h, and +24h.
- [x] Apply grace only to the first overdue boundary and align manual nudge eligibility.
- [x] Schedule durable checkout notification Workflow runs wherever return Live Activity timing is scheduled.
- [x] Recheck `OPEN` and expected `endsAt` at every stage so completion and extension supersede stale work.
- [x] Collapse late delivery and daily repair to the highest eligible stage.
- [x] Version dedupe by booking due date, stage, recipient kind, and recipient.
- [x] Route +4h and +24h to configured location responders with creator/admin fallback.
- [x] Keep +24h all-admin delivery in-app + email while reserving push for responders.
- [x] Enforce separate requester and operational caps before every recipient insert.
- [x] Add audited responder configuration to Settings > Escalation.
- [x] Add migration `0111_checkout_overdue_notification_policy` and focused behavioral coverage.
- [x] Synchronize D-009, notification/settings area docs, and the risk registry.

## Rollout and Acceptance Remaining

- [ ] Review and apply migration `0111_checkout_overdue_notification_policy` in the controlled production migration workflow.
- [ ] Deploy compatible server and Workflow code.
- [ ] Configure at least one responder for every active checkout location.
- [ ] Prove one exact requester stage, one location-responder stage, and one +24h admin email/inbox stage with authenticated accounts.
- [ ] Extend an open test checkout and verify the old workflow reports superseded while the new due-date version remains eligible.
- [ ] Run the repair endpoint after the durable send and verify no duplicate or lower-stage replay.
- [ ] Verify Settings responder assignment and caps in an authenticated browser.

## Stop Boundary

Do not apply the migration, deploy, create production checkouts, send real alerts, or configure production responders without explicit shipping and production-mutation authorization.
